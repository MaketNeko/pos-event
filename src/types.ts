export interface Owner {
  id: string
  name: string
  order: number
}

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
  ownerId?: string // ฝากขาย — id ของเจ้าของ (ไม่มี = ของร้าน)
}

export interface Event {
  id: string
  name: string
  date: string // ISO yyyy-mm-dd
  createdAt: number
}

export interface SetComponent {
  productId: string
  qty: number
}

export interface ProductSet {
  id: string
  name: string
  type: 'fixed' | 'mix' // fixed = combo; mix = N items for a price
  price: number
  active: boolean
  order: number
  items?: SetComponent[] // fixed: exact components
  productIds?: string[] // mix: eligible products
  n?: number // mix: items per bundle
}

export interface SaleItem {
  kind: 'product' | 'set'
  refId: string // productId or setId
  name: string
  price: number
  qty: number
  ownerId?: string    // สแนปชอต ณ เวลาขาย (เฉพาะ kind:'product')
  ownerName?: string  // สแนปชอต ณ เวลาขาย (เฉพาะ kind:'product')
}

export interface Sale {
  id: string
  eventId: string
  eventName: string
  items: SaleItem[]
  subtotal: number
  setDiscount: number // saved by mix & match promos
  discount: number // manual bill discount
  total: number
  method: 'promptpay' | 'cash'
  createdAt: number // epoch ms
}

export interface Setting {
  key: string
  value: string
}

export interface SnapshotData {
  categories: Category[]
  products: Product[]
  events: Event[]
  sales: Sale[]
  settings: Setting[]
  sets: ProductSet[]
  owners: Owner[]
}

export interface Backup {
  id: string
  createdAt: number // epoch ms
  reason: 'auto' | 'manual' | 'before-restore'
  data: SnapshotData
}
