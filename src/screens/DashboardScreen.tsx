import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { SaleItem } from '../types'
import { db, getSetting } from '../db'
import { useApp } from '../store'
import { baht } from '../lib/format'
import { ShopAvatar } from '../components/ShopAvatar'
import { IconChevron, IconBack } from '../components/Icons'

// สีวิธีจ่ายเงิน (data-viz เท่านั้น ไม่ใช่ layout)
const PAY_COLOR = { promptpay: '#5B8AF0', cash: '#F0A05B' } as const

type Metric = 'revenue' | 'qty' | 'profit'

interface TopItem {
  id: string
  name: string
  qty: number
  revenue: number
  profit: number // ยอดขาย − ต้นทุน (บิลเก่าไม่มีข้อมูลต้นทุน = ต้นทุน 0)
}

const valOf = (i: { qty: number; revenue: number; profit: number }, m: Metric): number =>
  m === 'revenue' ? i.revenue : m === 'qty' ? i.qty : i.profit

const fmtVal = (v: number, m: Metric): string => (m === 'qty' ? `${v} ชิ้น` : baht(v))

interface DonutSlice {
  color: string
  value: number
}

// ---- sub-components ----

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-divider/10 bg-surface-2 p-3.5">
      <div className="text-[11px] text-pewter">{label}</div>
      <div className={`mt-1 font-num text-[20px] font-semibold leading-tight ${highlight ? 'text-electrum' : 'text-milky'}`}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl border border-divider/10 bg-surface-2 p-4">
      <div className="mb-3 text-[13px] font-semibold text-milky">{title}</div>
      {children}
    </div>
  )
}

