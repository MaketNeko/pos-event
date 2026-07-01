import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { useApp } from '../store'
import { baht, thaiDate } from '../lib/format'
import { IconChart, IconGear, IconArrowRight } from '../components/Icons'
import { ShopAvatar } from '../components/ShopAvatar'

export function PosScreen() {
  const go = useApp((s) => s.go)
  const cart = useApp((s) => s.cart)
  const addToCart = useApp((s) => s.addToCart)
  const showToast = useApp((s) => s.showToast)
  const currentEventId = useApp((s) => s.currentEventId)
  const setCurrentEvent = useApp((s) => s.setCurrentEvent)

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const products = useLiveQuery(() => db.products.orderBy('order').toArray(), [])
  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const shopImage = useLiveQuery(() => getSetting('shopImage'), [])

  const [activeTab, setActiveTab] = useState<string>('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const onSale = (pid: string) => products?.find((p) => p.id === pid)
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const total = useMemo(
    () =>
      Object.entries(cart).reduce((s, [id, q]) => s + q * (onSale(id)?.price ?? 0), 0),
    [cart, products],
  )

  const visibleCats = (categories ?? []).filter((c) =>
    (products ?? []).some((p) => p.categoryId === c.id && p.active),
  )

  const event = events?.find((e) => e.id === currentEventId)

  const tap = (pid: string, stock: number) => {
    const inCart = cart[pid] ?? 0
    if (inCart >= stock) {
      showToast('สต็อกไม่พอ')
      return
    }
    addToCart(pid)
  }

  const jump = (id: string) => {
    setActiveTab(id)
    if (id === 'all') scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    else sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* top bar */}
      <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-b from-[#1b1e21] to-transparent px-4 pb-3.5 pt-[38px]">
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
        <button
          onClick={() => go('history')}
          className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-white/10 bg-surface text-pewter"
        >
          <IconChart width={20} height={20} />
        </button>
        <button
          onClick={() => go('settings')}
          className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-white/10 bg-surface text-pewter"
        >
          <IconGear width={20} height={20} />
        </button>
      </header>

      {/* tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1.5 pt-3.5">
        <Tab label="ทั้งหมด" active={activeTab === 'all'} onClick={() => jump('all')} />
        {visibleCats.map((c) => (
          <Tab
            key={c.id}
            label={c.name}
            active={activeTab === c.id}
            onClick={() => jump(c.id)}
          />
        ))}
      </div>

      {/* catalog */}
      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 pb-[200px] pt-2">
        {visibleCats.length === 0 && (
          <EmptyState onAdd={() => go('addProduct')} />
        )}
        {visibleCats.map((c) => {
          const items = (products ?? []).filter((p) => p.categoryId === c.id && p.active)
          return (
            <section
              key={c.id}
              ref={(el) => {
                sectionRefs.current[c.id] = el
              }}
              className="mt-[18px]"
            >
              <div className="mb-3 flex items-center gap-2.5 px-1">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: c.color }}
                />
                <h3 className="font-serif text-[15px] font-semibold" style={{ color: c.color }}>
                  {c.name}
                </h3>
                <span className="ml-auto text-[11px] text-pewter">{items.length} รายการ</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {items.map((p) => {
                  const q = cart[p.id] ?? 0
                  const out = p.stock <= 0
                  return (
                    <button
                      key={p.id}
                      disabled={out}
                      onClick={() => tap(p.id, p.stock)}
                      className={`relative flex flex-col overflow-hidden rounded-[18px] border border-white/10 bg-surface text-left transition active:scale-95 disabled:opacity-40 ${
                        out ? 'pointer-events-none' : ''
                      }`}
                      style={{ borderTop: `3px solid ${c.color}` }}
                    >
                      {q > 0 && (
                        <span className="absolute right-2 top-2 z-10 grid h-6 min-w-[24px] place-items-center rounded-xl bg-electrum px-1.5 text-xs font-bold text-[#2a2115] shadow">
                          {q}
                        </span>
                      )}
                      {out && (
                        <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-[#c96b6b]">
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
                        <div className="text-[13px] font-medium leading-tight text-milky">
                          {p.name}
                        </div>
                        <div className="flex items-baseline justify-between gap-1.5">
                          <span className="font-num text-base font-semibold" style={{ color: c.color }}>
                            {baht(p.price)}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                              p.stock <= 3
                                ? 'border-[#e7a76c]/30 text-[#E7A76C]'
                                : 'border-white/10 text-pewter'
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

      {/* cart bar */}
      <div
        className={`absolute inset-x-3.5 bottom-[82px] z-[45] flex items-center gap-3 rounded-[20px] border border-white/20 bg-gradient-to-br from-[#2c363f] to-[#232a30] py-3 pl-[18px] pr-3 shadow-2xl transition-transform duration-300 ${
          count === 0 ? 'translate-y-[160%]' : 'translate-y-0'
        }`}
      >
        <div className="flex flex-col">
          <span className="text-[11px] text-pewter">{count} รายการ</span>
          <span className="font-num text-[22px] font-semibold text-milky">{baht(total)}</span>
        </div>
        <button
          onClick={() => go('checkout')}
          className="ml-auto flex items-center gap-2 rounded-[14px] bg-electrum px-5 py-3 font-semibold text-[#2a2115]"
        >
          ชำระเงิน
          <IconArrowRight width={18} height={18} />
        </button>
      </div>
    </>
  )
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-medium transition ${
        active
          ? 'border-electrum bg-electrum font-semibold text-[#2a2115]'
          : 'border-white/10 bg-surface text-pewter'
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
        className="rounded-xl bg-electrum px-5 py-3 font-semibold text-[#2a2115]"
      >
        เพิ่มสินค้า
      </button>
    </div>
  )
}
