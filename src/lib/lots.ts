import { db, uid } from '../db'

/**
 * ตัด lot ของสินค้าแบบ FIFO (เก่าสุดก่อน) ตามจำนวนที่ขาย แล้วคืนค่า "ต้นทุนรวม"
 * ของจำนวนนั้น ต้องเรียกภายใน transaction ที่ครอบ db.lots
 *
 * ถ้า lot มีไม่พอ (เช่น สต็อกถูกแก้ตรง ๆ โดยไม่ผ่าน lot หรือกู้ backup เก่า)
 * ส่วนที่เกินจะคิดต้นทุนเท่า lot ล่าสุดของสินค้านั้น (ไม่มี lot เลย = 0)
 */
export async function consumeFIFO(productId: string, qty: number): Promise<number> {
  if (qty <= 0) return 0
  const lots = await db.lots.where('productId').equals(productId).sortBy('createdAt')
  let remaining = qty
  let cogs = 0
  for (const lot of lots) {
    if (remaining <= 0) break
    if (lot.qtyLeft <= 0) continue
    const take = Math.min(lot.qtyLeft, remaining)
    cogs += take * lot.cost
    remaining -= take
    await db.lots.update(lot.id, { qtyLeft: lot.qtyLeft - take })
  }
  if (remaining > 0 && lots.length > 0) {
    cogs += remaining * lots[lots.length - 1].cost
  }
  return cogs
}

/** รับของเข้า: สร้าง lot ใหม่ + บวกสต็อกสินค้าตามจำนวน */
export async function addLot(productId: string, qty: number, cost: number, note?: string): Promise<void> {
  await db.transaction('rw', db.lots, db.products, async () => {
    await db.lots.add({
      id: uid(),
      productId,
      qtyIn: qty,
      qtyLeft: qty,
      cost,
      note: note?.trim() || undefined,
      createdAt: Date.now(),
    })
    const p = await db.products.get(productId)
    if (p) await db.products.update(productId, { stock: p.stock + qty })
  })
}

/**
 * ปรับจำนวนคงเหลือของ lot ทีละ delta (ใช้แก้เมื่อลงผิด)
 * ปรับทั้ง qtyLeft/qtyIn และสต็อกสินค้าตามส่วนต่างจริงที่ปรับได้
 */
export async function adjustLotQty(lotId: string, delta: number): Promise<void> {
  await db.transaction('rw', db.lots, db.products, async () => {
    const lot = await db.lots.get(lotId)
    if (!lot) return
    const next = Math.max(0, lot.qtyLeft + delta)
    const applied = next - lot.qtyLeft
    if (applied === 0) return
    await db.lots.update(lotId, { qtyLeft: next, qtyIn: Math.max(0, lot.qtyIn + applied) })
    const p = await db.products.get(lot.productId)
    if (p) await db.products.update(lot.productId, { stock: Math.max(0, p.stock + applied) })
  })
}

/** แก้ต้นทุนต่อชิ้นของ lot */
export function updateLotCost(lotId: string, cost: number): Promise<number> {
  return db.lots.update(lotId, { cost: Math.max(0, cost) })
}

/** แก้โน้ตของ lot */
export function updateLotNote(lotId: string, note: string): Promise<number> {
  return db.lots.update(lotId, { note: note.trim() || undefined })
}

/** ลบ lot — คืนสต็อกสินค้าลงตามจำนวนที่เหลือใน lot นั้น */
export async function deleteLot(lotId: string): Promise<void> {
  await db.transaction('rw', db.lots, db.products, async () => {
    const lot = await db.lots.get(lotId)
    if (!lot) return
    await db.lots.delete(lotId)
    const p = await db.products.get(lot.productId)
    if (p) await db.products.update(lot.productId, { stock: Math.max(0, p.stock - lot.qtyLeft) })
  })
}
