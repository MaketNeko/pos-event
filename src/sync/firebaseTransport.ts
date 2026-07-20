/**
 * src/sync/firebaseTransport.ts
 *
 * Firebase implementation of RoomTransport (Phase 2: catalog + room lifecycle).
 * Sales sync (Phase 3) and membership management (Phase 4) are left as stubs.
 *
 * Firestore data model:
 *   rooms/{code}                       — room metadata doc
 *   rooms/{code}/meta/categories       — { items: Category[] }
 *   rooms/{code}/meta/sets             — { items: ProductSet[] }
 *   rooms/{code}/meta/owners           — { items: Owner[] }
 *   rooms/{code}/products/{productId}  — Product (without full image) + optional thumb field
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore, ensureAuth } from './firebase'
import { dataURLToThumbnail } from '../lib/image'
import type { RoomTransport, BoothMember, CatalogSnapshot } from './types'
import type { Product } from '../types'

// ── Module-level state ────────────────────────────────────────────────────────

/** Room code of the currently active room (master: after createRoom; helper: after joinRoom). */
let currentRoomCode: string | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a random 6-character uppercase room code (A-Z, 0-9). */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // drop ambiguous O/0, I/1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Return a version of the product safe to write to Firestore.
 * Strips the full-size `image` field and replaces it with a tiny `thumb` (if image exists).
 */
async function toFirestoreProduct(
  p: Product,
): Promise<Omit<Product, 'image'> & { thumb?: string }> {
  const { image, ...rest } = p
  if (!image) return rest
  try {
    const thumb = await dataURLToThumbnail(image)
    return { ...rest, thumb }
  } catch {
    // If thumbnail generation fails, skip the image entirely — don't block the push
    console.warn('[firebaseTransport] thumbnail generation failed for product', p.id)
    return rest
  }
}

// ── RoomTransport implementation ──────────────────────────────────────────────

