import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, uid } from '../db'
import { useApp } from '../store'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconPlus, IconPencil, IconGrip, IconTrash, IconCheck } from '../components/Icons'
import type { Category } from '../types'

export function CategoriesScreen() {
  const showToast = useApp((s) => s.showToast)
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const products = useLiveQuery(() => db.products.toArray(), [])
  const [editingId, setEditingId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !cats) return
    const oldIndex = cats.findIndex((c) => c.id === active.id)
    const newIndex = cats.findIndex((c) => c.id === over.id)
    const next = arrayMove(cats, oldIndex, newIndex)
    await db.transaction('rw', db.categories, async () => {
      for (let i = 0; i < next.length; i++) await db.categories.update(next[i].id, { order: i })
    })
    showToast('บันทึกลำดับแล้ว')
  }

  async function addCategory() {
    const order = (cats?.length ?? 0)
    const id = uid()
    await db.categories.add({
      id, name: 'ประเภทใหม่', order,
      color: '#E7CB9C', bg: '#364958', text: '#E8FDFF', border: '#E7CB9C',
    })
    setEditingId(id)
  }

  const countOf = (id: string) => (products ?? []).filter((p) => p.categoryId === id).length

  return (
    <>
      <ScreenHeader
        title="ประเภทสินค้า"
        subtitle="ลากจัดลำดับได้"
        back="settings"
        right={
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 rounded-xl bg-electrum px-3.5 py-2 text-[13px] font-semibold text-accent-on"
          >
            <IconPlus width={16} height={16} />
            เพิ่ม
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-3.5">
        <div className="mb-3.5 flex items-start gap-2 px-0.5 text-[12px] leading-relaxed text-pewter">
          ลากที่จับด้านซ้ายเพื่อจัดลำดับ — ลำดับนี้จะเรียงเหมือนกันในหน้าขาย
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={(cats ?? []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {(cats ?? []).map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                count={countOf(c.id)}
                editing={editingId === c.id}
                onEdit={() => setEditingId(editingId === c.id ? null : c.id)}
                onClose={() => setEditingId(null)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </>
  )
}

function CategoryRow({
  category: c, count, editing, onEdit, onClose,
}: {
  category: Category
  count: number
  editing: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const showToast = useApp((s) => s.showToast)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
  })
  const [draft, setDraft] = useState({ name: c.name, bg: c.bg, text: c.text, border: c.border })

  async function save() {
    await db.categories.update(c.id, {
      name: draft.name.trim() || 'ประเภท',
      bg: draft.bg, text: draft.text, border: draft.border, color: draft.border,
    })
    showToast('บันทึกประเภทแล้ว')
    onClose()
  }

  async function remove() {
    if (count > 0) {
      showToast('ลบไม่ได้ · ยังมีสินค้าในประเภทนี้')
      return
    }
    if (!window.confirm(`ลบประเภท "${c.name}" ?`)) return
    await db.categories.delete(c.id)
    showToast('ลบประเภทแล้ว')
    onClose()
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`mb-2.5 rounded-2xl border bg-surface ${
        isDragging ? 'z-10 border-electrum shadow-2xl' : 'border-divider/10'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="grid h-[42px] w-7 flex-none cursor-grab touch-none place-items-center text-pewter active:cursor-grabbing"
        >
          <IconGrip width={18} height={18} />
        </button>
        <div
          className="rounded-[11px] border-2 px-3.5 py-2 text-sm font-semibold"
          style={{ background: editing ? draft.bg : c.bg, color: editing ? draft.text : c.text, borderColor: editing ? draft.border : c.border }}
        >
          {editing ? draft.name || 'ประเภท' : c.name}
        </div>
        <span className="ml-auto flex-none text-[11px] text-pewter">{count} สินค้า</span>
        <button
          onClick={onEdit}
          className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border ${
            editing ? 'border-electrum text-electrum' : 'border-divider/10 bg-surface-2 text-pewter'
          }`}
        >
          <IconPencil width={16} height={16} />
        </button>
      </div>

      {editing && (
        <div className="border-t border-divider/10 p-3.5">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="ชื่อประเภท"
            className="w-full rounded-xl border border-divider/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
          />
          <div className="mt-3 flex gap-2.5">
            <ColorField label="สีพื้น" value={draft.bg} onChange={(v) => setDraft({ ...draft, bg: v })} />
            <ColorField label="สีข้อความ" value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
            <ColorField label="สีกรอบ" value={draft.border} onChange={(v) => setDraft({ ...draft, border: v })} />
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <button
              onClick={remove}
              className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-danger/40 text-danger"
            >
              <IconTrash width={18} height={18} />
            </button>
            <button
              onClick={save}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-electrum py-2.5 font-semibold text-accent-on"
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 text-center">
      <label className="mb-1.5 block text-[11px] text-pewter">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer rounded-lg border border-divider/10 bg-transparent p-0.5"
      />
    </div>
  )
}
