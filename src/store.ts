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
  clearCart: () => set({ cart: {} }),

  currentEventId: '',
  setCurrentEvent: (id) => {
    set({ currentEventId: id })
    void setSetting('currentEventId', id)
  },

  toast: '',
  toastKey: 0,
  showToast: (msg) => set((s) => ({ toast: msg, toastKey: s.toastKey + 1 })),
}))
