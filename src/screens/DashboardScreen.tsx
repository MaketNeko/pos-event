import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { useApp } from '../store'
import { baht } from '../lib/format'
import { ShopAvatar } from '../components/ShopAvatar'
import { IconChevron } from '../components/Icons'

// สีวิธีจ่ายเงิน (data-viz เท่านั้น ไม่ใช่ layout)
const PAY_COLOR = { promptpay: '#5B8AF0', cash: '#F0A05B' } as const

type Metric = 'revenue' | 'qty'

interface TopItem {
  id: string
  name: string
  qty: number
  revenue: number
}

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
  // items is pre-sorted, so items[0] is the max
  const maxVal = items.length > 0 ? (metric === 'revenue' ? items[0].revenue : items[0].qty) : 1

  return (
    <div className="space-y-3">
      {display.map((item) => {
        const val = metric === 'revenue' ? item.revenue : item.qty
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
        return (
          <div key={item.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-milky">{item.name}</span>
              <span className="flex-none font-num text-[12px] font-semibold text-electrum">
                {metric === 'revenue' ? baht(item.revenue) : `${item.qty} ชิ้น`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-divider/10">
                <div className="h-full rounded-full bg-electrum transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-[56px] flex-none text-right font-num text-[10px] text-pewter">
                {metric === 'revenue' ? `${item.qty} ชิ้น` : baht(item.revenue)}
              </span>
            </div>
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
  const ppPct = total > 0 ? (promptpay / total) * 100 : 50
  const cashPct = total > 0 ? (cash / total) * 100 : 50
  const gradient =
    total > 0
      ? `conic-gradient(${PAY_COLOR.promptpay} 0% ${ppPct.toFixed(2)}%, ${PAY_COLOR.cash} ${ppPct.toFixed(2)}% 100%)`
      : `conic-gradient(rgb(var(--c-divider) / 0.1) 0% 100%)`

  const fmt = (v: number) => (metric === 'revenue' ? baht(v) : `${v} บิล`)

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
  const currentEventId = useApp((s) => s.currentEventId)
  const [filter, setFilter] = useState<string>(currentEventId || 'all')
  const [metric, setMetric] = useState<Metric>('revenue')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [showAllSets, setShowAllSets] = useState(false)

  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])
  const sales = useLiveQuery(() => db.sales.orderBy('createdAt').toArray(), [])
  const products = useLiveQuery(() => db.products.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const shopImage = useLiveQuery(() => getSetting('shopImage'), [])

  // กรองตาม event ที่เลือก
  const filteredSales = (sales ?? []).filter((s) => filter === 'all' || s.eventId === filter)

  // ---- KPI ----
  const totalRevenue = filteredSales.reduce((s, x) => s + x.total, 0)
  const billCount = filteredSales.length
  const totalQty = filteredSales.reduce((s, x) => s + x.items.reduce((a, b) => a + b.qty, 0), 0)
  const avgPerBill = billCount > 0 ? totalRevenue / billCount : 0

  // ---- map สำหรับ join ----
  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  const categoryMap = Object.fromEntries((categories ?? []).map((c) => [c.id, c]))

  // ---- สรุปสินค้าเดี่ยว (kind === 'product') ----
  const productAgg: Record<string, TopItem> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'product') continue
      if (!productAgg[item.refId]) productAgg[item.refId] = { id: item.refId, name: item.name, qty: 0, revenue: 0 }
      productAgg[item.refId].qty += item.qty
      productAgg[item.refId].revenue += item.qty * item.price
    }
  }
  const productList = Object.values(productAgg).sort(
    (a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty),
  )

  // ---- สรุปเซ็ต (kind === 'set') ----
  const setAgg: Record<string, TopItem> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'set') continue
      if (!setAgg[item.refId]) setAgg[item.refId] = { id: item.refId, name: item.name, qty: 0, revenue: 0 }
      setAgg[item.refId].qty += item.qty
      setAgg[item.refId].revenue += item.qty * item.price
    }
  }
  const setList = Object.values(setAgg).sort(
    (a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty),
  )

  // ---- สรุปตามประเภท (เฉพาะ kind === 'product') ----
  type CatEntry = { id: string; name: string; color: string; qty: number; revenue: number }
  const catAgg: Record<string, CatEntry> = {}
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      if (item.kind !== 'product') continue
      const prod = productMap[item.refId]
      if (!prod) continue
      const cat = categoryMap[prod.categoryId]
      if (!cat) continue
      if (!catAgg[cat.id]) catAgg[cat.id] = { id: cat.id, name: cat.name, color: cat.color, qty: 0, revenue: 0 }
      catAgg[cat.id].qty += item.qty
      catAgg[cat.id].revenue += item.qty * item.price
    }
  }
  const catList = Object.values(catAgg).sort(
    (a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty),
  )
  const catTotal = catList.reduce((s, c) => s + (metric === 'revenue' ? c.revenue : c.qty), 0)

  // ---- วิธีจ่ายเงิน ----
  const pay = { promptpay: { revenue: 0, bills: 0 }, cash: { revenue: 0, bills: 0 } }
  for (const sale of filteredSales) {
    pay[sale.method].revenue += sale.total
    pay[sale.method].bills += 1
  }
  const payPromptpay = metric === 'revenue' ? pay.promptpay.revenue : pay.promptpay.bills
  const payCash = metric === 'revenue' ? pay.cash.revenue : pay.cash.bills
  const payTotal = payPromptpay + payCash

  return (
    <>
      {/* header — ตาม pattern ของ HistoryScreen */}
      <header className="flex items-center gap-3 border-b border-divider/10 px-4 pb-4 pt-[38px]">
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
          </div>
        </div>

        {/* empty state */}
        {filteredSales.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-pewter">ยังไม่มีรายการขายในงานนี้</div>
        ) : (
          <>
            {/* 1. KPI cards — 2×2 grid */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <KpiCard label="ยอดสุทธิ" value={baht(totalRevenue)} highlight />
              <KpiCard label="จำนวนบิล" value={`${billCount} บิล`} />
              <KpiCard label="จำนวนชิ้นรวม" value={`${totalQty} ชิ้น`} />
              <KpiCard label="ยอดเฉลี่ยต่อบิล" value={baht(Math.round(avgPerBill))} />
            </div>

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

            {/* 3. เซ็ต/โปรโมชั่นขายดี */}
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

            {/* 4. ประเภทขายดี (conic-gradient donut + legend) */}
            <Section title="ประเภทขายดี">
              {catList.length === 0 ? (
                <div className="py-3 text-center text-[12px] text-pewter">ไม่มีข้อมูล</div>
              ) : (
                <>
                  <DonutChart
                    slices={catList.map((c) => ({
                      color: c.color,
                      value: metric === 'revenue' ? c.revenue : c.qty,
                    }))}
                    total={catTotal}
                  />
                  <div className="mt-3 space-y-1.5">
                    {catList.map((c) => {
                      const val = metric === 'revenue' ? c.revenue : c.qty
                      const pct = catTotal > 0 ? Math.round((val / catTotal) * 100) : 0
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 flex-none rounded-full"
                            style={{ background: c.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-milky">{c.name}</span>
                          <span className="font-num text-[12px] text-pewter">
                            {metric === 'revenue' ? baht(c.revenue) : `${c.qty} ชิ้น`}
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

            {/* 5. วิธีจ่ายเงิน */}
            <Section title="วิธีจ่ายเงิน">
              <PaymentDonut
                promptpay={payPromptpay}
                cash={payCash}
                metric={metric}
                total={payTotal}
              />
            </Section>
          </>
        )}
      </div>
    </>
  )
}
