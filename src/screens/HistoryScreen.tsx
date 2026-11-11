import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { useApp } from '../store'
import { baht, timeOf, todayISO } from '../lib/format'
import { ReceiptModal } from '../components/ReceiptModal'
import { ShopAvatar } from '../components/ShopAvatar'
import { IconDownload, IconChevron, IconCheck, IconBack, IconX } from '../components/Icons'
import { BILL_HEADER, ITEM_HEADER, billRows, itemRows, downloadCSV } from '../lib/csv'
import type { Sale } from '../types'

export function HistoryScreen() {
  const go = useApp((s) => s.go)
  const currentEventId = useApp((s) => s.currentEventId)
  const showToast = useApp((s) => s.showToast)
  const [filter, setFilter] = useState<string>(currentEventId || 'all')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const shopImage = useLiveQuery(() => getSetting('shopImage'), [])
  const sales = useLiveQuery(
    () => db.sales.orderBy('createdAt').reverse().toArray(),
    [],
  )

  const list = (sales ?? []).filter((s) => filter === 'all' || s.eventId === filter)
  const total = list.reduce((s, x) => s + x.total, 0)
  const totalCost = list.reduce((s, x) => s + x.items.reduce((a, b) => a + (b.cost ?? 0), 0), 0)
  const totalProfit = total - totalCost

  // งานถูกลบไปแล้ว → ใช้ชื่องานที่ snapshot ไว้ในบิล
  const filterName =
    filter === 'all' ? 'ทุกงาน' : events?.find((e) => e.id === filter)?.name ?? list[0]?.eventName ?? 'งาน'

  async function exportCSV(mode: 'bill' | 'item') {
    setExportOpen(false)
    if (list.length === 0) {
      showToast('ไม่มีข้อมูลให้ส่งออก')
      return
    }
    const chrono = [...list].reverse() // เรียงเก่า→ใหม่ ให้อ่านในตารางง่าย
    const scope = filterName.replace(/[\\/:*?"<>|]/g, '-')
    const name = `ยอดขาย-${mode === 'bill' ? 'รายบิล' : 'รายรายการ'}-${scope}-${todayISO()}.csv`
    if (mode === 'bill') {
      downloadCSV(name, BILL_HEADER, billRows(chrono))
    } else {
      // โหลดเฉพาะตอนส่งออก — ไม่ต้องค้างตารางสินค้า (มีรูป) ไว้ตลอดเวลาที่เปิดหน้านี้
      const [products, owners, categories, sets] = await Promise.all([
        db.products.toArray(), db.owners.toArray(), db.categories.toArray(), db.sets.toArray(),
      ])
      downloadCSV(name, ITEM_HEADER, itemRows(chrono, { products, owners, categories, sets, shopName: shopName ?? '' }))
    }
    showToast('ส่งออกไฟล์แล้ว')
  }

  return (
    <>
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
          <div className="text-[11px] text-pewter">ประวัติการขาย</div>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-divider/10 bg-surface text-pewter"
        >
          <IconDownload width={19} height={19} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-4">
        {/* dropdown */}
        <div className="relative mb-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full appearance-none rounded-[13px] border border-divider/10 bg-surface py-3 pl-4 pr-10 text-[15px] font-medium text-milky outline-none focus:border-electrum"
          >
            <option value="all" className="bg-surface">
              ทุกงาน
            </option>
            {(events ?? []).map((e) => (
              <option key={e.id} value={e.id} className="bg-surface">
                {e.name}
              </option>
            ))}
          </select>
          <IconChevron
            width={18}
            height={18}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-pewter"
          />
        </div>

        {/* summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-divider/10 bg-surface-2 p-3.5">
            <div className="text-[11px] text-pewter">
              ยอดขาย{filter === 'all' ? 'รวมทุกงาน' : ''}
            </div>
            <div className="mt-1 font-num text-[23px] font-semibold text-electrum">{baht(total)}</div>
          </div>
          <div className="rounded-2xl border border-divider/10 bg-surface-2 p-3.5">
            <div className="text-[11px] text-pewter">กำไร (หักต้นทุน)</div>
            <div className={`mt-1 font-num text-[23px] font-semibold ${totalProfit < 0 ? 'text-danger' : 'text-electrum'}`}>
              {baht(totalProfit)}
            </div>
          </div>
          <div className="rounded-2xl border border-divider/10 bg-surface-2 p-3.5">
            <div className="text-[11px] text-pewter">ต้นทุนขาย</div>
            <div className="mt-1 font-num text-[23px] font-semibold text-milky">{baht(totalCost)}</div>
          </div>
          <div className="rounded-2xl border border-divider/10 bg-surface-2 p-3.5">
            <div className="text-[11px] text-pewter">จำนวนบิล</div>
            <div className="mt-1 font-num text-[23px] font-semibold text-milky">
              {list.length} <span className="text-xs text-pewter">บิล</span>
            </div>
          </div>
        </div>

        <div className="mb-3 mt-5 flex items-center gap-2.5 px-1 text-[12px] text-pewter">
          {filterName}
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {list.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-pewter">ยังไม่มีรายการขายในงานนี้</div>
        ) : (
          list.map((s) => <SaleRow key={s.id} sale={s} onOpen={() => setSelected(s)} />)
        )}
      </div>

      {selected && <ReceiptModal sale={selected} onClose={() => setSelected(null)} />}
      {exportOpen && (
        <ExportSheet
          count={list.length}
          scope={filterName}
          onPick={exportCSV}
          onClose={() => setExportOpen(false)}
        />
      )}
    </>
  )
}

function ExportSheet({
  count,
  scope,
  onPick,
  onClose,
}: {
  count: number
  scope: string
  onPick: (mode: 'bill' | 'item') => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-[90] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-3xl border-t border-divider/15 bg-surface pb-safe"
      >
        <div className="relative flex items-center justify-center pb-1 pt-3">
          <span className="h-1 w-10 rounded-full bg-white/20" />
          <button
            onClick={onClose}
            className="absolute right-4 top-2.5 grid h-8 w-8 place-items-center rounded-lg text-pewter"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="px-5 pb-6 pt-2">
          <div className="font-serif text-[17px] font-semibold text-milky">ส่งออกไฟล์ CSV</div>
          <div className="mt-0.5 text-[12px] text-pewter">
            {scope} · {count} บิล
          </div>

          <div className="mt-4 space-y-2.5">
            <ExportOption
              title="แบบรายบิล"
              desc="1 แถว = 1 บิล พร้อมยอดรวม ส่วนลด ต้นทุน กำไร — ไว้ดูสรุปยอดขาย"
              onClick={() => onPick('bill')}
            />
            <ExportOption
              title="แบบรายรายการ"
              desc="1 แถว = สินค้า 1 รายการ แยกหมวดหมู่ เจ้าของ ราคาพิเศษ และเฉลี่ยส่วนลดท้ายบิลให้แล้ว — ไว้ทำ pivot วิเคราะห์"
              onClick={() => onPick('item')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExportOption({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-divider/10 bg-surface-2 px-4 py-3.5 text-left transition active:scale-[0.99] hover:border-divider/20"
    >
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-divider/10 bg-surface text-electrum">
        <IconDownload width={18} height={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-milky">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-pewter">{desc}</span>
      </span>
    </button>
  )
}

function SaleRow({ sale, onOpen }: { sale: Sale; onOpen: () => void }) {
  const items = sale.items.map((i) => `${i.name} ×${i.qty}`).join(', ')
  const qty = sale.items.reduce((a, b) => a + b.qty, 0)
  return (
    <button
      onClick={onOpen}
      className="mb-2.5 flex w-full items-center gap-3 rounded-2xl border border-divider/10 bg-surface px-3.5 py-3.5 text-left transition active:scale-[0.99] hover:border-divider/20"
    >
      <div className="w-[50px] flex-none font-num text-[15px] font-semibold text-milky">
        {timeOf(sale.createdAt)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px]">{items}</div>
        <div className="mt-0.5 text-[11px] text-pewter">
          {qty} ชิ้น · {sale.eventName}
        </div>
      </div>
      <div className="ml-auto flex-none text-right">
        <div className="font-num text-base font-semibold text-electrum">{baht(sale.total)}</div>
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#82C08C]">
          <IconCheck width={11} height={11} strokeWidth={3} />
          จ่ายแล้ว
        </div>
      </div>
    </button>
  )
}
