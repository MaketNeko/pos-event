import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db'
import { useApp } from '../store'
import { baht } from '../lib/format'
import { setAvailable } from '../lib/sets'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconPlus, IconMinus, IconPencil, IconTrash, IconCheck } from '../components/Icons'
import type { Product, ProductSet } from '../types'

export function SetsScreen() {
  const sets = useLiveQuery(() => db.sets.orderBy('order').toArray(), [])
  const products = useLiveQuery(() => db.products.orderBy('order').toArray(), [])
  const [editingId, setEditingId] = useState<string | null>(null)

  async function add(type: 'fixed' | 'mix') {
    const id = uid()
    const order = sets?.length ?? 0
    await db.sets.add(
      type === 'fixed'
        ? { id, name: 'เซ็ตใหม่', type, price: 0, active: true, order, items: [] }
        : { id, name: 'โปรมิกซ์ใหม่', type, price: 0, active: true, order, productIds: [], n: 3 },
    )
    setEditingId(id)
  }

  return (
    <>
      <ScreenHeader title="เซ็ต / โปรโมชั่น" subtitle={`ทั้งหมด ${sets?.length ?? 0} รายการ`} back="settings" />
      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-3.5">
        <div className="mb-4 flex gap-2.5">
          <button
            onClick={() => add('fixed')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-electrum/40 bg-surface py-2.5 text-[13px] font-semibold text-electrum"
          >
            <IconPlus width={15} height={15} /> เซ็ตตายตัว
          </button>
          <button
            onClick={() => add('mix')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-electrum/40 bg-surface py-2.5 text-[13px] font-semibold text-electrum"
          >
            <IconPlus width={15} height={15} /> มิกซ์แอนด์แมตช์
          </button>
        </div>

        {sets?.length === 0 && (
          <div className="py-12 text-center text-[13px] text-pewter">
            ยังไม่มีเซ็ต — เลือกชนิดด้านบนเพื่อเพิ่ม
          </div>
        )}

        {(sets ?? []).map((s) => (
          <SetRow
            key={s.id}
            set={s}
            products={products ?? []}
            editing={editingId === s.id}
            onEdit={() => setEditingId(editingId === s.id ? null : s.id)}
            onClose={() => setEditingId(null)}
          />
        ))}
      </div>
    </>
  )
}

function SetRow({
  set, products, editing, onEdit, onClose,
}: {
  set: ProductSet
  products: Product[]
  editing: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const showToast = useApp((s) => s.showToast)
  const [draft, setDraft] = useState<ProductSet>({ ...set })

  const isFixed = set.type === 'fixed'
  const avail = setAvailable(set, products)

  async function toggle() {
    await db.sets.update(set.id, { active: !set.active })
  }

  async function save() {
    const patch: Partial<ProductSet> = {
      name: draft.name.trim() || (isFixed ? 'เซ็ต' : 'โปรมิกซ์'),
      price: draft.price || 0,
    }
    if (isFixed) {
      const items = (draft.items ?? []).filter((i) => i.qty > 0)
      if (items.length === 0) return showToast('เลือกสินค้าในเซ็ตอย่างน้อย 1')
      patch.items = items
    } else {
      if ((draft.productIds ?? []).length < 2) return showToast('เลือกสินค้าร่วมโปรอย่างน้อย 2')
      if (!draft.n || draft.n < 2) return showToast('จำนวนต่อเซ็ตอย่างน้อย 2')
      patch.productIds = draft.productIds
      patch.n = draft.n
    }
    await db.sets.update(set.id, patch)
    showToast('บันทึกแล้ว')
    onClose()
  }

  async function remove() {
    if (!window.confirm(`ลบ "${set.name}" ?`)) return
    await db.sets.delete(set.id)
    showToast('ลบแล้ว')
    onClose()
  }

  function compQty(pid: string) {
    return draft.items?.find((i) => i.productId === pid)?.qty ?? 0
  }
  function setComp(pid: string, d: number) {
    const items = [...(draft.items ?? [])]
    const idx = items.findIndex((i) => i.productId === pid)
    const cur = idx >= 0 ? items[idx].qty : 0
    const next = Math.max(0, cur + d)
    if (idx >= 0) {
      if (next === 0) items.splice(idx, 1)
      else items[idx] = { productId: pid, qty: next }
    } else if (next > 0) items.push({ productId: pid, qty: next })
    setDraft({ ...draft, items })
  }
  function toggleMix(pid: string) {
    const ids = new Set(draft.productIds ?? [])
    if (ids.has(pid)) ids.delete(pid)
    else ids.add(pid)
    setDraft({ ...draft, productIds: [...ids] })
  }

  return (
    <div className={`mb-2.5 rounded-2xl border bg-surface ${editing ? 'border-electrum/40' : 'border-white/10'}`}>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span
          className={`flex-none rounded-md px-2 py-0.5 text-[10px] font-semibold ${
            isFixed ? 'bg-[#5FB0B7]/15 text-[#7fc7ce]' : 'bg-[#D07AA4]/15 text-[#e08cb8]'
          }`}
        >
          {isFixed ? 'เซ็ต' : 'มิกซ์'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-milky">{set.name}</div>
          <div className="text-[11px] text-pewter">
            {baht(set.price)}
            {isFixed
              ? ` · เหลือ ${avail} เซ็ต`
              : ` · ${set.n} ชิ้น · ${set.productIds?.length ?? 0} สินค้า`}
          </div>
        </div>
        <button
          onClick={toggle}
          className={`relative h-6 w-[42px] flex-none rounded-full border transition ${
            set.active ? 'border-electrum bg-electrum' : 'border-white/10 bg-[#3a4148]'
          }`}
        >
          <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all ${set.active ? 'left-[22px] bg-[#2a2115]' : 'left-0.5 bg-pewter'}`} />
        </button>
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
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="ชื่อ"
            className="w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
          />

          <div className="mt-3 flex items-center gap-3">
            <span className="text-[13px] text-pewter">ราคาเซ็ต</span>
            <div className="ml-auto flex items-center rounded-xl border border-white/10 bg-surface-2 px-3">
              <span className="font-num text-electrum">฿</span>
              <input
                inputMode="numeric"
                value={draft.price || ''}
                placeholder="0"
                onChange={(e) => setDraft({ ...draft, price: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                className="w-20 bg-transparent px-2 py-2 text-right font-num text-[15px] font-semibold text-milky outline-none"
              />
            </div>
          </div>

          {!isFixed && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[13px] text-pewter">จำนวนต่อเซ็ต</span>
              <div className="ml-auto flex items-center overflow-hidden rounded-xl border border-white/10">
                <button onClick={() => setDraft({ ...draft, n: Math.max(2, (draft.n ?? 3) - 1) })} className="grid h-9 w-9 place-items-center bg-surface-2 text-electrum">
                  <IconMinus width={16} height={16} />
                </button>
                <span className="w-10 text-center font-num text-[15px] font-semibold">{draft.n ?? 3}</span>
                <button onClick={() => setDraft({ ...draft, n: (draft.n ?? 3) + 1 })} className="grid h-9 w-9 place-items-center bg-surface-2 text-electrum">
                  <IconPlus width={16} height={16} />
                </button>
              </div>
            </div>
          )}

          <div className="mb-2 mt-4 text-[12px] font-medium text-pewter">
            {isFixed ? 'สินค้าในเซ็ต (ตั้งจำนวน)' : 'สินค้าที่ร่วมโปร (เลือกได้หลายอย่าง)'}
          </div>
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-surface-2 p-2">
            {products.length === 0 && <div className="p-2 text-[12px] text-pewter">ยังไม่มีสินค้า</div>}
            {products.map((p) =>
              isFixed ? (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p.name}</span>
                  <span className="text-[11px] text-pewter">{baht(p.price)}</span>
                  <div className="flex items-center overflow-hidden rounded-lg border border-white/10">
                    <button onClick={() => setComp(p.id, -1)} className="grid h-7 w-7 place-items-center text-electrum">
                      <IconMinus width={14} height={14} />
                    </button>
                    <span className="w-6 text-center font-num text-[13px]">{compQty(p.id)}</span>
                    <button onClick={() => setComp(p.id, 1)} className="grid h-7 w-7 place-items-center text-electrum">
                      <IconPlus width={14} height={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  key={p.id}
                  onClick={() => toggleMix(p.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                >
                  <span
                    className={`grid h-5 w-5 flex-none place-items-center rounded border ${
                      draft.productIds?.includes(p.id) ? 'border-electrum bg-electrum text-[#2a2115]' : 'border-white/20'
                    }`}
                  >
                    {draft.productIds?.includes(p.id) && <IconCheck width={13} height={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p.name}</span>
                  <span className="text-[11px] text-pewter">{baht(p.price)}</span>
                </button>
              ),
            )}
          </div>

          <div className="mt-3.5 flex gap-2.5">
            <button onClick={remove} className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-[#c96b6b]/40 text-[#c96b6b]">
              <IconTrash width={18} height={18} />
            </button>
            <button onClick={save} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-electrum py-2.5 font-semibold text-[#2a2115]">
              <IconCheck width={18} height={18} /> บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
