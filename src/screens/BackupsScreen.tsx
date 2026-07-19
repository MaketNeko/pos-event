import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../store'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconDatabase, IconClock, IconTrash } from '../components/Icons'
import { listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot } from '../lib/backup'
import type { Backup } from '../types'

const REASON_LABEL: Record<Backup['reason'], string> = {
  auto: 'อัตโนมัติ',
  manual: 'สำรองเอง',
  'before-restore': 'ก่อนกู้คืน',
}

function snapLabel(b: Backup): string {
  const when = new Date(b.createdAt).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return `${when} · ${REASON_LABEL[b.reason]}`
}

export function BackupsScreen() {
  const showToast = useApp((s) => s.showToast)
  const snapshots = useLiveQuery(() => listSnapshots(), [])

  async function snapshotNow() {
    await createSnapshot('manual')
    showToast('สำรองในเครื่องแล้ว')
  }

  async function rollback(b: Backup) {
    if (!window.confirm(`ย้อนกลับไปจุดสำรองนี้? ข้อมูลปัจจุบันจะถูกเขียนทับ\n(${snapLabel(b)})`)) return
    await restoreSnapshot(b.id)
    showToast('ย้อนกลับแล้ว')
  }

  const list = snapshots ?? []

  return (
    <>
      <ScreenHeader title="สำรองในเครื่อง" subtitle="จุดย้อนกลับ" back="settings" />

      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-[18px]">
        <button
          onClick={() => void snapshotNow()}
          className="mb-4 flex w-full items-center gap-3.5 rounded-2xl border border-divider/10 bg-surface px-4 py-3.5 text-left active:bg-surface-2"
        >
          <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-electrum/10 text-electrum">
            <IconDatabase width={18} height={18} />
          </div>
          <div>
            <div className="text-sm">สำรองตอนนี้</div>
            <div className="mt-px text-[11px] text-pewter">เก็บจุดย้อนกลับไว้ในเครื่อง</div>
          </div>
        </button>

        <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-pewter">
          จุดสำรอง
        </div>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-divider/10 bg-surface px-4 py-6 text-center text-[12px] text-pewter">
            ยังไม่มีจุดสำรอง — ระบบจะเก็บอัตโนมัติเมื่อเปิดแอป
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-divider/10 bg-surface">
            {list.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3.5 border-b border-divider/10 px-4 py-3 last:border-b-0"
              >
                <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-electrum/10 text-electrum">
                  <IconClock width={16} height={16} />
                </div>
                <button onClick={() => void rollback(b)} className="min-w-0 flex-1 text-left active:opacity-70">
                  <div className="text-sm">{snapLabel(b)}</div>
                  <div className="mt-px text-[11px] text-pewter">แตะเพื่อย้อนกลับ</div>
                </button>
                <button
                  onClick={() => void deleteSnapshot(b.id)}
                  className="grid h-9 w-9 flex-none place-items-center rounded-lg text-danger active:bg-surface-2"
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 px-1 text-[11px] leading-relaxed text-pewter">
          จุดสำรองเก็บในเครื่องนี้เท่านั้น เป็นตัวช่วยย้อนกลับ ไม่ใช่ไฟล์สำรอง —
          ถ้าเครื่องหายหรือล้างข้อมูลเบราว์เซอร์ ให้พึ่งไฟล์สำรองในหน้าตั้งค่า
        </div>
      </div>
    </>
  )
}
