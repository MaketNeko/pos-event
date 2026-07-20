import { create } from 'zustand'
import { db, setSetting, getSetting } from './db'
import { transport } from './sync'
import { initOutboxAutoFlush, flushOutbox } from './sync/outbox'
import type { BoothRole, BoothStatus, BoothMember, CatalogSnapshot } from './sync'
import type { Sale } from './types'

/**
 * Module-level variables for unsubscribe fns.
 * Not exposed in the store interface — cleaned up by endBooth.
 */
let _catalogUnsub: (() => void) | null = null
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
      const code = await transport.createRoom()

      // Gather current catalog from Dexie
      const [products, categories, sets, owners] = await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
        db.sets.toArray(),
        db.owners.toArray(),
      ])

      // Resolve current event name (best-effort; empty string if not set)
      const state = useApp.getState()
      const currentEventId = state.currentEventId
      let eventName = ''
      if (currentEventId) {
        const ev = await db.events.get(currentEventId)
        eventName = ev?.name ?? ''
      }

      await transport.pushCatalog({ products, categories, sets, owners, eventId: currentEventId, eventName })

      // ── Membership (Phase 4) ─────────────────────────────────────────
      const masterName = (await getSetting('shopName', '')) || 'เครื่องหลัก'
      await transport.registerMember(masterName, 'master')

      _membersUnsub?.()
      _membersUnsub = transport.subscribeMembers((m) => set({ boothMembers: m }))

      set({ boothStatus: 'live', boothCode: code })
      saveBoothSession('master', code, masterName)

      // ── Sales sync (Phase 3) ──────────────────────────────────────────
      // Attach outbox auto-flush (idempotent) and do an immediate flush
      // in case any sales were queued while offline.
      initOutboxAutoFlush()
      void flushOutbox()

      // Subscribe to the room's sales log. Master writes incoming sales
      // into its own db.sales (union by id — put is idempotent).
      _salesUnsub?.()
      _salesUnsub = transport.subscribeSales((sale) => {
        void db.sales.put(sale)
        set((s) => ({ sessionSales: upsertById(s.sessionSales, sale) }))
      })
    } catch (err) {
      console.error('[store] goLiveAsMaster failed:', err)
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
        if (role === 'master') void db.sales.put(sale)
        set((s) => ({ sessionSales: upsertById(s.sessionSales, sale) }))
      })

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
    const role = useApp.getState().boothRole
    // Tear down all subscriptions
    if (_membersUnsub) { _membersUnsub(); _membersUnsub = null }
    if (_selfUnsub) { _selfUnsub(); _selfUnsub = null }
    if (_catalogUnsub) { _catalogUnsub(); _catalogUnsub = null }
    if (_salesUnsub) { _salesUnsub(); _salesUnsub = null }
    clearBoothSession()
    // Remove our own member record (best-effort).
    await transport.leaveMember()
    // Only the MASTER closes the room. A helper leaving (or being kicked)
    // must NOT close the room for everyone else.
    if (role === 'master') await transport.endRoom()
    set({ boothRole: 'off', boothStatus: 'offline', boothCode: '', boothMembers: [], remoteCatalog: null, sessionSales: [] })
  },

  kickMember: async (id: string) => {
    // TODO(phase 2+): master-only; the Firebase transport will enforce this server-side
    await transport.kickMember(id)
    set((s) => ({ boothMembers: s.boothMembers.filter((m) => m.id !== id) }))
  },
}))
