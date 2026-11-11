import type { Owner, Product, SaleItem } from '../types'

export const SHOP_OWNER_KEY = '__shop__'

/**
 * หาเจ้าของของรายการในบิล: ใช้ snapshot ในบิลก่อน; ถ้าบิลไม่มี (ขายก่อนตั้งเจ้าของ)
 * fallback ไปดูเจ้าของปัจจุบันของสินค้า; ไม่เจอ = ของร้าน
 * ใช้ร่วมกันทั้งหน้าสรุปยอดและ CSV ให้ยอดรายเจ้าของตรงกัน
 */
export function makeOwnerResolver(products: Product[], owners: Owner[], shopName: string) {
  const prodOwnerById = new Map(products.map((p) => [p.id, p.ownerId]))
  const ownerNameById = new Map(owners.map((o) => [o.id, o.name]))
  const shop = shopName || 'ของร้าน'
  return (item: SaleItem): { key: string; name: string } => {
    let ownerId = item.ownerId
    let ownerName = item.ownerName
    if (!ownerId) {
      const cur = prodOwnerById.get(item.refId)
      if (cur) { ownerId = cur; ownerName = ownerNameById.get(cur) }
    }
    return { key: ownerId ?? SHOP_OWNER_KEY, name: ownerName ?? shop }
  }
}
