import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db'
import { useApp } from '../store'
import { todayISO, thaiDate } from '../lib/format'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconPlus, IconPencil, IconCalendar, IconTrash, IconCheck } from '../components/Icons'
import type { Event } from '../types'

export function EventsScreen() {
  const events = useLiveQuery(() => db.events.orderBy('date').reverse().toArray(), [])
  const [editingId, setEditingId] = useState<string | null>(null)

  async function addEvent() {
    const id = uid()
    await db.events.add({ id, name: 'งานใหม่', date: todayISO(), createdAt: Date.now() })
    setEditingId(id)
  }

  return (
    <>
      <ScreenHeader
        title="งานที่จะออก"
        subtitle={`ทั้งหมด ${events?.length ?? 0} งาน`}
        back="settings"
        right={
          <button
            onClick={addEvent}
            className="flex items-center gap-1.5 rounded-xl bg-electrum px-3.5 py-2 text-[13px] font-semibold text-[#2a2115]"
          >
            <IconPlus width={16} height={16} />
            เพิ่ม
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-3.5">
        {events?.length === 0 && (
          <div className="py-16 text-center text-[13px] text-pewter">
            ยังไม่มีงาน — กด “เพิ่ม” มุมขวาบน
          </div>
        )}
        {(events ?? []).map((ev) => (
          <EventRow
            key={ev.id}
            event={ev}
            editing={editingId === ev.id}
            onEdit={() => setEditingId(editingId === ev.id ? null : ev.id)}
            onClose={() => setEditingId(null)}
          />
        ))}
      </div>
    </>
  )
}

function EventRow({
  event: ev, editing, onEdit, onClose,
}: {
  event: Event
  editing: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const showToast = useApp((s) => s.showToast)
  const currentEventId = useApp((s) => s.currentEventId)
  const setCurrentEvent = useApp((s) => s.setCurrentEvent)
  const count = useLiveQuery(() => db.events.count(), []) ?? 1
  const [draft, setDraft] = useState({ name: ev.name, date: ev.date })
  const current = ev.id === currentEventId

  async function save() {
    await db.events.update(ev.id, { name: draft.name.trim() || 'งาน', date: draft.date })
    showToast('บันทึกงานแล้ว')
    onClose()
  }

  async function remove() {
    if (count <= 1) {
      showToast('ต้องมีอย่างน้อย 1 งาน')
      return
    }
    if (!window.confirm(`ลบงาน "${ev.name}" ?`)) return
    await db.events.delete(ev.id)
    if (current) {
      const rest = await db.events.orderBy('createdAt').first()
      if (rest) setCurrentEvent(rest.id)
    }
    showToast('ลบงานแล้ว')
    onClose()
  }

  return (
    <div
      className={`mb-2.5 rounded-2xl border bg-surface ${
        current ? 'border-electrum/40' : 'border-white/10'
      }`}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-electrum/10 text-electrum">
          <IconCalendar width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-milky">{ev.name}</span>
            {current && (
              <span className="flex-none rounded-md bg-electrum/15 px-1.5 py-px text-[10px] text-electrum">
                กำลังขาย
              </span>
            )}
          </div>
          <div className="text-[11px] text-pewter">{thaiDate(ev.date)}</div>
        </div>
        <button
          onClick={onEdit}
          className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border ${
            editing ? 'border-electrum text-electrum' : 'border-white/10 bg-surface-2 text-pewter'
          }`}
        >
          <IconPencil width={16} height={16} />
        </button>
      </div>

      {editing && (
        <div className="border-t border-white/10 p-3.5">
          <label className="mb-1.5 block text-[11px] text-pewter">ชื่องาน</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="ชื่องาน"
            className="w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
          />
          <label className="mb-1.5 mt-3 block text-[11px] text-pewter">วันที่</label>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
            style={{ colorScheme: 'dark' }}
          />

          {!current && (
            <button
              onClick={() => {
                setCurrentEvent(ev.id)
                showToast('ตั้งเป็นงานปัจจุบันแล้ว')
              }}
              className="mt-3.5 w-full rounded-xl border border-white/15 py-2.5 text-[13px] font-medium text-milky"
            >
              ตั้งเป็นงานที่กำลังขาย
            </button>
          )}

          <div className="mt-3 flex gap-2.5">
            <button
              onClick={remove}
              className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-[#c96b6b]/40 text-[#c96b6b]"
            >
              <IconTrash width={18} height={18} />
            </button>
            <button
              onClick={save}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-electrum py-2.5 font-semibold text-[#2a2115]"
            >
              <IconCheck width={18} height={18} />
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
