import { create } from 'zustand'
import { setSetting } from './db'

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

interface AppState {
  // navigation
  screen: Screen
  editProductId: string | null
  go: (s: Screen, editId?: string | null) => void

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
}))
