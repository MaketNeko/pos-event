import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, getSetting } from '../db'
import { useApp } from '../store'
import { fileToDataURL } from '../lib/image'
import { addLot, adjustLotQty, updateLotCost, updateLotNote, deleteLot } from '../lib/lots'
import { CropModal } from '../components/CropModal'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconCamera, IconCheck, IconPlus, IconMinus, IconTrash } from '../components/Icons'

const numeric = (v: string) => v.replace(/[^0-9]/g, '')
// ต้นทุนใส่ทศนิยมได้ (เช่น 32.5)
const decimal = (v: string) => v.replace(/[^0-9.]/g, '')

export function AddProductScreen() {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const editId = useApp((s) => s.editProductId)
  const ownerFilter = useApp((s) => s.ownerFilter)
  const isEdit = !!editId

  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const owners = useLiveQuery(() => db.owners.orderBy('order').toArray(), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const shopLabel = shopName || 'ของร้าน'
  const editing = useLiveQuery(() => (editId ? db.products.get(editId) : undefined), [editId])

  const fileRef = useRef<HTMLInputElement>(null)
  const inited = useRef(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('') // ต้นทุน/ชิ้น — ใช้สร้าง lot แรกตอนเพิ่มสินค้าใหม่
  const [stock, setStock] = useState('20')
  const [image, setImage] = useState<string | undefined>()
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const [newCat, setNewCat] = useState({ on: false, name: '', bg: '#364958', text: '#E8FDFF', border: '#E7CB9C' })
  const [ownerId, setOwnerId] = useState<string | null>(null) // null = ของร้าน
  const [newOwner, setNewOwner] = useState({ on: false, name: '' })

  // prefill when editing
  useEffect(() => {
    if (isEdit && editing && !inited.current) {
      inited.current = true
      setName(editing.name)
      setPrice(String(editing.price))
      setStock(String(editing.stock))
      setImage(editing.image)
      setCatId(editing.categoryId)
      setOwnerId(editing.ownerId ?? null)
    }
  }, [isEdit, editing])

  // default category for new product
  useEffect(() => {
    if (!isEdit && catId === null && !newCat.on && cats && cats.length) setCatId(cats[0].id)
  }, [isEdit, catId, newCat.on, cats])

  // default owner for new product — ดึงจาก ownerFilter ใน store
  useEffect(() => {
    if (isEdit || inited.current) return
    if (ownerFilter !== 'all' && ownerFilter !== 'none') {
      setOwnerId(ownerFilter)
    }
  }, [isEdit, ownerFilter])

  async function pickImage(file: File) {
    try {
      setCropSrc(await fileToDataURL(file))
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

    // สร้างเจ้าของใหม่ถ้าเลือก inline input
    let resolvedOwnerId: string | undefined = ownerId ?? undefined
    if (newOwner.on) {
      if (!newOwner.name.trim()) return showToast('ใส่ชื่อเจ้าของ')
      const newId = uid()
      const order = owners?.length ?? 0
      await db.owners.add({ id: newId, name: newOwner.name.trim(), order })
      resolvedOwnerId = newId
    }

    if (isEdit && editId) {
      // สต็อกในโหมดแก้ไขจัดการผ่าน LOT (รับของเข้า/แก้ lot) — ไม่แตะ stock ตรงนี้
      await db.products.update(editId, {
        name: name.trim(), price: priceN, image, categoryId,
        ownerId: resolvedOwnerId,
      })
      showToast('บันทึกการแก้ไขแล้ว')
    } else {
      const order = await db.products.where('categoryId').equals(categoryId).count()
      const productId = uid()
      const stockN = parseInt(stock) || 0
      await db.products.add({
        id: productId, categoryId, name: name.trim(), price: priceN,
        stock: stockN, image, active: true, order,
        ownerId: resolvedOwnerId,
      })
      // สต็อกเริ่มต้น = lot แรก (เก็บต้นทุน/ชิ้นไว้คิดกำไร)
      if (stockN > 0) {
        await db.lots.add({
          id: uid(), productId, qtyIn: stockN, qtyLeft: stockN,
          cost: parseFloat(cost) || 0, note: 'สต็อกเริ่มต้น', createdAt: Date.now(),
        })
      }
      showToast('เพิ่มสินค้าแล้ว')
    }
    go('products')
  }

  async function remove() {
    if (!editId) return
    if (!window.confirm(`ลบสินค้า "${name}" ?`)) return
    await db.transaction('rw', db.products, db.lots, async () => {
      await db.products.delete(editId)
      await db.lots.where('productId').equals(editId).delete()
    })
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

      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-[18px] lg:flex lg:gap-7 lg:overflow-hidden lg:px-8 lg:pt-6">
        {/* image — left pane on desktop/iPad */}
        <div className="lg:w-[40%] lg:flex-none">
        <Field label="รูปสินค้า">
          {image ? (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-divider/10 lg:aspect-square">
              <img src={image} alt="preview" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5">
                <button
                  onClick={() => setCropSrc(image)}
                  className="flex-1 rounded-lg bg-black/50 py-2 text-[12px] font-medium text-milky backdrop-blur"
                >
                  ครอปรูป
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 rounded-lg bg-black/50 py-2 text-[12px] font-medium text-milky backdrop-blur"
                >
                  เปลี่ยนรูป
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-divider/20 bg-surface text-pewter lg:aspect-square"
            >
              <IconCamera width={34} height={34} />
              <span className="text-[13px]">แตะเพื่อถ่ายรูป / เลือกรูป</span>
            </button>
          )}
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
        </div>

        {/* details — right pane on desktop/iPad */}
        <div className="lg:flex-1 lg:overflow-y-auto">
        <Field label="ชื่อสินค้า">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ชาไทยเย็น"
            className="w-full rounded-[13px] border border-divider/10 bg-surface px-3.5 py-3 text-[15px] text-milky outline-none focus:border-electrum"
          />
        </Field>

        <Field label="ราคาขาย">
          <div className="flex items-center rounded-[13px] border border-divider/10 bg-surface px-3.5 focus-within:border-electrum">
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

        {!isEdit && (
          <Field label="ต้นทุนต่อชิ้น (ไม่บังคับ — ใช้คิดกำไร)">
            <div className="flex items-center rounded-[13px] border border-divider/10 bg-surface px-3.5 focus-within:border-electrum">
              <span className="font-num text-lg font-semibold text-pewter">฿</span>
              <input
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(decimal(e.target.value))}
                placeholder="0"
                className="flex-1 bg-transparent px-2 py-3 font-num text-lg font-semibold text-milky outline-none"
              />
            </div>
          </Field>
        )}

        {!isEdit && (
          <Field label="สต็อกเริ่มต้น">
            <div className="flex w-fit items-center overflow-hidden rounded-[13px] border border-divider/10">
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
        )}

        {isEdit && editId && (
          <Field label="สต็อก & LOT ต้นทุน">
            <LotManager productId={editId} />
          </Field>
        )}

        <Field label="ประเภท">
          <div className="flex flex-wrap gap-2">
            {(cats ?? []).map((c) => {
              const sel = catId === c.id && !newCat.on
              return (
                <button
                  key={c.id}
                  onClick={() => { setCatId(c.id); setNewCat((n) => ({ ...n, on: false })) }}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] ${
                    sel ? 'border-electrum bg-surface-2 text-milky' : 'border-divider/10 bg-surface text-pewter'
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
                newCat.on ? 'border-electrum bg-surface-2 text-electrum' : 'border-divider/20 text-electrum'
              }`}
            >
              ＋ ประเภทใหม่
            </button>
          </div>

          {newCat.on && (
            <div className="mt-3 rounded-2xl border border-divider/10 bg-surface p-3.5">
              <input
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                placeholder="ชื่อประเภทใหม่"
                className="w-full rounded-xl border border-divider/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
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

        {/* เจ้าของ (ฝากขาย) */}
        <Field label="เจ้าของ (ฝากขาย)">
          <div className="flex flex-wrap gap-2">
            {/* ของร้าน */}
            <button
              onClick={() => { setOwnerId(null); setNewOwner({ on: false, name: '' }) }}
              className={`rounded-full border px-3.5 py-2 text-[13px] ${
                ownerId === null && !newOwner.on
                  ? 'border-electrum bg-surface-2 text-milky'
                  : 'border-divider/10 bg-surface text-pewter'
              }`}
            >
              {shopLabel}
            </button>
            {(owners ?? []).map((o) => {
              const sel = ownerId === o.id && !newOwner.on
              return (
                <button
                  key={o.id}
                  onClick={() => { setOwnerId(o.id); setNewOwner({ on: false, name: '' }) }}
                  className={`rounded-full border px-3.5 py-2 text-[13px] ${
                    sel ? 'border-electrum bg-surface-2 text-milky' : 'border-divider/10 bg-surface text-pewter'
                  }`}
                >
                  {o.name}
                </button>
              )
            })}
            <button
              onClick={() => setNewOwner((n) => ({ ...n, on: !n.on }))}
              className={`rounded-full border border-dashed px-3.5 py-2 text-[13px] ${
                newOwner.on ? 'border-electrum bg-surface-2 text-electrum' : 'border-divider/20 text-electrum'
              }`}
            >
              ＋ เจ้าของใหม่
            </button>
          </div>

          {newOwner.on && (
            <div className="mt-3 rounded-2xl border border-divider/10 bg-surface p-3.5">
              <input
                value={newOwner.name}
                onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
                placeholder="ชื่อเจ้าของ / เพื่อน"
                className="w-full rounded-xl border border-divider/10 bg-surface-2 px-3.5 py-2.5 text-sm text-milky outline-none focus:border-electrum"
              />
            </div>
          )}
        </Field>
        </div>
      </div>

      <div className="flex gap-2.5 border-t border-divider/10 bg-ink px-5 pb-safe pt-3.5">
        {isEdit ? (
          <button
            onClick={remove}
            className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[15px] border border-danger/40 text-danger"
          >
            <IconTrash width={20} height={20} />
          </button>
        ) : (
          <button
            onClick={() => go('products')}
            className="flex-none rounded-[15px] border border-divider/20 px-4 py-3.5 font-medium text-pewter"
          >
            ยกเลิก
          </button>
        )}
        <button
          onClick={save}
          className="flex flex-1 items-center justify-center gap-2 rounded-[15px] bg-electrum py-3.5 text-base font-bold text-accent-on shadow-lg"
        >
          <IconCheck width={20} height={20} />
          {isEdit ? 'บันทึก' : 'บันทึกสินค้า'}
        </button>
      </div>

      {cropSrc && (
        <CropModal
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onDone={(d) => {
            setImage(d)
            setCropSrc(null)
          }}
        />
      )}
    </>
  )
}

/**
 * จัดการ LOT ของสินค้า (โหมดแก้ไข): เห็นสต็อกรวม, แก้ lot เก่าได้ทุกอย่าง
 * (จำนวนคงเหลือ +/-, ต้นทุน, โน้ต, ลบ) และรับของเข้าเป็น lot ใหม่
 * ทุกการแก้ไข apply ลง db ทันที (ไม่ต้องกดบันทึก)
 */
function LotManager({ productId }: { productId: string }) {
  const showToast = useApp((s) => s.showToast)
  const lots = useLiveQuery(
    () => db.lots.where('productId').equals(productId).sortBy('createdAt'),
    [productId],
  )
  const product = useLiveQuery(() => db.products.get(productId), [productId])

  const [adding, setAdding] = useState(false)
  const [qty, setQty] = useState('')
  const [lotCost, setLotCost] = useState('')
  const [note, setNote] = useState('')

  async function submitAdd() {
    const q = parseInt(qty) || 0
    if (q <= 0) return showToast('ใส่จำนวนที่รับเข้า')
    await addLot(productId, q, parseFloat(lotCost) || 0, note)
    setAdding(false)
    setQty(''); setLotCost(''); setNote('')
    showToast('รับของเข้าแล้ว')
  }

  async function removeLot(lotId: string, qtyLeft: number) {
    if (!window.confirm(`ลบ lot นี้? สต็อกจะลดลง ${qtyLeft} ชิ้น`)) return
    await deleteLot(lotId)
    showToast('ลบ lot แล้ว')
  }

  return (
    <div>
      {/* สต็อกรวม */}
      <div className="mb-3 flex items-baseline gap-2 rounded-[13px] border border-divider/10 bg-surface px-3.5 py-3">
        <span className="text-[12px] text-pewter">สต็อกรวม</span>
        <span className="font-num text-lg font-semibold text-milky">{product?.stock ?? 0}</span>
        <span className="text-[12px] text-pewter">ชิ้น</span>
      </div>

      {/* รายการ lot */}
      {(lots ?? []).length === 0 && (
        <div className="mb-3 rounded-[13px] border border-dashed border-divider/20 px-3.5 py-3 text-[12px] text-pewter">
          ยังไม่มี lot — กด "รับของเข้า" เพื่อบันทึกจำนวน + ต้นทุน
        </div>
      )}
      {(lots ?? []).map((lot) => (
        <div key={lot.id} className="mb-2 rounded-2xl border border-divider/10 bg-surface p-3">
          <div className="flex items-center gap-2">
            <input
              defaultValue={lot.note ?? ''}
              placeholder="โน้ต เช่น พิมพ์ครั้งที่ 2"
              onBlur={(e) => void updateLotNote(lot.id, e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-milky outline-none placeholder:text-pewter/60"
            />
            <span className="flex-none text-[10px] text-pewter">
              {new Date(lot.createdAt).toLocaleDateString('th-TH')}
            </span>
            <button
              onClick={() => void removeLot(lot.id, lot.qtyLeft)}
              className="grid h-7 w-7 flex-none place-items-center rounded-lg text-pewter"
            >
              <IconTrash width={15} height={15} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border border-divider/20 bg-black/20">
              <span className="pl-2 font-num text-[13px] font-semibold text-pewter">฿</span>
              <input
                inputMode="decimal"
                defaultValue={lot.cost > 0 ? String(lot.cost) : ''}
                placeholder="0"
                onBlur={(e) => void updateLotCost(lot.id, parseFloat(decimal(e.target.value)) || 0)}
                className="w-[68px] bg-transparent px-1.5 py-1.5 text-right font-num text-[14px] font-semibold text-milky outline-none placeholder:text-pewter/60"
              />
            </div>
            <span className="text-[11px] text-pewter">ทุน/ชิ้น</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => void adjustLotQty(lot.id, -1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-divider/10 text-electrum"
              >
                <IconMinus width={15} height={15} />
              </button>
              <div className="w-[46px] text-center">
                <div className="font-num text-[15px] font-semibold leading-none text-milky">{lot.qtyLeft}</div>
                <div className="mt-0.5 font-num text-[9px] leading-none text-pewter">รับ {lot.qtyIn}</div>
              </div>
              <button
                onClick={() => void adjustLotQty(lot.id, 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-divider/10 text-electrum"
              >
                <IconPlus width={15} height={15} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* รับของเข้า */}
      {adding ? (
        <div className="rounded-2xl border border-electrum/30 bg-surface p-3.5">
          <div className="mb-2 text-[12px] font-medium text-electrum">รับของเข้า (LOT ใหม่)</div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-pewter">จำนวน</label>
              <input
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(numeric(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-divider/10 bg-surface-2 px-3 py-2.5 text-center font-num text-[15px] font-semibold text-milky outline-none focus:border-electrum"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] text-pewter">ต้นทุน/ชิ้น (฿)</label>
              <input
                inputMode="decimal"
                value={lotCost}
                onChange={(e) => setLotCost(decimal(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-divider/10 bg-surface-2 px-3 py-2.5 text-center font-num text-[15px] font-semibold text-milky outline-none focus:border-electrum"
              />
            </div>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="โน้ต (ไม่บังคับ) เช่น พิมพ์ครั้งที่ 2, เล่มตำหนิ"
            className="mt-2 w-full rounded-xl border border-divider/10 bg-surface-2 px-3 py-2.5 text-[13px] text-milky outline-none focus:border-electrum"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => setAdding(false)}
              className="rounded-xl border border-divider/20 px-3.5 py-2 text-[13px] text-pewter"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => void submitAdd()}
              className="flex-1 rounded-xl bg-electrum py-2 text-[13px] font-bold text-accent-on"
            >
              เพิ่ม lot นี้
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-[13px] border border-dashed border-divider/20 py-3 text-[13px] font-medium text-electrum"
        >
          ＋ รับของเข้า (เพิ่ม LOT)
        </button>
      )}
    </div>
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
        className="h-[42px] w-full cursor-pointer rounded-lg border border-divider/10 bg-transparent p-0.5"
      />
    </div>
  )
}
