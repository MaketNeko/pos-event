import { db, uid } from '../db'
import type { Backup, SnapshotData } from '../types'

// เก็บสแนปช็อตในเครื่องกี่อันต่อชนิด (กันบวมของ IndexedDB)
const KEEP: Record<Backup['reason'], number> = {
  auto: 5,
  'before-restore': 3,
  manual: 10,
}

// เว้นระยะ auto-snapshot อย่างน้อย 12 ชม. ต่ออัน
const AUTO_INTERVAL = 12 * 60 * 60 * 1000

/** รวมข้อมูลทุกตารางเป็นก้อนเดียว (ใช้ทั้ง export ไฟล์ และสแนปช็อตในเครื่อง) */
export async function collectData(): Promise<SnapshotData> {
  const [categories, products, events, sales, settings, sets, owners] = await Promise.all([
    db.categories.toArray(),
    db.products.toArray(),
    db.events.toArray(),
    db.sales.toArray(),
    db.settings.toArray(),
    db.sets.toArray(),
    db.owners.toArray(),
  ])
  return { categories, products, events, sales, settings, sets, owners }
}

/**
 * เขียนข้อมูลกลับเข้า db
 * - replace = ล้างของเดิมแล้วเขียนใหม่ทั้งหมด
 * - merge   = เขียนทับเฉพาะ id ที่ซ้ำ ไม่ลบของเดิมที่ไม่มีในไฟล์
 */
export async function applyData(data: Partial<SnapshotData>, mode: 'replace' | 'merge') {
  await db.transaction(
    'rw',
    [db.categories, db.products, db.events, db.sales, db.settings, db.sets, db.owners],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.categories.clear(), db.products.clear(), db.events.clear(),
          db.sales.clear(), db.settings.clear(), db.sets.clear(), db.owners.clear(),
        ])
        await db.categories.bulkAdd(data.categories ?? [])
        await db.products.bulkAdd(data.products ?? [])
        await db.events.bulkAdd(data.events ?? [])
        await db.sales.bulkAdd(data.sales ?? [])
        await db.settings.bulkAdd(data.settings ?? [])
        await db.sets.bulkAdd(data.sets ?? [])
        await db.owners.bulkAdd(data.owners ?? [])
      } else {
        await db.categories.bulkPut(data.categories ?? [])
        await db.products.bulkPut(data.products ?? [])
        await db.events.bulkPut(data.events ?? [])
        await db.sales.bulkPut(data.sales ?? [])
        await db.settings.bulkPut(data.settings ?? [])
        await db.sets.bulkPut(data.sets ?? [])
        await db.owners.bulkPut(data.owners ?? [])
      }
    },
  )
}

/** ตัดสแนปช็อตเก่าที่เกินโควตาแต่ละชนิดออก */
async function prune() {
  const all = await db.backups.orderBy('createdAt').reverse().toArray()
  const seen: Record<string, number> = {}
  const drop: string[] = []
  for (const b of all) {
    seen[b.reason] = (seen[b.reason] ?? 0) + 1
    if (seen[b.reason] > (KEEP[b.reason] ?? 5)) drop.push(b.id)
  }
  if (drop.length) await db.backups.bulkDelete(drop)
}

/** สร้างสแนปช็อตในเครื่อง 1 อัน คืนค่า id */
export async function createSnapshot(reason: Backup['reason']): Promise<string> {
  const data = await collectData()
  const id = uid()
  await db.backups.add({ id, createdAt: Date.now(), reason, data })
  await prune()
  return id
}

/** เก็บ auto-snapshot ถ้าเว้นระยะพอ และมีข้อมูลให้เก็บจริง (เรียกตอนเปิดแอป) */
export async function autoSnapshot() {
  const count = (await db.products.count()) + (await db.sales.count())
  if (count === 0) return // ยังไม่มีข้อมูล ไม่ต้องเก็บ
  const recent = await db.backups.orderBy('createdAt').reverse().toArray()
  const lastAuto = recent.find((b) => b.reason === 'auto')
  if (lastAuto && Date.now() - lastAuto.createdAt < AUTO_INTERVAL) return
  await createSnapshot('auto')
}

export function listSnapshots(): Promise<Backup[]> {
  return db.backups.orderBy('createdAt').reverse().toArray()
}

/** กู้คืนจากสแนปช็อตในเครื่อง — เก็บสแนปช็อต before-restore ไว้ก่อนกันพลาด */
export async function restoreSnapshot(id: string): Promise<boolean> {
  const b = await db.backups.get(id)
  if (!b) return false
  await createSnapshot('before-restore')
  await applyData(b.data, 'replace')
  return true
}

export function deleteSnapshot(id: string): Promise<void> {
  return db.backups.delete(id)
}