export const firebaseTransport: RoomTransport = {
  // ── Room lifecycle ──────────────────────────────────────────────────────────

  async createRoom(): Promise<string> {
    const user = await ensureAuth()
    // Try to find a code that isn't already taken (very unlikely collision but be safe)
    let code = generateCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = await getDoc(doc(firestore, 'rooms', code))
      if (!snap.exists()) break
      code = generateCode()
    }
    await setDoc(doc(firestore, 'rooms', code), {
      code,
      createdAt: serverTimestamp(),
      masterUid: user.uid,
      eventId: '',
      eventName: '',
      closed: false,
    })
    currentRoomCode = code
    console.debug('[firebaseTransport] createRoom → code:', code)
    return code
  },

  async joinRoom(code: string): Promise<void> {
    await ensureAuth()
    const roomSnap = await getDoc(doc(firestore, 'rooms', code))
    if (!roomSnap.exists()) {
      throw new Error(`ไม่พบห้อง "${code}"`)
    }
    const data = roomSnap.data()
    if (data?.closed === true) {
      throw new Error(`ห้อง "${code}" ปิดแล้ว`)
    }
    currentRoomCode = code
    console.debug('[firebaseTransport] joinRoom → code:', code)
  },

  async endRoom(): Promise<void> {
    if (!currentRoomCode) return
    try {
      await setDoc(
        doc(firestore, 'rooms', currentRoomCode),
        { closed: true },
        { merge: true },
      )
      console.debug('[firebaseTransport] endRoom → closed room:', currentRoomCode)
    } catch (err) {
      // Best-effort — don't throw; let the store reset state regardless
      console.warn('[firebaseTransport] endRoom failed (best-effort):', err)
    } finally {
      currentRoomCode = null
    }
  },

  // ── Catalog ─────────────────────────────────────────────────────────────────

  async pushCatalog(snapshot: CatalogSnapshot): Promise<void> {
    if (!currentRoomCode) throw new Error('No active room')
    const code = currentRoomCode

    // Prepare all product docs (compress images to thumbnails in parallel)
    const firestoreProducts = await Promise.all(snapshot.products.map(toFirestoreProduct))

    // Firestore batch writes are limited to 500 ops.
    // Each product = 1 set op. Meta docs = 3. Room update = 1.
    // In practice a booth catalog is unlikely to exceed ~490 products,
    // but we split into batches of 400 to be safe.
    const BATCH_LIMIT = 400

    const roomRef = doc(firestore, 'rooms', code)
    const metaCatRef = doc(firestore, 'rooms', code, 'meta', 'categories')
    const metaSetsRef = doc(firestore, 'rooms', code, 'meta', 'sets')
    const metaOwnersRef = doc(firestore, 'rooms', code, 'meta', 'owners')

    // First batch: room doc update + meta docs + first slice of products
    let batch = writeBatch(firestore)
    let opCount = 0

    batch.set(roomRef, { eventId: snapshot.eventId, eventName: snapshot.eventName }, { merge: true })
    opCount++
    batch.set(metaCatRef, { items: snapshot.categories })
    opCount++
    batch.set(metaSetsRef, { items: snapshot.sets })
    opCount++
    batch.set(metaOwnersRef, { items: snapshot.owners })
    opCount++

    for (const fp of firestoreProducts) {
      if (opCount >= BATCH_LIMIT) {
        await batch.commit()
        batch = writeBatch(firestore)
        opCount = 0
      }
      batch.set(doc(firestore, 'rooms', code, 'products', fp.id), fp)
      opCount++
    }

    await batch.commit()

    // Note (Phase 2 stale data): we do NOT delete product docs that were removed
    // from the local catalog. A product deleted locally will persist as a stale
    // doc in Firestore until the room is closed. Helpers may see ghost products.
    // Phase 3 should handle this by diffing or clearing the products sub-collection
    // before re-pushing.

    console.debug(
      '[firebaseTransport] pushCatalog → room:', code,
      '| products:', firestoreProducts.length,
      '| categories:', snapshot.categories.length,
      '| sets:', snapshot.sets.length,
      '| owners:', snapshot.owners.length,
    )
  },

  subscribeCatalog(onUpdate: (snapshot: CatalogSnapshot) => void): () => void {
    if (!currentRoomCode) {
      console.warn('[firebaseTransport] subscribeCatalog called with no active room')
      return () => {}
    }
    const code = currentRoomCode

    // We track all sub-snapshots and merge them whenever any part updates.
    // This means the first call to onUpdate only fires after ALL three meta
    // docs + at least one products snapshot have arrived.
    let categories: CatalogSnapshot['categories'] | null = null
    let sets: CatalogSnapshot['sets'] | null = null
    let owners: CatalogSnapshot['owners'] | null = null
    let products: CatalogSnapshot['products'] | null = null
    let eventId = ''
    let eventName = ''

    function maybeNotify() {
      if (
        categories !== null &&
        sets !== null &&
        owners !== null &&
        products !== null
      ) {
        onUpdate({ products, categories, sets, owners, eventId, eventName })
      }
    }

    // Room doc listener — for eventId/eventName
    const unsubRoom = onSnapshot(doc(firestore, 'rooms', code), (snap) => {
      if (!snap.exists()) return
      const d = snap.data()
      eventId = d?.eventId ?? ''
      eventName = d?.eventName ?? ''
      maybeNotify()
    })

    // Meta: categories
    const unsubCat = onSnapshot(doc(firestore, 'rooms', code, 'meta', 'categories'), (snap) => {
      categories = snap.exists() ? (snap.data()?.items ?? []) : []
      maybeNotify()
    })

    // Meta: sets
    const unsubSets = onSnapshot(doc(firestore, 'rooms', code, 'meta', 'sets'), (snap) => {
      sets = snap.exists() ? (snap.data()?.items ?? []) : []
      maybeNotify()
    })

    // Meta: owners
    const unsubOwners = onSnapshot(doc(firestore, 'rooms', code, 'meta', 'owners'), (snap) => {
      owners = snap.exists() ? (snap.data()?.items ?? []) : []
      maybeNotify()
    })

    // Products collection listener
    const unsubProducts = onSnapshot(
      collection(firestore, 'rooms', code, 'products'),
      (snap) => {
        // Each doc is a Product (without full image) + optional thumb.
        // We surface them as-is; Phase 3 can map thumb → image for the POS display.
        products = snap.docs.map((d) => d.data() as Product)
        maybeNotify()
      },
    )

    // Return a single unsubscribe that tears down all listeners
    return () => {
      unsubRoom()
      unsubCat()
      unsubSets()
      unsubOwners()
      unsubProducts()
      console.debug('[firebaseTransport] subscribeCatalog unsubscribed')
    }
  },

  // ── Sales (Phase 3) ─────────────────────────────────────────────────────────

  async pushSale(_sale: unknown): Promise<void> {
    // TODO(phase 3): append sale to rooms/{code}/sales/{saleId}
  },

  subscribeSales(_onSale: (sale: unknown) => void): () => void {
    // TODO(phase 3): onSnapshot on rooms/{code}/sales
    return () => {}
  },

  // ── Members (Phase 4) ───────────────────────────────────────────────────────

  async listMembers(): Promise<BoothMember[]> {
    // TODO(phase 4): read rooms/{code}/members sub-collection
    return []
  },

  async kickMember(_memberId: string): Promise<void> {
    // TODO(phase 4): delete/flag rooms/{code}/members/{memberId}
  },
}

// ── Utility export (for debugging in Firestore console) ──────────────────────

/** Returns the current active room code (for display in DevTools / BoothScreen). */
export function getCurrentRoomCode(): string | null {
  return currentRoomCode
}