function TopList({ items, metric, showAll }: { items: TopItem[]; metric: Metric; showAll: boolean }) {
  const display = showAll ? items : items.slice(0, 5)
  // items is pre-sorted, so items[0] is the max (กำไรอาจติดลบ — กันหารด้วยค่าลบ)
  const maxVal = items.length > 0 ? Math.max(0, valOf(items[0], metric)) : 1

  return (
    <div className="space-y-3">
      {display.map((item) => {
        const val = valOf(item, metric)
        const pct = maxVal > 0 ? Math.max(0, (val / maxVal) * 100) : 0
        return (
          <div key={item.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-milky">{item.name}</span>
              <span className={`flex-none font-num text-[12px] font-semibold ${metric === 'profit' && val < 0 ? 'text-danger' : 'text-electrum'}`}>
                {fmtVal(val, metric)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-divider/10">
                <div className="h-full rounded-full bg-electrum transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-[56px] flex-none text-right font-num text-[10px] text-pewter">
                {metric === 'qty' ? baht(item.revenue) : `${item.qty} ชิ้น`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OwnerBreakdown({
  items, breakdown, metric, showAll, expanded, onToggle,
}: {
  items: TopItem[]
  breakdown: Record<string, TopItem[]>
  metric: Metric
  showAll: boolean
  expanded: string | null
  onToggle: (key: string) => void
}) {
  const display = showAll ? items : items.slice(0, 5)
  const maxVal = items.length > 0 ? Math.max(0, valOf(items[0], metric)) : 1

  return (
    <div className="space-y-2.5">
      {display.map((item) => {
        const val = valOf(item, metric)
        const pct = maxVal > 0 ? Math.max(0, (val / maxVal) * 100) : 0
        const open = expanded === item.id
        const subs = breakdown[item.id] ?? []
        return (
          <div key={item.id} className="overflow-hidden rounded-xl border border-divider/10 bg-surface/40">
            <button onClick={() => onToggle(item.id)} className="w-full px-3 py-2.5 text-left active:bg-surface-2">
              <div className="mb-1 flex items-baseline gap-1.5">
                <IconChevron
                  width={13}
                  height={13}
                  className={`flex-none translate-y-[1px] text-pewter transition-transform ${open ? 'rotate-180' : ''}`}
                />
                <span className="min-w-0 flex-1 truncate text-[12px] text-milky">{item.name}</span>
                <span className={`flex-none font-num text-[12px] font-semibold ${metric === 'profit' && val < 0 ? 'text-danger' : 'text-electrum'}`}>
                  {fmtVal(val, metric)}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-[19px]">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-divider/10">
                  <div className="h-full rounded-full bg-electrum transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-[56px] flex-none text-right font-num text-[10px] text-pewter">
                  {metric === 'qty' ? baht(item.revenue) : `${item.qty} ชิ้น`}
                </span>
              </div>
            </button>
            {open && (
              <div className="border-t border-divider/10 bg-black/10 px-3 py-2">
                {subs.length === 0 ? (
                  <div className="text-[11px] text-pewter">ไม่มีรายการ</div>
                ) : (
                  subs.map((s) => (
                    <div key={s.id} className="flex items-baseline gap-2 py-0.5">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-pewter">{s.name}</span>
                      <span className="flex-none font-num text-[11px] text-milky">
                        {fmtVal(valOf(s, metric), metric)}
                      </span>
                      <span className="w-[52px] flex-none text-right font-num text-[10px] text-pewter">
                        {metric === 'qty' ? baht(s.revenue) : `${s.qty} ชิ้น`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  if (total === 0 || slices.length === 0) return null

  // สร้าง conic-gradient จาก slices
  let cum = 0
  const parts = slices.map((s) => {
    const start = cum
    const pct = (s.value / total) * 100
    cum += pct
    return `${s.color} ${start.toFixed(2)}% ${cum.toFixed(2)}%`
  })
  const gradient = `conic-gradient(${parts.join(', ')})`

  return (
    <div className="flex justify-center py-1">
      <div className="relative h-[116px] w-[116px]">
        {/* วงแหวนด้านนอก */}
        <div className="h-full w-full rounded-full" style={{ background: gradient }} />
        {/* รูตรงกลาง */}
        <div className="absolute left-1/2 top-1/2 h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-2" />
      </div>
    </div>
  )
}

function PaymentDonut({
  promptpay, cash, metric, total,
}: {
  promptpay: number
  cash: number
  metric: Metric
  total: number
}) {
  // กำไรอาจติดลบ — clamp ค่าที่ใช้วาดวงแหวน (ตัวเลขจริงยังแสดงใน legend)
  const ppDraw = Math.max(0, promptpay)
  const cashDraw = Math.max(0, cash)
  const drawTotal = ppDraw + cashDraw
  const ppPct = drawTotal > 0 ? (ppDraw / drawTotal) * 100 : 50
  const cashPct = drawTotal > 0 ? (cashDraw / drawTotal) * 100 : 50
  const gradient =
    drawTotal > 0
      ? `conic-gradient(${PAY_COLOR.promptpay} 0% ${ppPct.toFixed(2)}%, ${PAY_COLOR.cash} ${ppPct.toFixed(2)}% 100%)`
      : `conic-gradient(rgb(var(--c-divider) / 0.1) 0% 100%)`

  const fmt = (v: number) => (metric === 'qty' ? `${v} บิล` : baht(v))

  return (
    <>
      <div className="flex justify-center py-1">
        <div className="relative h-[116px] w-[116px]">
          <div className="h-full w-full rounded-full" style={{ background: gradient }} />
          <div className="absolute left-1/2 top-1/2 h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-2" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { key: 'promptpay', label: 'พร้อมเพย์', val: promptpay, pct: Math.round(ppPct) },
          { key: 'cash', label: 'เงินสด', val: cash, pct: Math.round(cashPct) },
        ].map(({ key, label, val, pct }) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: PAY_COLOR[key as keyof typeof PAY_COLOR] }}
            />
            <span className="min-w-0 flex-1 text-[12px] text-milky">{label}</span>
            <span className="font-num text-[12px] text-pewter">{fmt(val)}</span>
            <span className="w-[34px] flex-none text-right font-num text-[11px] text-pewter">
              {total > 0 ? pct : 0}%
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

// ---- main screen ----

export function DashboardScreen() {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const currentEventId = useApp((s) => s.currentEventId)
  const [filter, setFilter] = useState<string>(currentEventId || 'all')
  const [metric, setMetric] = useState<Metric>('revenue')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [showAllSets, setShowAllSets] = useState(false)
  const [showAllOwners, setShowAllOwners] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null)

  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])
  const sales = useLiveQuery(() => db.sales.orderBy('createdAt').toArray(), [])
  const products = useLiveQuery(() => db.products.toArray(), [])
  const owners = useLiveQuery(() => db.owners.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const shopImage = useLiveQuery(() => getSetting('shopImage'), [])

  // กรองตาม event ที่เลือก
  const filteredSales = (sales ?? []).filter((s) => filter === 'all' || s.eventId === filter)

  // ---- KPI ----
  const totalRevenue = filteredSales.reduce((s, x) => s + x.total, 0)
  const billCount = filteredSales.length
  const totalQty = filteredSales.reduce((s, x) => s + x.items.reduce((a, b) => a + b.qty, 0), 0)
  // ต้นทุนขาย (COGS) จาก item.cost ที่บันทึกตอนตัด lot — บิลเก่าไม่มีข้อมูล = 0
  const totalCost = filteredSales.reduce((s, x) => s + x.items.reduce((a, b) => a + (b.cost ?? 0), 0), 0)
  const totalProfit = totalRevenue - totalCost

  // ---- คิดต้นทุนย้อนหลังให้บิลเก่า (ที่ขายก่อนมีระบบต้นทุน) ----
  // นับเฉพาะบิลที่มีรายการซึ่งไม่เคยถูกคิดต้นทุน (cost === undefined ไม่ใช่ 0)
  const missingBills = filteredSales.filter((s) => s.items.some((i) => i.cost === undefined))

  /**
   * เติม item.cost ให้บิลเก่าในงานที่เลือก โดยใช้ "ต้นทุนตัวแทน" ของสินค้า
   * = ต้นทุนของ lot ล่าสุดที่มีต้นทุน > 0 (ของเก่าขายไปแล้ว ไม่ตัด lot ซ้ำ
   * เพราะสต็อกตอน migrate เป็นยอดหลังขายอยู่แล้ว)
   */
  async function backfillCosts() {
    if (missingBills.length === 0) return
    if (!window.confirm(
      `คิดต้นทุนย้อนหลังให้ ${missingBills.length} บิลในงานนี้ โดยใช้ต้นทุน lot ปัจจุบันของแต่ละสินค้า?\n(ใส่ต้นทุนใน lot ให้ครบก่อนกดนะ)`,
    )) return
    const [allLots, allSets] = await Promise.all([db.lots.toArray(), db.sets.toArray()])
    const rep: Record<string, number> = {}
    for (const lot of allLots.sort((a, b) => a.createdAt - b.createdAt)) {
      if (lot.cost > 0 || rep[lot.productId] === undefined) rep[lot.productId] = lot.cost
    }
    const setMap = Object.fromEntries(allSets.map((s) => [s.id, s]))
    const updated = missingBills.map((s) => ({
      ...s,
      items: s.items.map((i) => {
        if (i.cost !== undefined) return i
        if (i.kind === 'product') return { ...i, cost: i.qty * (rep[i.refId] ?? 0) }
        const unit = (setMap[i.refId]?.items ?? []).reduce((a, c) => a + c.qty * (rep[c.productId] ?? 0), 0)
        return { ...i, cost: i.qty * unit }
      }),
    }))
    await db.sales.bulkPut(updated)
    showToast(`ใส่ต้นทุนย้อนหลังให้ ${updated.length} บิลแล้ว`)
  }

  // ---- map สำหรับ join ----
  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  const categoryMap = Object.fromEntries((categories ?? []).map((c) => [c.id, c]))

  // ---- ตัวช่วยหาเจ้าของของ item ----
  // ใช้ snapshot ในบิลก่อน; ถ้าบิลไม่มี (ขายก่อนตั้งเจ้าของ) fallback ไปดูเจ้าของปัจจุบันของสินค้า
  const SHOP_OWNER_KEY = '__shop__'
  const prodOwnerById = new Map((products ?? []).map((p) => [p.id, p.ownerId]))
  const ownerNameById = Object.fromEntries((owners ?? []).map((o) => [o.id, o.name]))
  function resolveOwner(item: SaleItem): { key: string; name: string } {
    let ownerId = item.ownerId
    let ownerName = item.ownerName
    if (!ownerId) {
      const cur = prodOwnerById.get(item.refId)
      if (cur) { ownerId = cur; ownerName = ownerNameById[cur] }
    }
    return { key: ownerId ?? SHOP_OWNER_KEY, name: ownerName ?? (shopName || 'ของร้าน') }
  }
  // กรองทั้งหน้าเหลือเฉพาะเจ้าของที่เลือก (เฉพาะสินค้าเดี่ยว; เซ็ตไม่มีเจ้าของ)
  const ownerScoped = ownerFilter !== 'all'
  const inScope = (item: SaleItem) =>
    !ownerScoped || (item.kind === 'product' && resolveOwner(item).key === ownerFilter)

  // ---- สรุปสินค้าเดี่ยว (kind === 'product') ----
  const productAgg: Record<string, TopItem> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'product' || !inScope(item)) continue
      if (!productAgg[item.refId]) productAgg[item.refId] = { id: item.refId, name: item.name, qty: 0, revenue: 0, profit: 0 }
      productAgg[item.refId].qty += item.qty
      productAgg[item.refId].revenue += item.qty * item.price
      productAgg[item.refId].profit += item.qty * item.price - (item.cost ?? 0)
    }
  }
  const productList = Object.values(productAgg).sort((a, b) => valOf(b, metric) - valOf(a, metric))

  // ---- สรุปเซ็ต (kind === 'set') — ไม่แสดงเมื่อกรองรายเจ้าของ ----
  const setAgg: Record<string, TopItem> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'set' || ownerScoped) continue
      if (!setAgg[item.refId]) setAgg[item.refId] = { id: item.refId, name: item.name, qty: 0, revenue: 0, profit: 0 }
      setAgg[item.refId].qty += item.qty
      setAgg[item.refId].revenue += item.qty * item.price
      setAgg[item.refId].profit += item.qty * item.price - (item.cost ?? 0)
    }
  }
  const setList = Object.values(setAgg).sort((a, b) => valOf(b, metric) - valOf(a, metric))

  // ---- สรุปตามประเภท (เฉพาะ kind === 'product') ----
  type CatEntry = { id: string; name: string; color: string; qty: number; revenue: number; profit: number }
  const catAgg: Record<string, CatEntry> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'product' || !inScope(item)) continue
      const prod = productMap[item.refId]
      if (!prod) continue
      const cat = categoryMap[prod.categoryId]
      if (!cat) continue
      if (!catAgg[cat.id]) catAgg[cat.id] = { id: cat.id, name: cat.name, color: cat.color, qty: 0, revenue: 0, profit: 0 }
      catAgg[cat.id].qty += item.qty
      catAgg[cat.id].revenue += item.qty * item.price
      catAgg[cat.id].profit += item.qty * item.price - (item.cost ?? 0)
    }
  }
  const catList = Object.values(catAgg).sort((a, b) => valOf(b, metric) - valOf(a, metric))
  // โดนัทวาดจากค่าบวกเท่านั้น (กำไรติดลบวาดเป็นวงไม่ได้)
  const catTotal = catList.reduce((s, c) => s + Math.max(0, valOf(c, metric)), 0)

  // ---- สรุปตามเจ้าของ + รายสินค้าของแต่ละเจ้าของ (เฉพาะ kind === 'product') ----
  const ownerAgg: Record<string, TopItem> = {}
  const ownerProdAgg: Record<string, Record<string, TopItem>> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'product') continue
      const { key, name } = resolveOwner(item)
      if (!ownerAgg[key]) ownerAgg[key] = { id: key, name, qty: 0, revenue: 0, profit: 0 }
      ownerAgg[key].qty += item.qty
      ownerAgg[key].revenue += item.qty * item.price
      ownerAgg[key].profit += item.qty * item.price - (item.cost ?? 0)
      const bucket = (ownerProdAgg[key] ??= {})
      if (!bucket[item.refId]) bucket[item.refId] = { id: item.refId, name: item.name, qty: 0, revenue: 0, profit: 0 }
      bucket[item.refId].qty += item.qty
      bucket[item.refId].revenue += item.qty * item.price
      bucket[item.refId].profit += item.qty * item.price - (item.cost ?? 0)
    }
  }
  const ownerList = Object.values(ownerAgg).sort((a, b) => valOf(b, metric) - valOf(a, metric))
  const ownerProducts: Record<string, TopItem[]> = {}
  for (const key in ownerProdAgg) {
    ownerProducts[key] = Object.values(ownerProdAgg[key]).sort((a, b) => valOf(b, metric) - valOf(a, metric))
  }
  const ownerName = ownerScoped
    ? (ownerFilter === SHOP_OWNER_KEY ? (shopName || 'ของร้าน') : ownerNameById[ownerFilter] ?? 'เจ้าของ')
    : ''

  // ---- KPI แบบเคารพตัวกรองเจ้าของ ----
  let scopedRevenue = 0
  let scopedQty = 0
  let scopedCost = 0
  const scopedBills = new Set<string>()
  if (ownerScoped) {
    for (const sale of filteredSales) {
      let hit = false
      for (const item of sale.items) {
        if (!inScope(item)) continue
        scopedRevenue += item.qty * item.price
        scopedQty += item.qty
        scopedCost += item.cost ?? 0
        hit = true
      }
      if (hit) scopedBills.add(sale.id)
    }
  }
  const kpiRevenue = ownerScoped ? scopedRevenue : totalRevenue
  const kpiBills = ownerScoped ? scopedBills.size : billCount
  const kpiQty = ownerScoped ? scopedQty : totalQty
  const kpiAvg = kpiBills > 0 ? kpiRevenue / kpiBills : 0
  const kpiCost = ownerScoped ? scopedCost : totalCost
  const kpiProfit = ownerScoped ? scopedRevenue - scopedCost : totalProfit

  // ---- วิธีจ่ายเงิน ----
  const pay = {
    promptpay: { revenue: 0, bills: 0, profit: 0 },
    cash: { revenue: 0, bills: 0, profit: 0 },
  }
  for (const sale of filteredSales) {
    const saleCost = sale.items.reduce((a, b) => a + (b.cost ?? 0), 0)
    pay[sale.method].revenue += sale.total
    pay[sale.method].bills += 1
    pay[sale.method].profit += sale.total - saleCost
  }
  const payOf = (m: 'promptpay' | 'cash') =>
    metric === 'revenue' ? pay[m].revenue : metric === 'qty' ? pay[m].bills : pay[m].profit
  const payPromptpay = payOf('promptpay')
  const payCash = payOf('cash')
  const payTotal = payPromptpay + payCash

  return (
    <>
      {/* header — ตาม pattern ของ HistoryScreen */}
      <header className="flex items-center gap-3 border-b border-divider/10 px-4 pb-4 pt-[38px]">
        <button
          onClick={() => go('pos')}
          className="hidden h-10 w-10 flex-none place-items-center rounded-xl border border-divider/10 bg-surface text-milky lg:grid"
        >
          <IconBack width={20} height={20} />
        </button>
        <ShopAvatar image={shopImage} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-[17px] font-semibold leading-tight text-milky">
            {shopName || 'NekoPOS'}
          </div>
          <div className="text-[11px] text-pewter">สรุปยอดขาย</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-4">
        {/* dropdown เลือก event — ตาม pattern ของ HistoryScreen */}
        <div className="relative mb-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full appearance-none rounded-[13px] border border-divider/10 bg-surface py-3 pl-4 pr-10 text-[15px] font-medium text-milky outline-none focus:border-electrum"
          >
            <option value="all" className="bg-surface">ทุกงาน</option>
            {(events ?? []).map((e) => (
              <option key={e.id} value={e.id} className="bg-surface">{e.name}</option>
            ))}
          </select>
          <IconChevron
            width={18}
            height={18}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-pewter"
          />
        </div>

        {/* dropdown เลือกเจ้าของ — โผล่เฉพาะเมื่อมีเจ้าของฝากขาย */}
        {(owners ?? []).length > 0 && (
          <div className="relative mb-4">
            <select
              value={ownerFilter}
              onChange={(e) => { setOwnerFilter(e.target.value); setExpandedOwner(null) }}
              className="w-full appearance-none rounded-[13px] border border-divider/10 bg-surface py-3 pl-4 pr-10 text-[15px] font-medium text-milky outline-none focus:border-electrum"
            >
              <option value="all" className="bg-surface">ทุกเจ้าของ</option>
              <option value={SHOP_OWNER_KEY} className="bg-surface">{shopName || 'ของร้าน'}</option>
              {(owners ?? []).map((o) => (
                <option key={o.id} value={o.id} className="bg-surface">{o.name}</option>
              ))}
            </select>
            <IconChevron
              width={18}
              height={18}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-pewter"
            />
          </div>
        )}

        {/* metric toggle — ตาม pattern ฿/% ใน CheckoutScreen */}
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[12px] text-pewter">แสดงผลตาม</span>
          <div className="flex items-center overflow-hidden rounded-xl border border-divider/20 bg-black/20">
            <button
              onClick={() => setMetric('revenue')}
              className={`h-[34px] px-4 text-[13px] font-semibold transition ${metric === 'revenue' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}
            >
              ยอดเงิน
            </button>
            <button
              onClick={() => setMetric('qty')}
              className={`h-[34px] border-l border-divider/10 px-4 text-[13px] font-semibold transition ${metric === 'qty' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}
            >
              จำนวนชิ้น
            </button>
            <button
              onClick={() => setMetric('profit')}
              className={`h-[34px] border-l border-divider/10 px-4 text-[13px] font-semibold transition ${metric === 'profit' ? 'bg-electrum text-accent-on' : 'text-pewter'}`}
            >
              กำไร
            </button>
          </div>
        </div>

        {/* empty state */}
        {filteredSales.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-pewter">ยังไม่มีรายการขายในงานนี้</div>
        ) : (
          <>
            {ownerScoped && (
              <div className="mb-4 rounded-2xl border border-electrum/25 bg-electrum/10 px-4 py-2.5 text-[12px] text-milky">
                กำลังดูเฉพาะ <span className="font-semibold text-electrum">{ownerName}</span>
                <span className="text-pewter"> · ไม่รวมยอดที่ขายเป็นเซ็ต</span>
              </div>
            )}

            {/* 1. KPI cards */}
            <div className="mb-2 grid grid-cols-2 gap-3">
              <KpiCard label="ยอดสุทธิ" value={baht(kpiRevenue)} highlight />
              <KpiCard label="กำไร (หักต้นทุน)" value={baht(Math.round(kpiProfit))} highlight />
              <KpiCard label="ต้นทุนขาย" value={baht(Math.round(kpiCost))} />
              <KpiCard label={ownerScoped ? 'จำนวนบิลที่มีของคนนี้' : 'จำนวนบิล'} value={`${kpiBills} บิล`} />
              <KpiCard label="จำนวนชิ้นรวม" value={`${kpiQty} ชิ้น`} />
              <KpiCard label="ยอดเฉลี่ยต่อบิล" value={baht(Math.round(kpiAvg))} />
            </div>
            <div className="mb-4 px-1 text-[10px] text-pewter">
              * กำไรคิดจากต้นทุน LOT ที่บันทึกไว้ — บิลที่ขายก่อนมีระบบต้นทุนจะนับต้นทุนเป็น 0
            </div>

            {/* คิดต้นทุนย้อนหลัง — โผล่เฉพาะเมื่อเลือกงานแล้วมีบิลเก่าที่ยังไม่มีต้นทุน */}
            {filter !== 'all' && missingBills.length > 0 && (
              <button
                onClick={() => void backfillCosts()}
                className="mb-4 w-full rounded-[13px] border border-electrum/30 bg-electrum/10 py-2.5 text-[12px] font-medium text-electrum"
              >
                คิดต้นทุนย้อนหลังให้บิลเก่าในงานนี้ ({missingBills.length} บิล)
              </button>
            )}

            {/* 2. สินค้าเดี่ยวขายดี */}
            <Section title="สินค้าเดี่ยวขายดี">
              {productList.length === 0 ? (
                <div className="py-3 text-center text-[12px] text-pewter">ไม่มีข้อมูล</div>
              ) : (
                <>
                  <TopList items={productList} metric={metric} showAll={showAllProducts} />
                  {productList.length > 5 && (
                    <button
                      onClick={() => setShowAllProducts((v) => !v)}
                      className="mt-3 w-full text-center text-[12px] text-electrum"
                    >
                      {showAllProducts
                        ? 'แสดงน้อยลง'
                        : `ดูทั้งหมด (${productList.length} รายการ)`}
                    </button>
                  )}
                </>
              )}
            </Section>

            {/* 3. เซ็ต/โปรโมชั่นขายดี — ซ่อนเมื่อกรองรายเจ้าของ (เซ็ตไม่มีเจ้าของ) */}
            {!ownerScoped && (
              <Section title="เซ็ต/โปรโมชั่นขายดี">
                {setList.length === 0 ? (
                  <div className="py-3 text-center text-[12px] text-pewter">ไม่มีข้อมูล</div>
                ) : (
                  <>
                    <TopList items={setList} metric={metric} showAll={showAllSets} />
                    {setList.length > 5 && (
                      <button
                        onClick={() => setShowAllSets((v) => !v)}
                        className="mt-3 w-full text-center text-[12px] text-electrum"
                      >
                        {showAllSets
                          ? 'แสดงน้อยลง'
                          : `ดูทั้งหมด (${setList.length} รายการ)`}
                      </button>
                    )}
                  </>
                )}
              </Section>
            )}

            {/* 4. ประเภทขายดี (conic-gradient donut + legend) */}
            <Section title="ประเภทขายดี">
              {catList.length === 0 ? (
                <div className="py-3 text-center text-[12px] text-pewter">ไม่มีข้อมูล</div>
              ) : (
                <>
                  <DonutChart
                    slices={catList.map((c) => ({
                      color: c.color,
                      value: Math.max(0, valOf(c, metric)),
                    }))}
                    total={catTotal}
                  />
                  <div className="mt-3 space-y-1.5">
                    {catList.map((c) => {
                      const val = valOf(c, metric)
                      const pct = catTotal > 0 ? Math.round((Math.max(0, val) / catTotal) * 100) : 0
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 flex-none rounded-full"
                            style={{ background: c.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-milky">{c.name}</span>
                          <span className={`font-num text-[12px] ${metric === 'profit' && val < 0 ? 'text-danger' : 'text-pewter'}`}>
                            {fmtVal(val, metric)}
                          </span>
                          <span className="w-[34px] flex-none text-right font-num text-[11px] text-pewter">
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-2 text-[11px] text-pewter">* ไม่รวมเซ็ต</div>
                </>
              )}
            </Section>

            {/* 5. ยอดขายแยกตามเจ้าของ — กดชื่อเพื่อกางดูรายสินค้า (ซ่อนเมื่อกรองรายเจ้าของแล้ว) */}
            {!ownerScoped && (
              <Section title="ยอดขายแยกตามเจ้าของ">
                {ownerList.length === 0 ? (
                  <div className="py-3 text-center text-[12px] text-pewter">ไม่มีข้อมูล</div>
                ) : (
                  <>
                    <OwnerBreakdown
                      items={ownerList}
                      breakdown={ownerProducts}
                      metric={metric}
                      showAll={showAllOwners}
                      expanded={expandedOwner}
                      onToggle={(k) => setExpandedOwner((cur) => (cur === k ? null : k))}
                    />
                    {ownerList.length > 5 && (
                      <button
                        onClick={() => setShowAllOwners((v) => !v)}
                        className="mt-3 w-full text-center text-[12px] text-electrum"
                      >
                        {showAllOwners
                          ? 'แสดงน้อยลง'
                          : `ดูทั้งหมด (${ownerList.length} ราย)`}
                      </button>
                    )}
                    <div className="mt-2 text-[11px] text-pewter">* แตะชื่อเพื่อดูรายสินค้า · ไม่รวมยอดที่ขายเป็นเซ็ต</div>
                  </>
                )}
              </Section>
            )}

            {/* 6. วิธีจ่ายเงิน — ซ่อนเมื่อกรองรายเจ้าของ (จ่ายเงินเป็นระดับบิล แยกรายคนไม่ได้) */}
            {!ownerScoped && (
            <Section title="วิธีจ่ายเงิน">
              <PaymentDonut
                promptpay={payPromptpay}
                cash={payCash}
                metric={metric}
                total={payTotal}
              />
            </Section>
            )}
          </>
        )}
      </div>
    </>
  )
}
