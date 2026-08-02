import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { QRCodeSVG } from 'qrcode.react'
import { db, uid, getSetting } from '../db'
import { useApp } from '../store'
import { useCatalogData } from '../sync/useCatalog'
import { enqueueSale } from '../sync/outbox'
import { baht, thaiDate } from '../lib/format'
import { promptPayPayload } from '../lib/promptpay'
import { computeMix, setAvailable } from '../lib/sets'
import { consumeFIFO } from '../lib/lots'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconCheck, IconPlus, IconMinus, IconTrash, IconTag, IconQR } from '../components/Icons'
import type { Sale, SaleItem, Product, ProductSet } from '../types'

type Line = { p: Product; qty: number }
type SetLine = { s: ProductSet; qty: number }

/** ราคาพิเศษต่อชิ้นที่ตั้งตอนขาย (ลดตำหนิ/แจกฟรี) — key = productId */
type PriceOverride = { price: number; note?: string }

const PRICE_NOTES = ['ตำหนิ', 'แจกฟรี', 'ของเก่า'] as const

export function CheckoutScreen() {
  const cart = useApp((s) => s.cart)
  const addToCart = useApp((s) => s.addToCart)
  const decCart = useApp((s) => s.decCart)
  const removeCart = useApp((s) => s.removeCart)
  const setCart = useApp((s) => s.setCart)
  const addSet = useApp((s) => s.addSet)
  const decSet = useApp((s) => s.decSet)
  const removeSet = useApp((s) => s.removeSet)
  const clearCart = useApp((s) => s.clearCart)
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const currentEventId = useApp((s) => s.currentEventId)
  const boothRole = useApp((s) => s.boothRole)
  const boothCode = useApp((s) => s.boothCode)

  const { products, sets, owners, eventName: remoteEventName, eventId: remoteEventId } = useCatalogData()
  const event = useLiveQuery(() => db.events.get(currentEventId), [currentEventId])
  const promptpay = useLiveQuery(() => getSetting('promptpay'), []) ?? ''

  const [discRaw, setDiscRaw] = useState('')
  const [discMode, setDiscMode] = useState<'baht' | 'percent'>('baht')
  const [method, setMethod] = useState<'promptpay' | 'cash'>('promptpay')
  const [done, setDone] = useState(false)

  // ราคาพิเศษต่อชิ้น (ลดตำหนิ / แจกฟรี 0 บาท)
  const [overrides, setOverrides] = useState<Record<string, PriceOverride>>({})
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [ovRaw, setOvRaw] = useState('')

  const effPrice = (p: Product) => overrides[p.id]?.price ?? p.price

  function openPriceEditor(p: Product) {
    if (editingPrice === p.id) { setEditingPrice(null); return }
    setEditingPrice(p.id)
    setOvRaw(String(overrides[p.id]?.price ?? p.price))
  }

  function setOverridePrice(p: Product, raw: string) {
    setOvRaw(raw)
    const v = Math.max(0, parseInt(raw) || 0)
    setOverrides((o) => ({ ...o, [p.id]: { price: v, note: o[p.id]?.note } }))
  }

  function toggleOverrideNote(p: Product, note: string) {
    setOverrides((o) => {
      const cur = o[p.id] ?? { price: p.price }
      const next = { ...cur, note: cur.note === note ? undefined : note }
      // "แจกฟรี" = ตั้งราคา 0 ให้เลย
      if (note === 'แจกฟรี' && next.note === note) { next.price = 0; setOvRaw('0') }
      return { ...o, [p.id]: next }
    })
  }

  function clearOverride(p: Product) {
    setOverrides((o) => {
      const next = { ...o }
      delete next[p.id]
      return next
    })
    setEditingPrice(null)
  }

  const lines = useMemo<Line[]>(() => {
    const out: Line[] = []
    for (const [id, qty] of Object.entries(cart)) {
      const p = products.find((x) => x.id === id)
      if (p) out.push({ p, qty })
    }
    return out
  }, [cart, products])

  const setLines = useMemo<SetLine[]>(() => {
    const out: SetLine[] = []
    for (const [id, qty] of Object.entries(setCart)) {
      const s = sets.find((x) => x.id === id)
      if (s) out.push({ s, qty })
    }
    return out
  }, [setCart, sets])

  const mixSets = sets.filter((s) => s.type === 'mix' && s.active)
  // โปรเซ็ต mix คิดจากราคาที่ขายจริง (รวมราคาพิเศษที่แก้ตอนขาย)
  const mixProducts = useMemo(
    () => products.map((p) => (overrides[p.id] ? { ...p, price: overrides[p.id].price } : p)),
    [products, overrides],
  )
  const mix = computeMix(mixSets, cart, mixProducts)

  const prodSubtotal = lines.reduce((s, l) => s + effPrice(l.p) * l.qty, 0)
  const setSubtotal = setLines.reduce((s, l) => s + l.s.price * l.qty, 0)
  const subtotal = prodSubtotal + setSubtotal
  const afterMix = Math.max(0, subtotal - mix.discount)

  const discount = useMemo(() => {
    const v = Math.max(0, parseFloat(discRaw) || 0)
    const d = discMode === 'percent' ? (afterMix * Math.min(v, 100)) / 100 : Math.min(v, afterMix)
    return Math.round(d)
  }, [discRaw, discMode, afterMix])
  const total = Math.max(0, subtotal - mix.discount - discount)

  const empty = lines.length === 0 && setLines.length === 0
  const payload = method === 'promptpay' && promptpay && total > 0 ? promptPayPayload(promptpay, total) : ''

  async function markPaid() {
    if (empty) return

    // สร้าง ownerMap เพื่อ snapshot ชื่อเจ้าของ ณ เวลาขาย
    const ownerMap = Object.fromEntries(owners.map((o) => [o.id, o.name]))
    const items: SaleItem[] = [
      ...lines.map((l) => {
        const ov = overrides[l.p.id]
        return {
          kind: 'product' as const,
          refId: l.p.id,
          name: l.p.name,
          price: ov ? ov.price : l.p.price,
          qty: l.qty,
          ownerId: l.p.ownerId,
          ownerName: l.p.ownerId ? ownerMap[l.p.ownerId] : undefined,
          // เก็บราคาปกติ + เหตุผล เมื่อขายราคาพิเศษ (ลดตำหนิ/แจกฟรี)
          origPrice: ov && ov.price !== l.p.price ? l.p.price : undefined,
          note: ov?.note,
        }
      }),
      ...setLines.map((l) => ({ kind: 'set' as const, refId: l.s.id, name: l.s.name, price: l.s.price, qty: l.qty })),
    ]

    if (boothRole === 'off' || boothRole === 'master') {
      // ── Local path (offline + master): ตัดสต็อก + ตัด lot FIFO เก็บต้นทุนลงบิล ──
      const sale: Sale = {
        id: uid(),
        eventId: currentEventId,
        eventName: event?.name ?? '',
        items,
        subtotal,
        setDiscount: mix.discount,
        discount,
        total,
        method,
        createdAt: Date.now(),
      }
      await db.transaction('rw', db.products, db.lots, db.sales, async () => {
        for (const item of sale.items) {
          if (item.kind === 'product') {
            const cur = await db.products.get(item.refId)
            if (cur) await db.products.update(item.refId, { stock: Math.max(0, cur.stock - item.qty) })
            item.cost = await consumeFIFO(item.refId, item.qty)
          } else {
            // fixed set: ตัดสต็อก + ต้นทุนตาม component
            const st = sets.find((x) => x.id === item.refId)
            let cogs = 0
            for (const c of st?.items ?? []) {
              const cur = await db.products.get(c.productId)
              if (cur) await db.products.update(c.productId, { stock: Math.max(0, cur.stock - c.qty * item.qty) })
              cogs += await consumeFIFO(c.productId, c.qty * item.qty)
            }
            item.cost = cogs
          }
        }
        await db.sales.add(sale)
      })
      if (boothRole === 'master') await enqueueSale(boothCode, sale)
    } else {
      // ── Helper path: NO local db writes; outbox only ──────────────────
      // Use eventId/eventName from the master's remoteCatalog snapshot.
      const sale = {
        id: uid(),
        eventId: remoteEventId,
        eventName: remoteEventName,
        items,
        subtotal,
        setDiscount: mix.discount,
        discount,
        total,
        method,
        createdAt: Date.now(),
      }
      // Optimistically add to sessionSales for instant feedback
      useApp.setState((s) => ({ sessionSales: [...s.sessionSales.filter((x) => x.id !== sale.id), sale] }))
      await enqueueSale(boothCode, sale)
    }

    setDone(true)
    setTimeout(() => {
      clearCart()
      setDone(false)
      go('pos')
    }, 1500)
  }

  return (
    <>
      <ScreenHeader
        title="ชำระเงิน"
        subtitle={`${event?.name ?? ''}${event ? ' · ' + thaiDate(event.date) : ''}`}
        back="pos"
      />

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {/* product lines */}
        {lines.map((l) => {
          const ov = overrides[l.p.id]
          const open = editingPrice === l.p.id
          return (
            <div key={l.p.id} className="border-b border-divider/10">
              <div className="flex items-center gap-3 py-2.5">
                <div className="h-11 w-11 overflow-hidden rounded-xl bg-[#20262b]">
                  {l.p.image && <img src={l.p.image} alt={l.p.name} className="h-full w-full object-cover" />}
                </div>
                <button onClick={() => openPriceEditor(l.p)} className="min-w-0 text-left">
                  <div className="truncate text-sm">{l.p.name}</div>
                  <div className="text-xs">
                    {ov && ov.price !== l.p.price ? (
                      <>
                        <span className="text-pewter line-through">{baht(l.p.price)}</span>{' '}
                        <span className="font-semibold text-[#e08cb8]">{ov.price === 0 ? 'ฟรี' : baht(ov.price)}</span>
                      </>
                    ) : (
                      <span className="text-pewter">{baht(l.p.price)}</span>
                    )}
                    {ov?.note && <span className="text-[#e08cb8]"> · {ov.note}</span>}
                    <span className={`ml-1.5 ${open ? 'text-electrum' : 'text-pewter/60'}`}>แก้ราคา</span>
                  </div>
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => decCart(l.p.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-divider/10 text-electrum">
                    <IconMinus width={16} height={16} />
                  </button>
                  <span className="w-6 text-center font-num text-base font-semibold">{l.qty}</span>
                  <button
                    onClick={() => {
                      if (l.qty >= l.p.stock) return showToast('สต็อกไม่พอ')
                      addToCart(l.p.id)
                    }}
                    disabled={l.qty >= l.p.stock}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-divider/10 text-electrum disabled:opacity-40"
                  >
                    <IconPlus width={16} height={16} />
                  </button>
                  <button onClick={() => removeCart(l.p.id)} className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-pewter">
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              </div>

              {/* price override editor */}
              {open && (
                <div className="mb-2.5 rounded-2xl border border-divider/10 bg-surface p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-pewter">ราคาพิเศษ/ชิ้น</span>
                    <div className="ml-auto flex items-center overflow-hidden rounded-xl border border-divider/20 bg-black/20">
                      <span className="pl-2.5 font-num text-sm font-semibold text-electrum">฿</span>
                      <input
                        inputMode="numeric"
                        value={ovRaw}
                        onChange={(e) => setOverridePrice(l.p, e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-[74px] bg-transparent px-2 py-2 text-right font-num text-base font-semibold text-milky outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {PRICE_NOTES.map((n) => (
                      <button
                        key={n}
                        onClick={() => toggleOverrideNote(l.p, n)}
                        className={`rounded-full border px-3 py-1.5 text-[12px] ${
                          ov?.note === n ? 'border-electrum bg-surface-2 text-electrum' : 'border-divider/10 text-pewter'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => clearOverride(l.p)}
                      className="ml-auto rounded-full border border-divider/20 px-3 py-1.5 text-[12px] text-pewter"
                    >
                      คืนราคาเดิม
                    </button>
                    <button
                      onClick={() => setEditingPrice(null)}
                      className="rounded-full bg-electrum px-3.5 py-1.5 text-[12px] font-semibold text-accent-on"
                    >
                      เสร็จ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* set lines */}
        {setLines.map((l) => {
          const avail = setAvailable(l.s, products)
          return (
            <div key={l.s.id} className="flex items-center gap-3 border-b border-divider/10 py-2.5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-electrum/10 text-electrum">
                <IconTag width={20} height={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm">{l.s.name}</div>
                <div className="text-xs text-electrum">เซ็ต · {baht(l.s.price)}</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => decSet(l.s.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-divider/10 text-electrum">
                  <IconMinus width={16} height={16} />
                </button>
                <span className="w-6 text-center font-num text-base font-semibold">{l.qty}</span>
                <button
                  onClick={() => {
                    if (l.qty >= avail) return showToast('สต็อกไม่พอ')
                    addSet(l.s.id)
                  }}
                  disabled={l.qty >= avail}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-divider/10 text-electrum disabled:opacity-40"
                >
                  <IconPlus width={16} height={16} />
                </button>
                <button onClick={() => removeSet(l.s.id)} className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-pewter">
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </div>
          )
        })}

        {/* summary */}
        <div className="mt-[18px] rounded-[18px] border border-divider/10 bg-surface p-4">
          <div className="mb-2 flex justify-between text-[13px] text-pewter">
            <span>ยอดรวม</span>
            <span className="font-num">{baht(subtotal)}</span>
          </div>

          {mix.discount > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-[13px] text-[#e08cb8]">
                <span>ส่วนลดโปรเซ็ต</span>
                <span className="font-num">− {baht(mix.discount)}</span>
              </div>
              {mix.perSet.map((ps) => (
                <div key={ps.set.id} className="pl-1 text-[11px] text-pewter">
                  {ps.set.name} · {ps.bundles} เซ็ต
                </div>
              ))}
            </div>
          )}

          <div className="my-2 flex items-center gap-2">
            <span className="text-[13px] font-medium text-electrum">ส่วนลดท้ายบิล</span>
            <div className="ml-auto flex items-center overflow-hidden rounded-xl border border-divider/20 bg-black/20">
              <input
                inputMode="numeric"
                value={discRaw}
                placeholder="0"
                onChange={(e) => setDiscRaw(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-[74px] bg-transparent px-2 py-2 text-right font-num text-base font-semibold text-milky outline-none placeholder:text-pewter"
              />
              <button onClick={() => setDiscMode('baht')} className={`h-[37px] w-[34px] border-l border-divider/10 text-sm font-semibold ${discMode === 'baht' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}>฿</button>
              <button onClick={() => setDiscMode('percent')} className={`h-[37px] w-[34px] border-l border-divider/10 text-sm font-semibold ${discMode === 'percent' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}>%</button>
            </div>
          </div>

          {discount > 0 && (
            <div className="mb-2 flex justify-between text-[13px] text-electrum">
              <span>ลดไป</span>
              <span className="font-num">− {baht(discount)}</span>
            </div>
          )}

          <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-divider/20 pt-3">
            <span className="text-sm">ยอดสุทธิ</span>
            <span className="font-num text-[26px] font-bold text-milky">{baht(total)}</span>
          </div>
        </div>

        {/* payment method */}
        <div className="mt-[18px] flex gap-2">
          <MethodBtn active={method === 'promptpay'} onClick={() => setMethod('promptpay')} icon={<IconQR width={17} height={17} />} label="พร้อมเพย์" />
          <MethodBtn active={method === 'cash'} onClick={() => setMethod('cash')} icon={<span className="font-num text-[15px] font-bold">฿</span>} label="เงินสด" />
        </div>

        {method === 'promptpay' ? (
          <div className="mt-3 rounded-[20px] border border-divider/20 bg-surface-2 p-5 text-center">
            <div className="mb-3.5 flex items-center justify-center gap-2">
              <span className="text-[13px] font-bold text-milky">PromptPay</span>
              <span className="rounded-md bg-electrum px-1.5 py-0.5 text-[9px] font-bold text-accent-on">พร้อมเพย์</span>
            </div>
            {payload ? (
              <div className="mx-auto h-[196px] w-[196px] rounded-2xl bg-white p-3.5 shadow-xl">
                <QRCodeSVG value={payload} className="h-full w-full" />
              </div>
            ) : (
              <div className="mx-auto flex h-[196px] w-[196px] items-center justify-center rounded-2xl border border-dashed border-divider/20 px-6 text-center text-xs text-pewter">
                ตั้งค่าเบอร์พร้อมเพย์ก่อน จึงจะสร้าง QR ได้
              </div>
            )}
            <div className="mt-3.5 font-num text-xl font-semibold text-milky">{baht(total)}</div>
            <div className="mt-1 text-[11px] text-pewter">{promptpay ? `เงินเข้าบัญชี ${promptpay}` : 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์'}</div>
          </div>
        ) : (
          <div className="mt-3 rounded-[20px] border border-divider/20 bg-surface p-6 text-center">
            <div className="text-[13px] text-pewter">รับเงินสด</div>
            <div className="mt-1 font-num text-[28px] font-bold text-electrum">{baht(total)}</div>
          </div>
        )}
      </div>

      {/* foot */}
      <div className="flex gap-2.5 border-t border-divider/10 bg-ink px-5 pb-safe pt-3.5">
        <button onClick={() => go('pos')} className="flex-none rounded-[15px] border border-divider/20 px-4 py-3.5 font-medium text-pewter">
          ยกเลิก
        </button>
        <button onClick={markPaid} className="flex flex-1 items-center justify-center gap-2 rounded-[15px] bg-electrum py-3.5 text-base font-bold text-accent-on shadow-lg">
          <IconCheck width={20} height={20} />
          {method === 'cash' ? 'รับเงินแล้ว' : 'จ่ายแล้ว'}
        </button>
      </div>

      {done && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-ink/95">
          <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-electrum text-electrum">
            <IconCheck width={46} height={46} strokeWidth={2.2} />
          </div>
          <h3 className="font-serif text-xl">บันทึกการขายแล้ว</h3>
          <p className="text-[13px] text-pewter">ตัดสต็อกอัตโนมัติ · เก็บเวลาให้แล้ว</p>
        </div>
      )}
    </>
  )
}

function MethodBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-[14px] font-semibold transition ${
        active ? 'border-electrum bg-electrum text-accent-on' : 'border-divider/10 bg-surface text-pewter'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
