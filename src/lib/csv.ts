import type { Category, Owner, Product, ProductSet, Sale, SaleItem } from '../types'
import { isoOf, timeOf } from './format'
import { makeOwnerResolver } from './owner'

type Cell = string | number

const round2 = (n: number): number => Math.round(n * 100) / 100

// กัน CSV injection: ข้อความที่ขึ้นต้นด้วย = + - @ จะถูก Excel รันเป็นสูตร (ตัวเลขติดลบไม่โดน เพราะเป็น number)
const safe = (c: Cell): string => {
  const v = String(c)
  return typeof c === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

function serialize(header: string[], rows: Cell[][]): string {
  return [header, ...rows]
    .map((r) => r.map((c) => `"${safe(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadCSV(filename: string, header: string[], rows: Cell[][]) {
  // BOM ให้ Excel อ่านภาษาไทยถูก
  const blob = new Blob(['﻿' + serialize(header, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // iOS Safari / PWA เริ่มดาวน์โหลดแบบ async — revoke ทันทีจะได้ไฟล์ว่าง
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** แบ่ง amount ตามน้ำหนัก (เฉพาะ index ใน idx) เศษปัดเศษยัดใส่ตัวที่น้ำหนักมากสุด ให้ผลรวมเป๊ะ */
function spread(amount: number, weights: number[], idx: number[]): number[] {
  const out = weights.map(() => 0)
  const sum = idx.reduce((a, i) => a + weights[i], 0)
  if (amount <= 0 || sum <= 0) return out
  for (const i of idx) out[i] = round2((amount * weights[i]) / sum)
  const drift = round2(amount - out.reduce((a, b) => a + b, 0))
  if (drift !== 0) {
    const big = idx.reduce((b, i) => (weights[i] > weights[b] ? i : b), idx[0])
    out[big] = round2(out[big] + drift)
  }
  return out
}

/**
 * กระจายส่วนลดเข้าแต่ละรายการตามสัดส่วนราคา:
 * - ส่วนลดโปรเซ็ต (mix) → เฉพาะสินค้าที่อยู่ในโปร mix (ดูจากเซ็ตปัจจุบัน; บิลไม่ได้เก็บไว้)
 *   ถ้าหาไม่เจอสักรายการ (เซ็ตถูกลบ/แก้) ค่อยเฉลี่ยทุกรายการ
 * - ส่วนลดท้ายบิล (ส่วนที่เหลือ) → ทุกรายการ
 * ผลรวมยอดสุทธิ = sale.total เป๊ะ
 */
export function allocateDiscount(sale: Sale, mixEligible: Set<string> = new Set()): number[] {
  const gross = sale.items.map((i) => i.price * i.qty)
  const all = gross.map((_, i) => i)
  const totalDisc = Math.max(0, round2(gross.reduce((a, b) => a + b, 0) - sale.total))
  const setDisc = Math.min(totalDisc, Math.max(0, sale.setDiscount ?? 0))
  const eligible = all.filter((i) => sale.items[i].kind === 'product' && mixEligible.has(sale.items[i].refId))
  const a = spread(setDisc, gross, eligible.length ? eligible : all)
  const b = spread(round2(totalDisc - setDisc), gross, all)
  return gross.map((_, i) => round2(a[i] + b[i]))
}

export interface CsvContext {
  products: Product[]
  owners: Owner[]
  categories: Category[]
  sets: ProductSet[]
  shopName: string
}

// owner ใช้ตัวเดียวกับหน้าสรุปยอด (lib/owner) ให้ยอดรายเจ้าของตรงกัน
type Lookup = {
  product: Map<string, Product>
  category: Map<string, string>
  owner: ReturnType<typeof makeOwnerResolver>
}

function ownerNameOf(item: SaleItem, lk: Lookup): string {
  if (item.kind === 'set') return '—' // เซ็ตประกอบจากหลายสินค้า ไม่ผูกเจ้าของเดียว
  return lk.owner(item).name
}

function categoryNameOf(item: SaleItem, lk: Lookup): string {
  if (item.kind === 'set') return '—'
  const catId = lk.product.get(item.refId)?.categoryId
  return (catId && lk.category.get(catId)) || '—'
}

const methodLabel = (m: Sale['method']): string => (m === 'cash' ? 'เงินสด' : 'PromptPay')

/** 1 แถว = 1 บิล — ไว้ดูสรุปยอดขายรายบิล */
export const BILL_HEADER = [
  'เลขที่บิล', 'วันที่', 'เวลา', 'งาน', 'รายการ', 'จำนวนชิ้น',
  'ยอดรวม', 'ส่วนลดโปรเซ็ต', 'ส่วนลดท้ายบิล', 'ยอดสุทธิ', 'ต้นทุน', 'กำไร', 'ชำระโดย',
]

export function billRows(sales: Sale[]): Cell[][] {
  return sales.map((s) => {
    const cost = s.items.reduce((a, b) => a + (b.cost ?? 0), 0)
    return [
      s.id,
      isoOf(s.createdAt),
      timeOf(s.createdAt),
      s.eventName,
      s.items.map((i) => `${i.name} x${i.qty}`).join(' | '),
      s.items.reduce((a, b) => a + b.qty, 0),
      s.subtotal,
      s.setDiscount ?? 0,
      s.discount,
      s.total,
      round2(cost),
      round2(s.total - cost),
      methodLabel(s.method),
    ]
  })
}

/** 1 แถว = 1 รายการในบิล — ไว้ทำ pivot วิเคราะห์รายสินค้า/รายเจ้าของ */
export const ITEM_HEADER = [
  'เลขที่บิล', 'วันที่', 'เวลา', 'งาน', 'ประเภทรายการ', 'สินค้า', 'หมวดหมู่', 'เจ้าของ',
  'จำนวน', 'ราคาต่อชิ้น', 'ราคาปกติ', 'หมายเหตุราคา',
  'ยอดก่อนลด', 'ส่วนลดเฉลี่ย', 'ยอดสุทธิ', 'ต้นทุน', 'กำไร', 'ชำระโดย',
]

export function itemRows(sales: Sale[], ctx: CsvContext): Cell[][] {
  const lk: Lookup = {
    product: new Map(ctx.products.map((p) => [p.id, p])),
    category: new Map(ctx.categories.map((c) => [c.id, c.name])),
    owner: makeOwnerResolver(ctx.products, ctx.owners, ctx.shopName),
  }
  const mixEligible = new Set(ctx.sets.filter((x) => x.type === 'mix').flatMap((x) => x.productIds ?? []))
  const out: Cell[][] = []
  for (const s of sales) {
    const alloc = allocateDiscount(s, mixEligible)
    s.items.forEach((item, i) => {
      const gross = item.price * item.qty
      const net = round2(gross - alloc[i])
      const cost = round2(item.cost ?? 0)
      out.push([
        s.id,
        isoOf(s.createdAt),
        timeOf(s.createdAt),
        s.eventName,
        item.kind === 'set' ? 'เซ็ต' : 'สินค้า',
        item.name,
        categoryNameOf(item, lk),
        ownerNameOf(item, lk),
        item.qty,
        item.price,
        item.origPrice ?? item.price,
        item.note ?? '',
        gross,
        alloc[i],
        net,
        cost,
        round2(net - cost),
        methodLabel(s.method),
      ])
    })
  }
  return out
}
