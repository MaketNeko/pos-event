import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../db'
import { useApp } from '../store'
import { baht } from '../lib/format'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconPlus, IconPencil, IconGrip } from '../components/Icons'
import type { Category, Product } from '../types'

export function ProductsScreen() {
  const go = useApp((s) => s.go)
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const products = useLiveQuery(() => db.products.orderBy('order').toArray(), [])

  return (
    <>
      <ScreenHeader
        title="จัดการสินค้า"
        subtitle={`ทั้งหมด ${products?.length ?? 0} รายการ`}
        back="settings"
        right={
          <button
            onClick={() => go('addProduct')}
            className="flex items-center gap-1.5 rounded-xl bg-electrum px-3.5 py-2 text-[13px] font-semibold text-[#2a2115]"
          >
            <IconPlus width={16} height={16} />
            เพิ่ม
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-3.5">
        {products?.length === 0 && (
          <div className="py-16 text-center text-[13px] text-pewter">
            ยังไม่มีสินค้า — กด “เพิ่ม” มุมขวาบน
          </div>
        )}
        {(cats ?? []).map((c) => {
          const items = (products ?? []).filter((p) => p.categoryId === c.id)
          if (items.length === 0) return null
          return <CategoryGroup key={c.id} category={c} items={items} />
        })}
      </div>
    </>
  )
}

function CategoryGroup({ category, items }: { category: Category; items: Product[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((p) => p.id === active.id)
    const newIndex = items.findIndex((p) => p.id === over.id)
    const next = arrayMove(items, oldIndex, newIndex)
    await db.transaction('rw', db.products, async () => {
      for (let i = 0; i < next.length; i++) await db.products.update(next[i].id, { order: i })
    })
  }

  return (
    <>
      <div className="mb-2.5 mt-[18px] flex items-center gap-2 px-1 font-serif text-sm font-semibold first:mt-0.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: category.color }} />
        {category.name}
        <span className="ml-auto text-[11px] font-normal text-pewter">{items.length} รายการ</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {items.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </SortableContext>
      </DndContext>
    </>
  )
}

function ProductRow({ product: p }: { product: Product }) {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
  })
  const out = p.stock <= 0

  async function toggle() {
    await db.products.update(p.id, { active: !p.active })
    showToast(!p.active ? 'เปิดขายแล้ว' : 'ปิดขาย · ซ่อนจากหน้าขาย')
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`mb-2.5 flex items-center gap-2.5 rounded-2xl border bg-surface px-3 py-2.5 ${
        isDragging ? 'z-10 border-electrum shadow-2xl' : 'border-white/10'
      } ${!p.active ? 'opacity-50' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="grid h-[42px] w-7 flex-none cursor-grab touch-none place-items-center text-pewter active:cursor-grabbing"
      >
        <IconGrip width={18} height={18} />
      </button>
      <div className="h-12 w-12 flex-none overflow-hidden rounded-[10px] bg-[#20262b]">
        {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          {p.name}
          {!p.active && (
            <span className="rounded-md bg-[#E0B579]/15 px-1.5 py-px text-[10px] text-[#E0B579]">
              ปิดขาย
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-pewter">
          <span className="font-num text-electrum">{baht(p.price)}</span> ·{' '}
          {out ? <span className="text-[#c96b6b]">ของหมด</span> : `คงเหลือ ${p.stock}`}
        </div>
      </div>
      {/* on/off switch */}
      <button
        onClick={toggle}
        className={`relative h-6 w-[42px] flex-none rounded-full border transition ${
          p.active ? 'border-electrum bg-electrum' : 'border-white/10 bg-[#3a4148]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all ${
            p.active ? 'left-[22px] bg-[#2a2115]' : 'left-0.5 bg-pewter'
          }`}
        />
      </button>
      <button
        onClick={() => go('addProduct', p.id)}
        className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border border-white/10 bg-surface-2 text-pewter"
      >
        <IconPencil width={16} height={16} />
      </button>
    </div>
  )
}
