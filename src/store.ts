import { create } from 'zustand'
import { setSetting } from './db'
import { transport } from './sync'
import type { BoothRole, BoothStatus, BoothMember } from './sync'

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
  /** Go live as the master device. Creates a room via transport and updates local state. */
  goLiveAsMaster: () => Promise<void>
  /** Join an existing room as a helper device using the given room code. */
  joinAsHelper: (code: string) => Promise<void>
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

  goLiveAsMaster: async () => {
    // TODO(phase 2+): also authenticate (Firebase Anonymous Auth) before createRoom
    set({ boothStatus: 'connecting', boothRole: 'master' })
    try {
      const code = await transport.createRoom()
      const members = await transport.listMembers()
      set({ boothStatus: 'live', boothCode: code, boothMembers: members })
    } catch {
      set({ boothRole: 'off', boothStatus: 'offline', boothCode: '' })
    }
  },

  joinAsHelper: async (code: string) => {
    // TODO(phase 2+): also authenticate (Firebase Anonymous Auth) before joinRoom
    set({ boothStatus: 'connecting', boothRole: 'helper', boothCode: code })
    try {
      await transport.joinRoom(code)
      const members = await transport.listMembers()
      set({ boothStatus: 'live', boothMembers: members })
    } catch {
      set({ boothRole: 'off', boothStatus: 'offline', boothCode: '' })
    }
  },

  endBooth: async () => {
    // TODO(phase 2+): call transport.endRoom() for master, or a leaveRoom() for helper
    await transport.endRoom()
    set({ boothRole: 'off', boothStatus: 'offline', boothCode: '', boothMembers: [] })
  },

  kickMember: async (id: string) => {
    // TODO(phase 2+): master-only; the Firebase transport will enforce this server-side
    await transport.kickMember(id)
    set((s) => ({ boothMembers: s.boothMembers.filter((m) => m.id !== id) }))
  },
}))
