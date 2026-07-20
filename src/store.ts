import { create } from 'zustand'
import { liveQuery } from 'dexie'
import { db, setSetting, getSetting } from './db'
import { transport } from './sync'
import { initOutboxAutoFlush, flushOutbox } from './sync/outbox'
import { createSnapshot } from './lib/backup'
import type { BoothRole, BoothStatus, BoothMember, CatalogSnapshot } from './sync'
import type { Sale } from './types'

/**
 * Module-level variables for unsubscribe fns.
 * Not exposed in the store interface — cleaned up by endBooth.
 */
let _catalogUnsub: (() => void) | null = null

// ── Catalog-gathering helper (shared by goLiveAsMaster + republishCatalog) ────

async function gatherCatalogSnapshot(): Promise<CatalogSnapshot> {
  const [products, categories, sets, owners] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.sets.toArray(),
    db.owners.toArray(),
  ])
  const state = useApp.getState()
  const currentEventId = state.currentEventId
  let eventName = ''
  if (currentEventId) {
    const ev = await db.events.get(currentEventId)
    eventName = ev?.name ?? ''
  }
  return { products, categories, sets, owners, eventId: currentEventId, eventName }
}
let _salesUnsub: (() => void) | null = null
let _membersUnsub: (() => void) | null = null
let _selfUnsub: (() => void) | null = null

/**
 * Persist / clear the active booth session so a page reload can rejoin the
 * same room instead of dropping out. Stored in the settings table.
 * `name` is the display name used when registering as a member.
 */
const BOOTH_SESSION_KEY = 'boothSession'
function saveBoothSession(role: BoothRole, code: string, name: string): void {
  void setSetting(BOOTH_SESSION_KEY, JSON.stringify({ role, code, name }))
}
function clearBoothSession(): void {
  void setSetting(BOOTH_SESSION_KEY, '')
}

/**
 * Upsert a Sale into an array by id (used for sessionSales).
 * Replaces an existing entry with the same id, or appends if new.
 */
function upsertById(arr: Sale[], sale: Sale): Sale[] {
  const idx = arr.findIndex((s) => s.id === sale.id)
  if (idx === -1) return [...arr, sale]
  const next = [...arr]
  next[idx] = sale
  return next
}

// ── Master-side stock deduction for incoming sales ────────────────────────────
/**
 * Deduct stock for one sale on the master's db.products. Handles single
 * products and fixed/mix sets (via their component list). Mirrors the local
 * checkout logic in PosScreen/CheckoutScreen so helper sales reduce stock too.
 */
async function applyStockForSale(sale: Sale): Promise<void> {
  await db.transaction('rw', db.products, db.sets, async () => {
    for (const item of sale.items) {
      if (item.kind === 'product') {
        const cur = await db.products.get(item.refId)
        if (cur) await db.products.update(item.refId, { stock: Math.max(0, cur.stock - item.qty) })
      } else if (item.kind === 'set') {
        const st = await db.sets.get(item.refId)
        for (const c of st?.items ?? []) {
          const cur = await db.products.get(c.productId)
          if (cur) await db.products.update(c.productId, { stock: Math.max(0, cur.stock - c.qty * item.qty) })
        }
      }
    }
  })
}

/**
 * Master's sales-log handler. Runs for every sale delivered by the room's
 * sales subscription (own + helpers, plus re-delivery after reload).
 *
 * Idempotency: stock is only deducted when the sale is NEW to db.sales.
 *  - Master's own sales are written to db.sales in markPaid BEFORE the echo
 *    arrives here → already present → skipped (no double deduction).
 *  - Helper sales are not yet present → deducted + persisted.
 *  - Re-delivery after reload → already present → skipped.
 */
async function handleMasterSale(sale: Sale): Promise<void> {
  const existing = await db.sales.get(sale.id)
  if (!existing) {
    await applyStockForSale(sale)
    await db.sales.put(sale)
  }
  useApp.setState((s) => ({ sessionSales: upsertById(s.sessionSales, sale) }))
}

