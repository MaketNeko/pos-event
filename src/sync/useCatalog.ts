/**
 * src/sync/useCatalog.ts
 *
 * Phase 3a: Single seam for catalog data in PosScreen + CheckoutScreen.
 *
 * - Helper device: derives catalog from remoteCatalog (Firestore snapshot).
 *   Maps thumb → image so existing `p.image ? <img> : initial` rendering works.
 *   Returns empty arrays until the first snapshot arrives.
 * - Master / non-booth (off): returns the same live Dexie queries the screens
 *   have always used. No behavior change on this path.
 *
 * IMPORTANT: both useLiveQuery calls are always executed (rules of hooks).
 * The return value is chosen by role, not the call itself.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import { useApp } from '../store'
import type { Product, Category, ProductSet, Owner } from '../types'

export interface CatalogData {
  products: Product[]
  categories: Category[]
  sets: ProductSet[]
  owners: Owner[]
  /** eventName from the master's snapshot (helper path only; '' otherwise). */
  eventName: string
  /** True when this device is a helper reading from remoteCatalog. */
  isHelper: boolean
}

export function useCatalogData(): CatalogData {
  const boothRole = useApp((s) => s.boothRole)
  const remoteCatalog = useApp((s) => s.remoteCatalog)

  // ── Always run these queries (rules of hooks) ──────────────────────────────
  const dbCategories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const dbProducts = useLiveQuery(() => db.products.orderBy('order').toArray(), [])
  const dbSets = useLiveQuery(() => db.sets.orderBy('order').toArray(), [])
  const dbOwners = useLiveQuery(() => db.owners.toArray(), [])

  // ── Helper path: derive from remoteCatalog ─────────────────────────────────
  // useMemo so sort/map only re-runs when remoteCatalog changes, not on every render.
  const helperProducts = useMemo<Product[]>(() => {
    if (!remoteCatalog) return []
    // Map thumb → image; keep all other Product fields intact.
    return [...remoteCatalog.products]
      .sort((a, b) => a.order - b.order)
      .map((p) => {
        // remoteCatalog products have `thumb?` instead of `image?`.
        // Cast to access the extra field without polluting the Product type.
        const raw = p as Product & { thumb?: string }
        const { thumb, ...rest } = raw as Product & { thumb?: string }
        return thumb ? { ...rest, image: thumb } : rest
      })
  }, [remoteCatalog])

  const helperCategories = useMemo<Category[]>(() => {
    if (!remoteCatalog) return []
    return [...remoteCatalog.categories].sort((a, b) => a.order - b.order)
  }, [remoteCatalog])

  const helperSets = useMemo<ProductSet[]>(() => {
    if (!remoteCatalog) return []
    return [...remoteCatalog.sets].sort((a, b) => a.order - b.order)
  }, [remoteCatalog])

  const helperOwners = useMemo<Owner[]>(() => {
    if (!remoteCatalog) return []
    return remoteCatalog.owners
  }, [remoteCatalog])

  // ── Return based on role ───────────────────────────────────────────────────
  if (boothRole === 'helper') {
    return {
      products: helperProducts,
      categories: helperCategories,
      sets: helperSets,
      owners: helperOwners,
      eventName: remoteCatalog?.eventName ?? '',
      isHelper: true,
    }
  }

  // Master / off — return live Dexie data exactly as screens already used it.
  return {
    products: dbProducts ?? [],
    categories: dbCategories ?? [],
    sets: dbSets ?? [],
    owners: dbOwners ?? [],
    eventName: '',
    isHelper: false,
  }
}
