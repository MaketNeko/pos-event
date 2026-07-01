import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useApp } from '../store'
import { baht, timeOf } from '../lib/format'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconDownload, IconChevron, IconCheck } from '../components/Icons'
import type { Sale } from '../types'

export function HistoryScreen() {
  const currentEventId = useApp((s) => s.currentEventId)
  const showToast = useApp((s) => s.showToast)
  const [filter, setFilter] = useState<string>(currentEventId || 'all')

  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])
  const sales = useLiveQuery(
    () => db.sales.orderBy('createdAt').reverse().toArray(),
    [],
  )

  const list = (sales ?? []).filter((s) => filter === 'all' || s.eventId === filter)
  const total = list.reduce((s, x) => s + x.total, 0)

  function exportCSV() {
    if (list.length === 0) {
      showToast('ไม่มีข้อมูลให้ส่งออก')
      return
    }
    const header = ['วันที่', 'เวลา', 'งาน', 'รายการ', 'จำนวนชิ้น', 'ยอดรวม', 'ส่วนลด', 'ยอดสุทธิ']
    const rows = list.map((s) => {
      const d = new Date(s.createdAt)
      const items = s.items.map((i) => `${i.name} x${i.qty}`).join(' | ')
      const qty = s.items.reduce((a, b) => a + b.qty, 0)
      return [
        d.toLocaleDateString('th-TH'),
        timeOf(s.createdAt),
        s.eventName,
        items,
        qty,
        s.subtotal,
        s.discount,
        s.total,
      ]
    })
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ยอดขาย-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('ส่งออกไฟล์แล้ว')
  }

  const filterName = filter === 'all' ? 'ทุกงาน' : events?.find((e) => e.id === filter)?.name ?? ''

  return (
    <>
      <ScreenHeader
        title="ประวัติการขาย"
        subtitle="เลือกงานที่ต้องการดู"
        right={
          <button
            onClick={exportCSV}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-surface text-pewter"
          >
            <IconDownload width={19} height={19} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-4">
        {/* dropdown */}
        <div className="relative mb-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full appearance-none rounded-[13px] border border-white/10 bg-surface py-3 pl-4 pr-10 text-[15px] font-medium text-milky outline-none focus:border-electrum"
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
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#2c363f] to-[#232a30] p-3.5">
            <div className="text-[11px] text-pewter">
              ยอดขาย{filter === 'all' ? 'รวมทุกงาน' : ''}
            </div>
            <div className="mt-1 font-num text-[23px] font-semibold text-electrum">{baht(total)}</div>
          </div>
          <div className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#2c363f] to-[#232a30] p-3.5">
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
          list.map((s) => <SaleRow key={s.id} sale={s} />)
        )}
      </div>
    </>
  )
}

function SaleRow({ sale }: { sale: Sale }) {
  const items = sale.items.map((i) => `${i.name} ×${i.qty}`).join(', ')
  const qty = sale.items.reduce((a, b) => a + b.qty, 0)
  return (
    <div className="mb-2.5 flex items-center gap-3 rounded-2xl border border-white/10 bg-surface px-3.5 py-3.5">
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
    </div>
  )
}
