import type { Product, ProductSet } from '../types'

/** Max number of a fixed combo that can be sold given component stock. */
export function setAvailable(set: ProductSet, products: Product[]): number {
  if (set.type !== 'fixed' || !set.items?.length) return 0
  let min = Infinity
  for (const c of set.items) {
    const p = products.find((x) => x.id === c.productId)
    if (!p || c.qty <= 0) return 0
    min = Math.min(min, Math.floor(p.stock / c.qty))
  }
  return min === Infinity ? 0 : min
}

export interface MixResult {
  discount: number
  perSet: { set: ProductSet; bundles: number; saved: number }[]
}

/**
 * Mix & match: for each mix set, every N eligible units in the cart are
 * charged the bundle price; leftover (< N) units stay at normal price.
 * The most expensive units are bundled first (best deal for the customer).
 */
export function computeMix(
  mixSets: ProductSet[],
  cart: Record<string, number>,
  products: Product[],
): MixResult {
  let discount = 0
  const perSet: MixResult['perSet'] = []
  for (const set of mixSets) {
    if (set.type !== 'mix' || !set.n || set.n <= 0 || !set.productIds?.length) continue
    const units: number[] = []
    for (const pid of set.productIds) {
      const qty = cart[pid] ?? 0
      const p = products.find((x) => x.id === pid)
      if (!p || qty <= 0) continue
      for (let i = 0; i < qty; i++) units.push(p.price)
    }
    const bundles = Math.floor(units.length / set.n)
    if (bundles <= 0) continue
    units.sort((a, b) => b - a)
    const covered = bundles * set.n
    const normalSum = units.slice(0, covered).reduce((a, b) => a + b, 0)
    const saved = Math.max(0, normalSum - bundles * set.price)
    if (saved > 0) {
      discount += saved
      perSet.push({ set, bundles, saved })
    }
  }
  return { discount: Math.round(discount), perSet }
}
