import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../db'
import { baht, timeOf } from '../lib/format'
import { IconX, IconCheck } from './Icons'
import type { Sale } from '../types'

export function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const shopName = useLiveQuery(() => getSetting('shopName'), []) ?? ''
  const shopImage = useLiveQuery(() => getSetting('shopImage'), []) ?? ''
  const d = new Date(sale.createdAt)
  const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className="absolute inset-0 z-[90] flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90%] flex-col rounded-t-3xl border-t border-white/15 bg-surface"
      >
        {/* handle + close */}
        <div className="relative flex items-center justify-center pb-1 pt-3">
          <span className="h-1 w-10 rounded-full bg-white/20" />
          <button
            onClick={onClose}
            className="absolute right-4 top-2.5 grid h-8 w-8 place-items-center rounded-lg text-pewter"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-safe">
          {/* head */}
          <div className="pt-2 text-center">
            {shopImage && (
              <img
                src={shopImage}
                alt="ร้าน"
                className="mx-auto mb-2.5 h-16 w-16 rounded-full border border-white/15 object-cover"
              />
            )}
            <div className="font-serif text-xl font-semibold text-milky">{shopName || 'NekoPOS'}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-electrum">ใบเสร็จรับเงิน</div>
          </div>

          <div className="mt-4 flex justify-between text-[12px] text-pewter">
            <span>{sale.eventName || '—'}</span>
            <span>
              {dateStr} · {timeOf(sale.createdAt)}
            </span>
          </div>

          <Dashed />

          {/* items */}
          <div className="space-y-2.5">
            {sale.items.map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] text-milky">{it.name}</div>
                  <div className="text-[11px] text-pewter">
                    {it.qty} × {baht(it.price)}
                  </div>
                </div>
                <div className="font-num text-[15px] font-semibold text-milky">
                  {baht(it.price * it.qty)}
                </div>
              </div>
            ))}
          </div>

          <Dashed />

          {/* totals */}
          <div className="space-y-1.5">
            <Row k="ยอดรวม" v={baht(sale.subtotal)} />
            {sale.setDiscount > 0 && <Row k="ส่วนลดโปรเซ็ต" v={`− ${baht(sale.setDiscount)}`} gold />}
            {sale.discount > 0 && <Row k="ส่วนลดท้ายบิล" v={`− ${baht(sale.discount)}`} gold />}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-white/20 pt-3">
            <span className="text-[15px] text-milky">ยอดสุทธิ</span>
            <span className="font-num text-[26px] font-bold text-electrum">{baht(sale.total)}</span>
          </div>

          {/* method + footer */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-[#82C08C]">
            <IconCheck width={13} height={13} strokeWidth={3} />
            ชำระด้วย {sale.method === 'cash' ? 'เงินสด' : 'PromptPay'} · จ่ายแล้ว
          </div>
          <div className="mb-6 mt-4 text-center text-[11px] text-pewter/70">
            ขอบคุณที่อุดหนุน 🙏
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashed() {
  return <div className="my-4 border-t border-dashed border-white/15" />
}

function Row({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className={`flex justify-between text-[13px] ${gold ? 'text-electrum' : 'text-pewter'}`}>
      <span>{k}</span>
      <span className="font-num">{v}</span>
    </div>
  )
}