// ── Real-time catalog auto-push (master only) ─────────────────────────────────
let _catalogPushUnsub: (() => void) | null = null
let _catalogPushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Debounce window before an auto-push. Long (1 min) on purpose: each push
 * re-writes the whole catalog, so coalescing a booth's worth of sales into one
 * push keeps Firestore reads/writes (and cost) down. Trade-off: helpers can see
 * stale stock for up to this long — acceptable since the master is the source
 * of truth and deducts stock immediately on every sale.
 */
const CATALOG_PUSH_DEBOUNCE_MS = 60_000

/**
 * Watch the local catalog tables and re-push to helpers whenever anything
 * changes (stock deductions, price/product edits, …). Debounced so a burst of
 * updates collapses into a single push. The first emission (current state) is
 * skipped because go-live already pushed it.
 */
function startCatalogAutoPush(): void {
  stopCatalogAutoPush()
  let first = true
  const sub = liveQuery(() => gatherCatalogSnapshot()).subscribe({
    next: (snapshot) => {
      if (first) { first = false; return }
      if (_catalogPushTimer) clearTimeout(_catalogPushTimer)
      _catalogPushTimer = setTimeout(() => {
        _catalogPushTimer = null
        void transport.pushCatalog(snapshot).catch((err) =>
          console.warn('[store] auto pushCatalog failed (best-effort):', err),
        )
      }, CATALOG_PUSH_DEBOUNCE_MS)
    },
    error: (err) => console.warn('[store] catalog liveQuery error:', err),
  })
  _catalogPushUnsub = () => sub.unsubscribe()
}

function stopCatalogAutoPush(): void {
  if (_catalogPushTimer) { clearTimeout(_catalogPushTimer); _catalogPushTimer = null }
  if (_catalogPushUnsub) { _catalogPushUnsub(); _catalogPushUnsub = null }
}

export type Screen =
  | 'pos'
  | 'checkout'
  | 'history'
  | 'settings'
  | 'products'
  | 'addProduct'
  | 'categories'
  | 'donate'
  | 'install'
  | 'events'
  | 'sets'
  | 'dashboard'
  | 'changelog'
  | 'backups'
  | 'booth'

interface AppState {
  // navigation
  screen: Screen
  editProductId: string | null
  go: (s: Screen, editId?: string | null) => void

  // booth / online mode
  boothRole: BoothRole
  boothStatus: BoothStatus
  boothCode: string
  boothMembers: BoothMember[]
  /**
   * Catalog received from master via Firestore (helper side).
   * null when booth is off or this device is the master.
   * Phase 3 will wire this into PosScreen so helpers see master's catalog.
   */
  remoteCatalog: CatalogSnapshot | null
  /**
   * Sales completed in the current booth session (any device).
   * Populated via the Firestore sales subscription — updated by upsert so
   * master's own pushed sales don't duplicate.
   * Cleared when booth ends.
   */
  sessionSales: Sale[]
  /** Room code prefilled from a scanned QR deep-link (?booth=CODE); '' when none. */
  pendingJoinCode: string
  setPendingJoinCode: (v: string) => void
  /** Go live as the master device. Creates a room via transport and updates local state. */
  goLiveAsMaster: () => Promise<void>
  /** Join an existing room as a helper device using the given room code and optional display name. */
  joinAsHelper: (code: string, name?: string) => Promise<void>
  /** Rejoin a saved booth session after a page reload (no-op if none). */
  restoreBooth: () => Promise<void>
  /** End the booth session (master) or leave it (helper). Resets all booth state. */
  endBooth: () => Promise<void>
  /** Kick a member from the room (master-only). */
  kickMember: (id: string) => Promise<void>
  /**
   * Re-push the current Dexie catalog to Firestore (master-only).
   * Useful when the master edits products/prices mid-session and wants helpers
   * to see the updated catalog immediately.
   */
  republishCatalog: () => Promise<void>

  // owner filter on products page ('all' | 'none' | ownerId)
  ownerFilter: string
  setOwnerFilter: (v: string) => void

