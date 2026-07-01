import Dexie, { type Table } from 'dexie'
import type { Category, Product, Event, Sale, Setting, ProductSet } from './types'

export class PosDB extends Dexie {
  categories!: Table<Category, string>
  products!: Table<Product, string>
  events!: Table<Event, string>
  sales!: Table<Sale, string>
  settings!: Table<Setting, string>
  sets!: Table<ProductSet, string>

  constructor() {
    super('pos-event')
    this.version(1).stores({
      categories: 'id, order',
      products: 'id, categoryId, order, active',
      events: 'id, date, createdAt',
      sales: 'id, eventId, createdAt',
      settings: 'key',
    })
    this.version(2).stores({
      sets: 'id, order, active, type',
    })
  }
}

export const db = new PosDB()

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// ---- settings helpers ----
export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await db.settings.get(key)
  return row?.value ?? fallback
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}
