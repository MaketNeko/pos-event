import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db'
import { useApp } from '../store'
import { fileToResizedDataURL } from '../lib/image'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconCamera, IconCheck, IconPlus, IconMinus, IconTrash } from '../components/Icons'

const numeric = (v: string) => v.replace(/[^0-9]/g, '')

export function AddProductScreen() {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const editId = useApp((s) => s.editProductId)
  const isEdit = !!editId

  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const editing = useLiveQuery(() => (editId ? db.products.get(editId) : undefined), [editId])

  const fileRef = useRef<HTMLInputElement>(null)
  const inited = useRef(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('20')
  const [image, setImage] = useState<string | undefined>()
  const [catId, setCatId] = useState<string | null>(null)
  const [newCat, setNewCat] = useState({ on: false, name: '', bg: '#364958', text: '#E8FDFF', border: '#E7CB9C' })

  // prefill when editing
  useEffect(() => {
    if (isEdit && editing && !inited.current) {
      inited.current = true
      setName(editing.name)
      setPrice(String(editing.price))
      setStock(String(editing.stock))
      setImage(editing.image)
      setCatId(editing.categoryId)
    }
  }, [isEdit, editing])

  // default category selection for new product
  useEffect(() => {
    if (!isEdit && catId === null && !newCat.on && cats && cats.length) setCatId(cats[0].id)
  }, [isEdit, catId, newCat.on, cats])

  async function pickImage(file: File) {
    try {
      setImage(await fileToResizedDataURL(file))
    } catch {
      showToast('อ่านรูปไม่สำเร็จ')
    }
  }

  async function save() {
    if (!name.trim()) return showToast('ใส่ชื่อสินค้า')
    const priceN = parseInt(price) || 0
    if (priceN <= 0) return showToast('ใส่ราคาสินค้า')

    let categoryId = catId
    if (newCat.on) {
      if (!newCat.name.trim()) return showToast('ใส่ชื่อประเภทใหม่')
      categoryId = uid()
      const order = cats?.length ?? 0
      await db.categories.add({
        id: categoryId, name: newCat.name.trim(), order,
        color: newCat.border, bg: newCat.bg, text: newCat.text, border: newCat.border,
      })
    }
    if (!categoryId) return showToast('เลือกประเภท')

    if (isEdit && editId) {
      await db.products.update(editId, {
        name: name.trim(), price: priceN, stock: parseInt(stock) || 0, image, categoryId,
      })
      showToast('บันทึกการแก้ไขแล้ว')
    } else {
      const order = await db.products.where('categoryId').equals(categoryId).count()
      await db.products.add({
        id: uid(), categoryId, name: name.trim(), price: priceN,
        stock: parseInt(stock) || 0, image, active: true, order,
      })
      showToast('เพิ่มสินค้าแล้ว')
    }
    go('products')
  }

  async function remove() {
    if (!editId) return
    if (!window.confirm(`ลบสินค้า "${name}" ?`)) return
    await db.products.delete(editId)
    showToast('ลบสินค้าแล้ว')
    go('products')
  }

  const step = (d: number) => setStock((s) => String(Math.max(0, (parseInt(s) || 0) + d)))

  return (
    <>
      <ScreenHeader
        title={isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}
        subtitle={isEdit ? 'ปรับข้อมูลสินค้า' : 'กรอกข้อมูลสินค้าใหม่'}
        back="products"
      />

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-[18px]">
        {/* image */}
        <Field label="รูปสินค้า">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-white/20 bg-surface text-pewter"
          >
            {image ? (
              <img src={image} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <IconCamera width={34} height={34} />
                <span className="text-[13px]">แตะเพื่อถ่ายรูป / เลือกรูป</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickImage(f)
              e.target.value = ''
            }}
          />
        </Field>

        <Field label="ชื่อสินค้า">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ชาไทยเย็น"
            className="w-full rounded-[13px] border border-white/10 bg-surface px-3.5 py-3 text-[15px] text-milky outline-none focus:border-electrum"
          />
        </Field>

        <Field label="ราคาขาย">
          <div className="flex items-center rounded-[13px] border border-white/10 bg-surface px-3.5 focus-within:border-electrum">
            <span className="font-num text-lg font-semibold text-electrum">฿</span>
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(numeric(e.target.value))}
              placeholder="0"
              className="flex-1 bg-transparent px-2 py-3 font-num text-lg font-semibold text-milky outline-none"
            />
          </div>
        </Field>

        <Field label="สต็อกเริ่มต้น">
          <div className="flex w-fit items-center overflow-hidden rounded-[13px] border border-white/10">
            <button onClick={() => step(-1)} className="grid h-12 w-12 place-items-center bg-surface text-electrum">
              <IconMinus width={20} height={20} />
            </button>
            <input
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(numeric(e.target.value))}
              className="h-12 w-[70px] bg-surface-2 text-center font-num text-lg font-semibold text-milky outline-none"
            />
            <button onClick={() => step(1)} className="grid h-12 w-12 place-items-center bg-surface text-electrum">
              <IconPlus width={20} height={20} />
            </button>
          </div>
        </Field>

        <Field label="ประเภท">
          <div className="flex flex-wrap gap-2">
            {(cats ?? []).map((c) => {
              const sel = catId === c.id && !newCat.on
              return (
                <button
                  key={c.id}
                  onClick={() => { setCatId(c.id); setNewCat((n) => ({ ...n, on: false })) }}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] ${
                    sel ? 'border-electrum bg-surface-2 text-milky' : 'border-white/10 bg-surface text-pewter'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                  {c.name}
                </button>
              )
            })}
            <button
              onClick={() => setNewCat((n) => ({ ...n, on: !n.on }))}
              className={`rounded-full border border-dashed px-3.5 py-2 text-[13px] ${
                newCat.on ? 'border-electrum bg-surface-2 text-electrum' : 'border-white/20 text-electrum'
              }`}
            >
              ＋ ประเภทใหม่
            </button>
          </div>

          {newCat.on && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-surface p-3.5">
              <input
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                placeholder="ชื่อประเภทใหม่"
                className="w-full rounded-xl border border-white/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
              />
              <div className="mt-3 flex gap-2.5">
                <Color label="สีพื้น" v={newCat.bg} on={(v) => setNewCat({ ...newCat, bg: v })} />
                <Color label="สีข้อความ" v={newCat.text} on={(v) => setNewCat({ ...newCat, text: v })} />
                <Color label="สีกรอบ" v={newCat.border} on={(v) => setNewCat({ ...newCat, border: v })} />
              </div>
              <div
                className="mt-3.5 rounded-xl border-2 px-3 py-3.5 text-center text-sm font-semibold"
                style={{ background: newCat.bg, color: newCat.text, borderColor: newCat.border }}
              >
                {newCat.name || 'ตัวอย่างประเภท'}
              </div>
            </div>
          )}
        </Field>
      </div>

      <div className="flex gap-2.5 border-t border-white/10 bg-ink px-5 pb-safe pt-3.5">
        {isEdit ? (
          <button
            onClick={remove}
            className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[15px] border border-[#c96b6b]/40 text-[#c96b6b]"
          >
            <IconTrash width={20} height={20} />
          </button>
        ) : (
          <button
            onClick={() => go('products')}
            className="flex-none rounded-[15px] border border-white/20 px-4 py-3.5 font-medium text-pewter"
          >
            ยกเลิก
          </button>
        )}
        <button
          onClick={save}
          className="flex flex-1 items-center justify-center gap-2 rounded-[15px] bg-gradient-to-br from-[#EBD4A6] to-[#D9B87C] py-3.5 text-base font-bold text-[#2a2115] shadow-lg"
        >
          <IconCheck width={20} height={20} />
          {isEdit ? 'บันทึก' : 'บันทึกสินค้า'}
        </button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px]">
      <label className="mb-2 block px-0.5 text-[12px] font-medium text-pewter">{label}</label>
      {children}
    </div>
  )
}

function Color({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="flex-1 text-center">
      <label className="mb-1.5 block text-[11px] text-pewter">{label}</label>
      <input
        type="color"
        value={v}
        onChange={(e) => on(e.target.value)}
        className="h-[42px] w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
      />
    </div>
  )
}