  // cart: productId -> qty
  cart: Record<string, number>
  addToCart: (id: string) => void
  decCart: (id: string) => void
  removeCart: (id: string) => void
  // setCart: setId -> qty (fixed combos)
  setCart: Record<string, number>
  addSet: (id: string) => void
  decSet: (id: string) => void
  removeSet: (id: string) => void
  clearCart: () => void

  // current event
  currentEventId: string
  setCurrentEvent: (id: string) => void

  // toast
  toast: string
  toastKey: number
  showToast: (msg: string) => void
}

export const useApp = create<AppState>((set) => ({
  screen: 'pos',
  editProductId: null,
  go: (screen, editId = null) => set({ screen, editProductId: editId }),

  ownerFilter: 'all',
  setOwnerFilter: (v) => set({ ownerFilter: v }),

  cart: {},
  addToCart: (id) =>
    set((s) => ({ cart: { ...s.cart, [id]: (s.cart[id] ?? 0) + 1 } })),
  decCart: (id) =>
    set((s) => {
      const n = (s.cart[id] ?? 0) - 1
      const cart = { ...s.cart }
      if (n <= 0) delete cart[id]
      else cart[id] = n
      return { cart }
    }),
  removeCart: (id) =>
    set((s) => {
      const cart = { ...s.cart }
      delete cart[id]
      return { cart }
    }),

  setCart: {},
  addSet: (id) =>
    set((s) => ({ setCart: { ...s.setCart, [id]: (s.setCart[id] ?? 0) + 1 } })),
  decSet: (id) =>
    set((s) => {
      const n = (s.setCart[id] ?? 0) - 1
      const setCart = { ...s.setCart }
      if (n <= 0) delete setCart[id]
      else setCart[id] = n
      return { setCart }
    }),
  removeSet: (id) =>
    set((s) => {
      const setCart = { ...s.setCart }
      delete setCart[id]
      return { setCart }
    }),

  clearCart: () => set({ cart: {}, setCart: {} }),

  currentEventId: '',
  setCurrentEvent: (id) => {
    set({ currentEventId: id })
    void setSetting('currentEventId', id)
  },

  toast: '',
  toastKey: 0,
  showToast: (msg) => set((s) => ({ toast: msg, toastKey: s.toastKey + 1 })),

  // ── Booth / online mode ────────────────────────────────────────────────
  // Default: booth mode is OFF. The existing offline flow is completely unaffected.
  boothRole: 'off',
  boothStatus: 'offline',
  boothCode: '',
  boothMembers: [],
  remoteCatalog: null,
  sessionSales: [],
  pendingJoinCode: '',
  setPendingJoinCode: (v) => set({ pendingJoinCode: v }),

  goLiveAsMaster: async () => {
    set({ boothStatus: 'connecting', boothRole: 'master' })
    try {
      // Rollback point capturing stock BEFORE the booth session starts.
      // Restorable from the "สำรองในเครื่อง" screen if stock goes wrong.
      try { await createSnapshot('before-booth') } catch (err) {
        console.warn('[store] before-booth snapshot failed (best-effort):', err)
      }

      const code = await transport.createRoom()

      // ── Membership (Phase 4) ─────────────────────────────────────────
      // Register as a member BEFORE pushing the catalog: pushCatalog's ghost
      // cleanup reads the products collection, and the hardened rules only
      // allow that read for a member of the room.
      const masterName = (await getSetting('shopName', '')) || 'เครื่องหลัก'
      await transport.registerMember(masterName, 'master')

      _membersUnsub?.()
      _membersUnsub = transport.subscribeMembers((m) => set({ boothMembers: m }))

      // Gather current catalog from Dexie and push to the cloud room
      const catalogSnapshot = await gatherCatalogSnapshot()
      await transport.pushCatalog(catalogSnapshot)

      set({ boothStatus: 'live', boothCode: code })
      saveBoothSession('master', code, masterName)

      // ── Sales sync (Phase 3) ──────────────────────────────────────────
      // Attach outbox auto-flush (idempotent) and do an immediate flush
      // in case any sales were queued while offline.
      initOutboxAutoFlush()
      void flushOutbox()

      // Subscribe to the room's sales log. Master deducts stock for any NEW
      // sale (own sales are already deducted locally + present in db.sales).
      _salesUnsub?.()
      _salesUnsub = transport.subscribeSales((sale) => { void handleMasterSale(sale) })

      // Real-time: re-push catalog to helpers whenever stock/products change.
      startCatalogAutoPush()
    } catch (err) {
      console.error('[store] goLiveAsMaster failed:', err)
      const code = (err as { code?: string })?.code
      const msg = (err as { message?: string })?.message ?? String(err)
      useApp.getState().showToast('เปิดบูธไม่สำเร็จ: ' + (code ? code + ' — ' : '') + msg)
      set({ boothRole: 'off', boothStatus: 'offline', boothCode: '' })
    }
  },

  joinAsHelper: async (code: string, name = 'ผู้ช่วย') => {
    set({ boothStatus: 'connecting', boothRole: 'helper', boothCode: code })
    try {
      await transport.joinRoom(code)

      // ── Membership (Phase 4) ─────────────────────────────────────────
      // Register as a member FIRST — the hardened Firestore rules only allow
      // reading catalog/sales once this device is in the room's member list.
      await transport.registerMember(name, 'helper')

      _membersUnsub?.()
      _membersUnsub = transport.subscribeMembers((m) => set({ boothMembers: m }))

      _selfUnsub?.()
      _selfUnsub = transport.subscribeSelfMembership(() => {
        useApp.getState().showToast('ถูกนำออกจากบูธแล้ว')
        void useApp.getState().endBooth()
      })

      // Subscribe to catalog updates from master (after membership exists)
      _catalogUnsub = transport.subscribeCatalog((cat) => {
        console.debug('[store] remoteCatalog updated — products:', cat.products.length)
        set({ remoteCatalog: cat })
      })

      set({ boothStatus: 'live' })
      saveBoothSession('helper', code, name)

      // ── Sales sync (Phase 3) ──────────────────────────────────────────
      // Attach outbox auto-flush (idempotent) and do an immediate flush
      // for any sales queued while offline during this session.
      initOutboxAutoFlush()
      void flushOutbox()

      // Subscribe to the room's sales log. Helper does NOT write db.sales —
      // only the master's personal history receives the union. The helper
      // only tracks sessionSales for the current in-progress confirmation UI.
      _salesUnsub?.()
      _salesUnsub = transport.subscribeSales((sale) => {
        // Intentionally no db.sales.put() here — helper keeps own db clean.
        set((s) => ({ sessionSales: upsertById(s.sessionSales, sale) }))
      })
    } catch (err) {
      console.error('[store] joinAsHelper failed:', err)
      // Clean up subscriptions if set before the error
      if (_catalogUnsub) { _catalogUnsub(); _catalogUnsub = null }
      if (_membersUnsub) { _membersUnsub(); _membersUnsub = null }
      if (_selfUnsub) { _selfUnsub(); _selfUnsub = null }
      const code = (err as { code?: string })?.code
      const msg = (err as { message?: string })?.message ?? String(err)
      useApp.getState().showToast('เข้าร่วมบูธไม่สำเร็จ: ' + (code ? code + ' — ' : '') + msg)
      set({ boothRole: 'off', boothStatus: 'offline', boothCode: '', remoteCatalog: null })
    }
  },

  /**
   * Rejoin the active booth session after a page reload (state is otherwise
   * in-memory only). Reads the saved { role, code }, re-establishes the room
   * and subscriptions. If the room is gone/closed, clears the saved session.
   */
  restoreBooth: async () => {
    const raw = await getSetting(BOOTH_SESSION_KEY, '')
    if (!raw) return
    let saved: { role?: BoothRole; code?: string; name?: string }
    try { saved = JSON.parse(raw) } catch { clearBoothSession(); return }
    const role = saved.role
    const code = saved.code
    if ((role !== 'master' && role !== 'helper') || !code) { clearBoothSession(); return }

    const defaultName = role === 'master' ? 'เครื่องหลัก' : 'ผู้ช่วย'
    const name = saved.name || defaultName

    set({ boothStatus: 'connecting', boothRole: role, boothCode: code })
    try {
      // joinRoom validates the room exists + is not closed, and (re)sets the
      // transport's current room code. Works for master resuming its own room.
      await transport.joinRoom(code)

      // Re-register membership FIRST (hardened rules gate catalog/sales reads on it)
      await transport.registerMember(name, role)

      _membersUnsub?.()
      _membersUnsub = transport.subscribeMembers((m) => set({ boothMembers: m }))

      if (role === 'helper') {
        _selfUnsub?.()
        _selfUnsub = transport.subscribeSelfMembership(() => {
          useApp.getState().showToast('ถูกนำออกจากบูธแล้ว')
          void useApp.getState().endBooth()
        })
        _catalogUnsub = transport.subscribeCatalog((cat) => set({ remoteCatalog: cat }))
      }

      initOutboxAutoFlush()
      void flushOutbox()

      _salesUnsub?.()
      _salesUnsub = transport.subscribeSales((sale) => {
        if (role === 'master') { void handleMasterSale(sale); return }
        set((s) => ({ sessionSales: upsertById(s.sessionSales, sale) }))
      })

      // Real-time catalog auto-push resumes for the master on restore.
      if (role === 'master') startCatalogAutoPush()

      set({ boothStatus: 'live' })
    } catch (err) {
      console.warn('[store] restoreBooth: room unavailable, clearing session', err)
      if (_catalogUnsub) { _catalogUnsub(); _catalogUnsub = null }
      if (_membersUnsub) { _membersUnsub(); _membersUnsub = null }
      if (_selfUnsub) { _selfUnsub(); _selfUnsub = null }
      clearBoothSession()
      set({ boothRole: 'off', boothStatus: 'offline', boothCode: '', remoteCatalog: null, sessionSales: [] })
    }
  },

  endBooth: async () => {
    const { boothRole: role, boothCode: code } = useApp.getState()
    // Tear down all subscriptions
    if (_membersUnsub) { _membersUnsub(); _membersUnsub = null }
    if (_selfUnsub) { _selfUnsub(); _selfUnsub = null }
    if (_catalogUnsub) { _catalogUnsub(); _catalogUnsub = null }
    if (_salesUnsub) { _salesUnsub(); _salesUnsub = null }
    stopCatalogAutoPush()
    clearBoothSession()
    // Remove our own member record (best-effort).
    await transport.leaveMember()
    // Only the MASTER closes the room. A helper leaving (or being kicked)
    // must NOT close the room for everyone else.
    if (role === 'master') {
      await transport.endRoom()
      // Clean up this room's outbox rows — the master's db.sales already holds
      // all pushed sales, so locally-queued entries for this code are no longer needed.
      if (code) {
        try {
          await db.outbox.where('roomCode').equals(code).delete()
          console.debug('[store] endBooth: cleared outbox for room', code)
        } catch (err) {
          console.warn('[store] endBooth: outbox cleanup failed (best-effort):', err)
        }
      }
    }
    set({ boothRole: 'off', boothStatus: 'offline', boothCode: '', boothMembers: [], remoteCatalog: null, sessionSales: [] })
  },

  kickMember: async (id: string) => {
    // TODO(phase 2+): master-only; the Firebase transport will enforce this server-side
    await transport.kickMember(id)
    set((s) => ({ boothMembers: s.boothMembers.filter((m) => m.id !== id) }))
  },

  republishCatalog: async () => {
    const { boothRole, showToast } = useApp.getState()
    if (boothRole !== 'master') return
    try {
      const snapshot = await gatherCatalogSnapshot()
      await transport.pushCatalog(snapshot)
      showToast('อัปเดตสินค้าให้ผู้ช่วยแล้ว')
    } catch (err) {
      console.error('[store] republishCatalog failed:', err)
      showToast('อัปเดตสินค้าไม่สำเร็จ — ลองใหม่อีกครั้ง')
    }
  },
}))
