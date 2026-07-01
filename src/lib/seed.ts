import { db, uid } from '../db'
import { todayISO } from './format'
import type { Category } from '../types'

const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'เครื่องดื่ม', color: '#5FB0B7', bg: '#234b52', text: '#CFF0F3', border: '#5FB0B7', order: 0 },
  { name: 'ของคาว', color: '#D98A45', bg: '#4a3320', text: '#FBE6D2', border: '#D98A45', order: 1 },
  { name: 'ของหวาน', color: '#D07AA4', bg: '#45283a', text: '#FBDCEC', border: '#D07AA4', order: 2 },
  { name: 'ของฝาก', color: '#E7CB9C', bg: '#3d3527', text: '#F7ECD8', border: '#E7CB9C', order: 3 },
]

/** Populate first-run data so the app is usable immediately. */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.categories.count()
  if (count > 0) return

  await db.categories.bulkAdd(defaultCategories.map((c) => ({ ...c, id: uid() })))

  const eventId = uid()
  await db.events.add({
    id: eventId,
    name: 'งานแรก',
    date: todayISO(),
    createdAt: Date.now(),
  })

  await db.settings.bulkPut([
    { key: 'shopName', value: 'ร้านของฉัน' },
    { key: 'promptpay', value: '' },
    { key: 'currentEventId', value: eventId },
  ])
}
