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
  getDocs,
  deleteDoc,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { firestore, ensureAuth } from './firebase'
import { dataURLToThumbnail } from '../lib/image'
import type { RoomTransport, BoothMember, CatalogSnapshot } from './types'
import type { Product, Sale } from '../types'

// ── Module-level state ────────────────────────────────────────────────────────

/** Room code of the currently active room (master: after createRoom; helper: after joinRoom). */
let currentRoomCode: string | null = null

/** Auth uid of the currently registered member (set by registerMember). */
let _ownUid: string | null = null

/** setInterval handle for the presence heartbeat (cleared by leaveMember/endRoom). */
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null

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
    // Stop heartbeat if still running (safety net in case leaveMember wasn't called)
    if (_heartbeatTimer !== null) {
      clearInterval(_heartbeatTimer)
      _heartbeatTimer = null
    }
    _ownUid = null

    if (!currentRoomCode) return
    const code = currentRoomCode
    // Clear module state immediately so no further operations can attach to this room
    currentRoomCode = null

    // ── Best-effort full wipe of the cloud room ─────────────────────────────
    // The master's db.sales already holds the union of all pushed sales,
    // so deleting the cloud sales sub-collection is safe.
    // We chunk all deletes into batches of ≤ 400 ops to stay within Firestore limits.
    const BATCH_LIMIT = 400
    try {
      const subCollections = ['members', 'products', 'meta', 'sales'] as const
      let batch = writeBatch(firestore)
      let opCount = 0

      const commitIfFull = async () => {
        if (opCount >= BATCH_LIMIT) {
          await batch.commit()
          batch = writeBatch(firestore)
          opCount = 0
        }
      }

      for (const sub of subCollections) {
        let snap
        try {
          snap = await getDocs(collection(firestore, 'rooms', code, sub))
        } catch (err) {
          console.warn(`[firebaseTransport] endRoom: getDocs(${sub}) failed (best-effort):`, err)
          continue
        }
        for (const d of snap.docs) {
          await commitIfFull()
          batch.delete(d.ref)
          opCount++
        }
      }

      // Flush remaining sub-collection deletes, then delete the room doc itself
      if (opCount > 0) {
        await batch.commit()
        batch = writeBatch(firestore)
        opCount = 0
      }

      batch.delete(doc(firestore, 'rooms', code))
      await batch.commit()

      console.debug('[firebaseTransport] endRoom → deleted room:', code)
    } catch (err) {
      // Best-effort — don't throw; teardown must not hang
      console.warn('[firebaseTransport] endRoom wipe failed (best-effort):', err)
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

    // ── Ghost product cleanup ───────────────────────────────────────────────────
    // After writing the new product set, delete any existing products/* docs whose
    // id is NOT in the current snapshot. This prevents helpers from seeing products
    // the master has deleted or that were renamed with a new id.
    try {
      const pushedIds = new Set(firestoreProducts.map((fp) => fp.id))
      const existingSnap = await getDocs(collection(firestore, 'rooms', code, 'products'))
      const ghostRefs = existingSnap.docs
        .filter((d) => !pushedIds.has(d.id))
        .map((d) => d.ref)

      if (ghostRefs.length > 0) {
        let ghostBatch = writeBatch(firestore)
        let ghostOps = 0
        for (const ref of ghostRefs) {
          if (ghostOps >= BATCH_LIMIT) {
            await ghostBatch.commit()
            ghostBatch = writeBatch(firestore)
            ghostOps = 0
          }
          ghostBatch.delete(ref)
          ghostOps++
        }
        if (ghostOps > 0) await ghostBatch.commit()
        console.debug('[firebaseTransport] pushCatalog → deleted ghost products:', ghostRefs.length)
      }
    } catch (err) {
      // Best-effort — ghost cleanup failure should not fail the push
      console.warn('[firebaseTransport] pushCatalog ghost cleanup failed (best-effort):', err)
    }

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

  async pushSale(sale: Sale): Promise<void> {
    if (!currentRoomCode) throw new Error('No active room')
    const code = currentRoomCode
    // Idempotent by sale.id — safe to retry (outbox deduplication relies on this).
    await setDoc(doc(firestore, 'rooms', code, 'sales', sale.id), sale)
    console.debug('[firebaseTransport] pushSale → room:', code, '| saleId:', sale.id)
  },

  subscribeSales(onSale: (sale: Sale) => void): () => void {
    if (!currentRoomCode) {
      console.warn('[firebaseTransport] subscribeSales called with no active room')
      return () => {}
    }
    const code = currentRoomCode
    // Use docChanges() so each sale is delivered once (as 'added' or 'modified'),
    // not the entire collection on every write.
    const unsub = onSnapshot(
      collection(firestore, 'rooms', code, 'sales'),
      (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'added' || ch.type === 'modified') {
            onSale(ch.doc.data() as Sale)
          }
        })
      },
    )
    console.debug('[firebaseTransport] subscribeSales → room:', code)
    return () => {
      unsub()
      console.debug('[firebaseTransport] subscribeSales unsubscribed')
    }
  },

  // ── Members (Phase 4) ───────────────────────────────────────────────────────

  async registerMember(name: string, role: 'master' | 'helper'): Promise<string> {
    if (!currentRoomCode) throw new Error('No active room')
    const code = currentRoomCode

    const u = await ensureAuth()
    const uid = u.uid

    // If a heartbeat is already running (e.g. re-registering after restore), stop it first
    if (_heartbeatTimer !== null) {
      clearInterval(_heartbeatTimer)
      _heartbeatTimer = null
    }

    const memberRef = doc(firestore, 'rooms', code, 'members', uid)
    const now = Date.now()
    await setDoc(memberRef, { uid, name, role, joinedAt: now, lastSeen: now })

    // Heartbeat: update lastSeen every ~20s so online heuristic stays fresh
    _heartbeatTimer = setInterval(() => {
      void setDoc(memberRef, { lastSeen: Date.now() }, { merge: true })
    }, 20_000)

    _ownUid = uid
    console.debug('[firebaseTransport] registerMember → uid:', uid, 'role:', role)
    return uid
  },

  subscribeMembers(onUpdate: (members: BoothMember[]) => void): () => void {
    if (!currentRoomCode) {
      console.warn('[firebaseTransport] subscribeMembers called with no active room')
      return () => {}
    }
    const code = currentRoomCode

    const unsub = onSnapshot(
      collection(firestore, 'rooms', code, 'members'),
      (snap) => {
        const now = Date.now()
        const members: BoothMember[] = snap.docs.map((d) => {
          const data = d.data() as {
            uid: string
            name: string
            role: 'master' | 'helper'
            joinedAt: number
            lastSeen: number
          }
          return {
            id: data.uid,
            name: data.name,
            online: now - data.lastSeen < 60_000,
            lastSeen: data.lastSeen,
            role: data.role,
          }
        })

        // Sort: master first, then by joinedAt ascending
        members.sort((a, b) => {
          if (a.role === 'master' && b.role !== 'master') return -1
          if (b.role === 'master' && a.role !== 'master') return 1
          return a.lastSeen - b.lastSeen
        })

        onUpdate(members)
      },
    )

    console.debug('[firebaseTransport] subscribeMembers → room:', code)
    return () => {
      unsub()
      console.debug('[firebaseTransport] subscribeMembers unsubscribed')
    }
  },

  subscribeSelfMembership(onRemoved: () => void): () => void {
    if (!currentRoomCode || !_ownUid) {
      console.warn('[firebaseTransport] subscribeSelfMembership called without active room or uid')
      return () => {}
    }
    const code = currentRoomCode
    const uid = _ownUid

    let docEverExisted = false

    const unsub = onSnapshot(
      doc(firestore, 'rooms', code, 'members', uid),
      (snap) => {
        if (snap.exists()) {
          docEverExisted = true
        } else if (docEverExisted) {
          // Doc transitioned from existing → gone: we were kicked
          console.debug('[firebaseTransport] self membership doc removed — kicked')
          onRemoved()
        }
        // If it never existed yet (initial snapshot not-found), do nothing
      },
    )

    console.debug('[firebaseTransport] subscribeSelfMembership → uid:', uid)
    return () => {
      unsub()
      console.debug('[firebaseTransport] subscribeSelfMembership unsubscribed')
    }
  },

  async leaveMember(): Promise<void> {
    // Stop heartbeat first
    if (_heartbeatTimer !== null) {
      clearInterval(_heartbeatTimer)
      _heartbeatTimer = null
    }

    if (!currentRoomCode || !_ownUid) {
      _ownUid = null
      return
    }

    try {
      await deleteDoc(doc(firestore, 'rooms', currentRoomCode, 'members', _ownUid))
      console.debug('[firebaseTransport] leaveMember → deleted own doc')
    } catch (err) {
      // Best-effort — don't block teardown
      console.warn('[firebaseTransport] leaveMember deleteDoc failed (best-effort):', err)
    } finally {
      _ownUid = null
    }
  },

  async listMembers(): Promise<BoothMember[]> {
    if (!currentRoomCode) return []
    const code = currentRoomCode
    try {
      const snap = await getDocs(collection(firestore, 'rooms', code, 'members'))
      const now = Date.now()
      return snap.docs.map((d) => {
        const data = d.data() as {
          uid: string
          name: string
          role: 'master' | 'helper'
          joinedAt: number
          lastSeen: number
        }
        return {
          id: data.uid,
          name: data.name,
          online: now - data.lastSeen < 60_000,
          lastSeen: data.lastSeen,
          role: data.role,
        }
      })
    } catch (err) {
      console.warn('[firebaseTransport] listMembers failed:', err)
      return []
    }
  },

  async kickMember(memberId: string): Promise<void> {
    if (!currentRoomCode) return
    await deleteDoc(doc(firestore, 'rooms', currentRoomCode, 'members', memberId))
    console.debug('[firebaseTransport] kickMember → uid:', memberId)
  },
}

// ── Utility export (for debugging in Firestore console) ──────────────────────

/** Returns the current active room code (for display in DevTools / BoothScreen). */
export function getCurrentRoomCode(): string | null {
  return currentRoomCode
}
