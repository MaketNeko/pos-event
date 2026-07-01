export interface Category {
  id: string
  name: string
  color: string // accent used in POS (border/price/dot)
  bg: string // card background
  text: string // card text
  border: string // card border
  order: number
}

export interface Product {
  id: string
  categoryId: string
  name: string
  price: number
  stock: number
  image?: string // dataURL
  active: boolean // false = ปิดขาย (ซ่อนจากหน้าขาย)
  order: number
}

export interface Event {
  id: string
  name: string
  date: string // ISO yyyy-mm-dd
  createdAt: number
}

export interface SaleItem {
  productId: string
  name: string
  price: number
  qty: number
}

export interface Sale {
  id: string
  eventId: string
  eventName: string
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  method: 'promptpay' | 'cash'
  createdAt: number // epoch ms
}

export interface Setting {
  key: string
  value: string
}
