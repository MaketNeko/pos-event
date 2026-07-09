import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { QRCodeSVG } from 'qrcode.react'
import { db, getSetting, uid } from '../db'
import { useApp } from '../store'
import { baht, thaiDate } from '../lib/format'
import { promptPayPayload } from '../lib/promptpay'
import { computeMix, setAvailable } from '../lib/sets'
import {
  IconChart,
  IconGear,
  IconArrowRight,
  IconTag,
  IconTrash,
  IconCheck,
  IconPlus,
  IconMinus,
  IconQR,
  IconClock,
} from '../components/Icons'
import { ShopAvatar } from '../components/ShopAvatar'
import type { SaleItem, Product, ProductSet } from '../types'

type Line = { p: Product; qty: number }
type SetLine = { s: ProductSet; qty: number }

export function PosScreen() {
  const go = useApp((s) => s.go)
  const cart = useApp((s) => s.cart)
  const addToCart = useApp((s) => s.addToCart)
  const decCart = useApp((s) => s.decCart)
  const setCart = useApp((s) => s.setCart)
  const addSet = useApp((s) => s.addSet)
  const decSet = useApp((s) => s.decSet)
  const clearCart = useApp((s) => s.clearCart)
  const showToast = useApp((s) => s.showToast)
  const currentEventId = useApp((s) => s.currentEventId)
  const setCurrentEvent = useApp((s) => s.setCurrentEvent)

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const products = useLiveQuery(() => db.products.orderBy('order').toArray(), [])
  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])
  const sets = useLiveQuery(() => db.sets.orderBy('order').toArray(), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const shopImage = useLiveQuery(() => getSetting('shopImage'), [])
  const promptpay = useLiveQuery(() => getSetting('promptpay'), []) ?? ''

  const [activeTab, setActiveTab] = useState<string>('all')
  const [discRaw, setDiscRaw] = useState('')
  const [discMode, setDiscMode] = useState<'baht' | 'percent'>('baht')
  const [method, setMethod] = useState<'promptpay' | 'cash'>('promptpay')
  const [wideDone, setWideDone] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const onSale = (pid: string) => products?.find((p) => p.id === pid)
  const activeFixed = (sets ?? []).filter((s) => s.type === 'fixed' && s.active)
  const mixSets = (sets ?? []).filter((s) => s.type === 'mix' && s.active)
  const count =
    Object.values(cart).reduce((a, b) => a + b, 0) +
    Object.values(setCart).reduce((a, b) => a + b, 0)

  const total = useMemo(() => {
    const prod = Object.entries(cart).reduce((s, [id, q]) => s + q * (onSale(id)?.price ?? 0), 0)
    const set = Object.entries(setCart).reduce(
      (s, [id, q]) => s + q * ((sets ?? []).find((x) => x.id === id)?.price ?? 0),
      0,
    )
    return prod + set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, setCart, products, sets])

  const visibleCats = (categories ?? []).filter((c) =>
    (products ?? []).some((p) => p.categoryId === c.id && p.active),
  )

  const event = events?.find((e) => e.id === currentEventId)

  // wide panel computed values
  const lines = useMemo<Line[]>(() => {
    const out: Line[] = []
    for (const [id, qty] of Object.entries(cart)) {
      const p = products?.find((x) => x.id === id)
      if (p) out.push({ p, qty })
    }
    return out
  }, [cart, products])

  const setLines = useMemo<SetLine[]>(() => {
    const out: SetLine[] = []
    for (const [id, qty] of Object.entries(setCart)) {
      const s = sets?.find((x) => x.id === id)
      if (s) out.push({ s, qty })
    }
    return out
  }, [setCart, sets])

  const mix = computeMix(mixSets, cart, products ?? [])
  const afterMix = Math.max(0, total - mix.discount)
  const wideDiscount = useMemo(() => {
    const v = Math.max(0, parseFloat(discRaw) || 0)
    const d = discMode === 'percent' ? (afterMix * Math.min(v, 100)) / 100 : Math.min(v, afterMix)
    return Math.round(d)
  }, [discRaw, discMode, afterMix])
  const wideTotal = Math.max(0, total - mix.discount - wideDiscount)
  const empty = lines.length === 0 && setLines.length === 0
  const payload =
    method === 'promptpay' && promptpay && wideTotal > 0
      ? promptPayPayload(promptpay, wideTotal)
      : ''

  const tap = (pid: string, stock: number) => {
    if ((cart[pid] ?? 0) >= stock) { showToast('สต็อกไม่พอ'); return }
    addToCart(pid)
  }

  const tapSet = (setId: string, avail: number) => {
    if ((setCart[setId] ?? 0) >= avail) { showToast('สต็อกไม่พอ'); return }
    addSet(setId)
  }

  const jump = (id: string) => {
    setActiveTab(id)
    if (id === 'all') scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    else sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function markPaid() {
    if (empty) return
    const items: SaleItem[] = [
      ...lines.map((l) => ({ kind: 'product' as const, refId: l.p.id, name: l.p.name, price: l.p.price, qty: l.qty })),
      ...setLines.map((l) => ({ kind: 'set' as const, refId: l.s.id, name: l.s.name, price: l.s.price, qty: l.qty })),
    ]
    await db.transaction('rw', db.products, db.sales, async () => {
      for (const l of lines) {
        const cur = await db.products.get(l.p.id)
        if (cur) await db.products.update(l.p.id, { stock: Math.max(0, cur.stock - l.qty) })
      }
      for (const l of setLines) {
        for (const c of l.s.items ?? []) {
          const cur = await db.products.get(c.productId)
          if (cur) await db.products.update(c.productId, { stock: Math.max(0, cur.stock - c.qty * l.qty) })
        }
      }
      await db.sales.add({
        id: uid(),
        eventId: currentEventId,
        eventName: event?.name ?? '',
        items,
        subtotal: total,
        setDiscount: mix.discount,
        discount: wideDiscount,
        total: wideTotal,
        method,
        createdAt: Date.now(),
      })
    })
    setShowQR(false)
    setWideDone(true)
    setTimeout(() => {
      clearCart()
      setDiscRaw('')
      setWideDone(false)
    }, 1500)
  }

  const qBtn = 'grid h-6 w-6 place-items-center rounded-lg border border-divider/10 text-electrum disabled:opacity-40'

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">

      {/* ── LEFT pane ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:border-r lg:border-divider/10">

        {/* top bar */}
        <header className="flex items-center gap-3 border-b border-divider/10 bg-gradient-to-b from-ink to-transparent px-4 pb-3.5 pt-[38px] lg:pt-3.5">
          <ShopAvatar image={shopImage} size={46} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-[17px] font-semibold leading-tight text-milky">
              {shopName || 'NekoPOS'}
            </div>
            <div className="flex items-center gap-1">
              <select
                value={currentEventId}
                onChange={(e) => setCurrentEvent(e.target.value)}
                className="max-w-[62%] truncate bg-transparent text-[13px] font-medium text-electrum outline-none"
              >
                {(events ?? []).map((e) => (
                  <option key={e.id} value={e.id} className="bg-surface text-milky">
                    {e.name}
                  </option>
                ))}
              </select>
              <span className="truncate text-[11px] text-pewter">
                · {event ? thaiDate(event.date) : '—'}
              </span>
            </div>
          </div>
          {/* mobile: history + settings */}
          <button
            onClick={() => go('history')}
            className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-divider/10 bg-surface text-pewter lg:hidden"
          >
            <IconChart width={20} height={20} />
          </button>
          <button
            onClick={() => go('settings')}
            className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-divider/10 bg-surface text-pewter lg:hidden"
          >
            <IconGear width={20} height={20} />
          </button>
          {/* lg: history + dashboard + settings */}
          <button
            onClick={() => go('history')}
            className="hidden h-[42px] w-[42px] place-items-center rounded-xl border border-divider/10 bg-surface text-pewter lg:grid"
            title="ประวัติการขาย"
          >
            <IconClock width={20} height={20} />
          </button>
          <button
            onClick={() => go('dashboard')}
            className="hidden h-[42px] w-[42px] place-items-center rounded-xl border border-divider/10 bg-surface text-pewter lg:grid"
            title="แดชบอร์ด"
          >
            <IconChart width={20} height={20} />
          </button>
          <button
            onClick={() => go('settings')}
            className="hidden h-[42px] w-[42px] place-items-center rounded-xl border border-divider/10 bg-surface text-pewter lg:grid"
            title="ตั้งค่า"
          >
            <IconGear width={20} height={20} />
          </button>
        </header>

        {/* tabs */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1.5 pt-3.5">
          <Tab label="ทั้งหมด" active={activeTab === 'all'} onClick={() => jump('all')} />
          {activeFixed.length > 0 && (
            <Tab label="เซ็ต" active={activeTab === '__sets'} onClick={() => jump('__sets')} />
          )}
          {visibleCats.map((c) => (
            <Tab key={c.id} label={c.name} active={activeTab === c.id} onClick={() => jump(c.id)} />
          ))}
        </div>

        {/* mix & match promo hints */}
        {mixSets.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-0.5 pt-1">
            {mixSets.map((m) => (
              <span
                key={m.id}
                className="flex-none whitespace-nowrap rounded-full border border-[#D07AA4]/40 bg-[#D07AA4]/10 px-3 py-1 text-[11px] text-[#e08cb8]"
              >
                {m.name} · {m.n} ชิ้น {baht(m.price)}
              </span>
            ))}
          </div>
        )}

        {/* catalog */}
        <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 pb-[200px] pt-2 lg:pb-6">
          {visibleCats.length === 0 && activeFixed.length === 0 && (
            <EmptyState onAdd={() => go('addProduct')} />
          )}

          {/* fixed set cards */}
          {activeFixed.length > 0 && (
            <section
              ref={(el) => { sectionRefs.current['__sets'] = el }}
              className="mt-[18px]"
            >
              <div className="mb-3 flex items-center gap-2.5 px-1">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-electrum" />
                <h3 className="font-serif text-[15px] font-semibold text-electrum">เซ็ต</h3>
                <span className="ml-auto text-[11px] text-pewter">{activeFixed.length} รายการ</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {activeFixed.map((s) => {
                  const avail = setAvailable(s, products ?? [])
                  const q = setCart[s.id] ?? 0
                  const out = avail <= 0
                  return (
                    <button
                      key={s.id}
                      disabled={out}
                      onClick={() => tapSet(s.id, avail)}
                      className="relative flex flex-col overflow-hidden rounded-[18px] border border-electrum/30 bg-surface text-left transition active:scale-95 disabled:opacity-40"
                      style={{ borderTop: '3px solid #E7CB9C' }}
                    >
                      {q > 0 && (
                        <span className="absolute right-2 top-2 z-10 grid h-6 min-w-[24px] place-items-center rounded-xl bg-electrum px-1.5 text-xs font-bold text-accent-on shadow">
                          {q}
                        </span>
                      )}
                      <div className="grid aspect-square w-full place-items-center bg-[#20262b] text-electrum/70">
                        <IconTag width={40} height={40} />
                      </div>
                      <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
                        <div className="text-[13px] font-medium leading-tight text-milky">{s.name}</div>
                        <div className="flex items-baseline justify-between gap-1.5">
                          <span className="font-num text-base font-semibold text-electrum">{baht(s.price)}</span>
                          <span className="rounded-full border border-divider/10 px-1.5 py-0.5 text-[10px] text-pewter">
                            {out ? 'หมด' : `เหลือ ${avail}`}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {visibleCats.map((c) => {
            const items = (products ?? []).filter((p) => p.categoryId === c.id && p.active)
            return (
              <section
                key={c.id}
                ref={(el) => { sectionRefs.current[c.id] = el }}
                className="mt-[18px]"
              >
                <div className="mb-3 flex items-center gap-2.5 px-1">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                  <h3 className="font-serif text-[15px] font-semibold" style={{ color: c.color }}>
                    {c.name}
                  </h3>
                  <span className="ml-auto text-[11px] text-pewter">{items.length} รายการ</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((p) => {
                    const q = cart[p.id] ?? 0
                    const out = p.stock <= 0
                    return (
                      <button
                        key={p.id}
                        disabled={out}
                        onClick={() => tap(p.id, p.stock)}
                        className={`relative flex flex-col overflow-hidden rounded-[18px] border border-divider/10 bg-surface text-left transition active:scale-95 disabled:opacity-40 ${
                          out ? 'pointer-events-none' : ''
                        }`}
                        style={{ borderTop: `3px solid ${c.color}` }}
                      >
                        {q > 0 && (
                          <span className="absolute right-2 top-2 z-10 grid h-6 min-w-[24px] place-items-center rounded-xl bg-electrum px-1.5 text-xs font-bold text-accent-on shadow">
                            {q}
                          </span>
                        )}
                        {out && (
                          <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-danger">
                            หมด
                          </span>
                        )}
                        <div className="aspect-square w-full bg-[#20262b]">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-3xl font-serif text-white/15">
                              {p.name.slice(0, 1)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
                          <div className="text-[13px] font-medium leading-tight text-milky">{p.name}</div>
                          <div className="flex items-baseline justify-between gap-1.5">
                            <span className="font-num text-base font-semibold" style={{ color: c.color }}>
                              {baht(p.price)}
                            </span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                                p.stock <= 3
                                  ? 'border-[#e7a76c]/30 text-[#E7A76C]'
                                  : 'border-divider/10 text-pewter'
                              }`}
                            >
                              {out ? 'หมด' : `เหลือ ${p.stock}`}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT pane (lg+) ── */}
      <div className="hidden w-[380px] flex-none flex-col border-l border-divider/10 bg-[#191c1f] lg:flex">

        {/* cart header */}
        <div className="flex items-center gap-2.5 border-b border-divider/10 px-4 py-3.5">
          <h2 className="font-serif text-[17px] font-semibold text-milky">ออเดอร์</h2>
          <span className="text-xs text-pewter">{count} รายการ</span>
          <button
            onClick={() => { if (count > 0 && window.confirm('ยกเลิกรายการทั้งหมด?')) clearCart() }}
            className="ml-auto grid h-9 w-9 place-items-center rounded-[11px] border border-divider/10 text-pewter transition hover:border-danger/30 hover:text-danger"
            aria-label="ยกเลิกรายการทั้งหมด"
          >
            <IconTrash width={17} height={17} />
          </button>
        </div>

        {/* cart items */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-1.5">
          {empty ? (
            <div className="py-16 text-center text-[13px] text-pewter">
              แตะสินค้าทางซ้ายเพื่อเพิ่มลงออเดอร์
            </div>
          ) : (
            <>
              {lines.map((l) => (
                <div key={l.p.id} className="flex items-center gap-2.5 border-b border-divider/10 py-2.5">
                  <div className="h-10 w-10 flex-none overflow-hidden rounded-xl bg-surface">
                    {l.p.image && <img src={l.p.image} alt={l.p.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{l.p.name}</div>
                    <div className="text-[11px] text-pewter">{baht(l.p.price)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => decCart(l.p.id)} className={qBtn}>
                      <IconMinus width={14} height={14} />
                    </button>
                    <span className="w-5 text-center font-num text-[13px] font-semibold">{l.qty}</span>
                    <button
                      onClick={() => { if (l.qty >= l.p.stock) return showToast('สต็อกไม่พอ'); addToCart(l.p.id) }}
                      disabled={l.qty >= l.p.stock}
                      className={qBtn}
                    >
                      <IconPlus width={14} height={14} />
                    </button>
                  </div>
                  <div className="w-[56px] flex-none text-right font-num text-[13px] font-semibold text-milky">
                    {baht(l.p.price * l.qty)}
                  </div>
                </div>
              ))}
              {setLines.map((l) => {
                const avail = setAvailable(l.s, products ?? [])
                return (
                  <div key={l.s.id} className="flex items-center gap-2.5 border-b border-divider/10 py-2.5">
                    <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-electrum/10 text-electrum">
                      <IconTag width={18} height={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{l.s.name}</div>
                      <div className="text-[11px] text-electrum">เซ็ต · {baht(l.s.price)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => decSet(l.s.id)} className={qBtn}>
                        <IconMinus width={14} height={14} />
                      </button>
                      <span className="w-5 text-center font-num text-[13px] font-semibold">{l.qty}</span>
                      <button
                        onClick={() => { if (l.qty >= avail) return showToast('สต็อกไม่พอ'); addSet(l.s.id) }}
                        disabled={l.qty >= avail}
                        className={qBtn}
                      >
                        <IconPlus width={14} height={14} />
                      </button>
                    </div>
                    <div className="w-[56px] flex-none text-right font-num text-[13px] font-semibold text-milky">
                      {baht(l.s.price * l.qty)}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* footer */}
        <div className="flex-none border-t border-divider/10 bg-ink/50 px-4 pb-4 pt-3">
          <div className="mb-1.5 flex justify-between text-[13px] text-pewter">
            <span>ยอดรวม</span>
            <span className="font-num">{baht(total)}</span>
          </div>
          {mix.discount > 0 && (
            <div className="mb-1.5 flex justify-between text-[13px] text-[#e08cb8]">
              <span>ส่วนลดโปรเซ็ต</span>
              <span className="font-num">− {baht(mix.discount)}</span>
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
                className="w-[60px] bg-transparent px-2 py-1.5 text-right font-num text-[15px] font-semibold text-milky outline-none placeholder:text-pewter"
              />
              <button
                onClick={() => setDiscMode('baht')}
                className={`h-[34px] w-[32px] border-l border-divider/10 text-[13px] font-semibold transition ${discMode === 'baht' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}
              >฿</button>
              <button
                onClick={() => setDiscMode('percent')}
                className={`h-[34px] w-[32px] border-l border-divider/10 text-[13px] font-semibold transition ${discMode === 'percent' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}
              >%</button>
            </div>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed border-divider/20 pb-3 pt-2.5">
            <span className="text-sm">ยอดสุทธิ</span>
            <span className="font-num text-[26px] font-bold text-milky">{baht(wideTotal)}</span>
          </div>
          <div className="flex gap-2 pb-3">
            <button
              onClick={() => setMethod('promptpay')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-semibold transition ${
                method === 'promptpay' ? 'border-electrum bg-electrum text-accent-on' : 'border-divider/10 bg-surface text-pewter'
              }`}
            >
              <IconQR width={15} height={15} />พร้อมเพย์
            </button>
            <button
              onClick={() => setMethod('cash')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-semibold transition ${
                method === 'cash' ? 'border-electrum bg-electrum text-accent-on' : 'border-divider/10 bg-surface text-pewter'
              }`}
            >
              <span className="font-num text-[14px] font-bold">฿</span>เงินสด
            </button>
          </div>
          <button
            disabled={empty}
            onClick={() => {
              if (empty) return
              if (method === 'cash') { void markPaid(); return }
              setShowQR(true)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-electrum py-4 text-[15px] font-bold text-accent-on shadow disabled:opacity-40"
          >
            <IconCheck width={19} height={19} />
            {method === 'cash' ? 'รับเงินแล้ว' : 'จ่ายแล้ว'}
          </button>
        </div>
      </div>

      {/* ── floating cart bar (mobile only) ── */}
      <div
        className={`absolute inset-x-3.5 bottom-[82px] z-[45] flex items-center gap-2.5 rounded-[20px] border border-divider/20 bg-surface-2 py-3 pl-3 pr-3 shadow-2xl transition-transform duration-300 lg:hidden ${
          count === 0 ? 'translate-y-[160%]' : 'translate-y-0'
        }`}
      >
        <button
          onClick={() => { if (window.confirm('ยกเลิกรายการทั้งหมด?')) clearCart() }}
          className="grid h-11 w-11 flex-none place-items-center rounded-[14px] border border-divider/15 text-pewter active:scale-95"
          aria-label="ยกเลิกรายการ"
        >
          <IconTrash width={18} height={18} />
        </button>
        <div className="flex flex-col">
          <span className="text-[11px] text-pewter">{count} รายการ</span>
          <span className="font-num text-[22px] font-semibold text-milky">{baht(total)}</span>
        </div>
        <button
          onClick={() => go('checkout')}
          className="ml-auto flex items-center gap-2 rounded-[14px] bg-electrum px-5 py-3 font-semibold text-accent-on"
        >
          ชำระเงิน
          <IconArrowRight width={18} height={18} />
        </button>
      </div>

      {/* ── QR overlay (lg only) ── */}
      {showQR && (
        <div className="absolute inset-0 z-[90] hidden items-center justify-center bg-ink/85 backdrop-blur-sm lg:flex">
          <div className="w-[400px] rounded-2xl border border-divider/20 bg-surface-2 p-6 text-center shadow-2xl">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className="text-[14px] font-bold text-milky">PromptPay</span>
              <span className="rounded-md bg-electrum px-1.5 py-0.5 text-[9px] font-bold text-accent-on">พร้อมเพย์</span>
            </div>
            {payload ? (
              <div className="mx-auto h-[220px] w-[220px] rounded-2xl bg-white p-3.5 shadow-xl">
                <QRCodeSVG value={payload} className="h-full w-full" />
              </div>
            ) : (
              <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-dashed border-divider/20 px-6 text-center text-xs text-pewter">
                ตั้งค่าเบอร์พร้อมเพย์ก่อน จึงจะสร้าง QR ได้
              </div>
            )}
            <div className="mt-3.5 font-num text-[28px] font-bold text-milky">{baht(wideTotal)}</div>
            <div className="mt-0.5 text-[11px] text-pewter">
              {promptpay ? `เงินเข้าบัญชี ${promptpay}` : 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์'}
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 rounded-[13px] border border-divider/20 py-3.5 text-[14px] font-semibold text-pewter transition hover:border-divider/40"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void markPaid()}
                className="flex flex-1 items-center justify-center gap-2 rounded-[13px] bg-electrum py-3.5 text-[14px] font-bold text-accent-on"
              >
                <IconCheck width={17} height={17} />ยืนยันรับเงินแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── done overlay (lg only) ── */}
      {wideDone && (
        <div className="absolute inset-0 z-[90] hidden flex-col items-center justify-center gap-4 bg-ink/95 lg:flex">
          <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-electrum text-electrum">
            <IconCheck width={46} height={46} />
          </div>
          <h3 className="font-serif text-xl">บันทึกการขายแล้ว</h3>
          <p className="text-[13px] text-pewter">ตัดสต็อกอัตโนมัติ · เก็บเวลาให้แล้ว</p>
        </div>
      )}
    </div>
  )
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-medium transition ${
        active
          ? 'border-electrum bg-electrum font-semibold text-accent-on'
          : 'border-divider/10 bg-surface text-pewter'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-24 text-center">
      <p className="text-sm text-pewter">
        ยังไม่มีสินค้าเปิดขาย
        <br />
        เพิ่มสินค้าก่อนเริ่มขายได้เลย
      </p>
      <button
        onClick={onAdd}
        className="rounded-xl bg-electrum px-5 py-3 font-semibold text-accent-on"
      >
        เพิ่มสินค้า
      </button>
    </div>
  )
}
