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

/**
 * LOT = การรับของเข้า 1 ครั้ง (สต็อกเข้า + ต้นทุนต่อชิ้นของรอบนั้น)
 * ขายตัด lot เก่าสุดก่อน (FIFO) — สต็อกรวมของสินค้า = ผลรวม qtyLeft ของทุก lot
 */
export interface Lot {
  id: string
  productId: string
  qtyIn: number // จำนวนที่รับเข้า (แก้ย้อนหลังได้เมื่อลงผิด)
  qtyLeft: number // คงเหลือใน lot นี้
  cost: number // ต้นทุนต่อชิ้น (บาท)
  note?: string // เช่น "พิมพ์ครั้งที่ 2", "ยอดยกมา"
  createdAt: number
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
  cost?: number       // ต้นทุนรวมของรายการนี้ (ตัด lot แบบ FIFO ณ เวลาขาย)
  origPrice?: number  // ราคาปกติ เมื่อถูกแก้ราคาตอนขาย (ลดตำหนิ/แจกฟรี)
  note?: string       // เหตุผลราคาพิเศษ เช่น "ตำหนิ", "แจกฟรี", "ของเก่า"
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
  lots?: Lot[] // optional — backup เก่าก่อนมีระบบ lot ไม่มีฟิลด์นี้
}

export interface Backup {
  id: string
  createdAt: number // epoch ms
  reason: 'auto' | 'manual' | 'before-restore' | 'before-booth'
  data: SnapshotData
}

/** A sale waiting to be pushed to Firestore (offline-first outbox). id === sale.id */
export interface OutboxItem {
  id: string       // same as sale.id — used as primary key
  roomCode: string // room this sale belongs to
  sale: Sale
  createdAt: number
}
