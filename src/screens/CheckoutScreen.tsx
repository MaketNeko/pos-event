import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { QRCodeSVG } from 'qrcode.react'
import { db, uid, getSetting } from '../db'
import { useApp } from '../store'
import { baht, thaiDate } from '../lib/format'
import { promptPayPayload } from '../lib/promptpay'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconCheck, IconPlus, IconMinus, IconTrash } from '../components/Icons'
import type { SaleItem, Product } from '../types'

type Line = { p: Product; qty: number }

export function CheckoutScreen() {
  const cart = useApp((s) => s.cart)
  const addToCart = useApp((s) => s.addToCart)
  const decCart = useApp((s) => s.decCart)
  const removeCart = useApp((s) => s.removeCart)
  const clearCart = useApp((s) => s.clearCart)
  const go = useApp((s) => s.go)
  const currentEventId = useApp((s) => s.currentEventId)

  const products = useLiveQuery(() => db.products.toArray(), [])
  const event = useLiveQuery(() => db.events.get(currentEventId), [currentEventId])
  const promptpay = useLiveQuery(() => getSetting('promptpay'), []) ?? ''

  const [discRaw, setDiscRaw] = useState('')
  const [discMode, setDiscMode] = useState<'baht' | 'percent'>('baht')
  const [done, setDone] = useState(false)

  const lines = useMemo<Line[]>(() => {
    const out: Line[] = []
    for (const [id, qty] of Object.entries(cart)) {
      const p = products?.find((x) => x.id === id)
      if (p) out.push({ p, qty })
    }
    return out
  }, [cart, products])

  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0)
  const discount = useMemo(() => {
    const v = Math.max(0, parseFloat(discRaw) || 0)
    const d = discMode === 'percent' ? (subtotal * Math.min(v, 100)) / 100 : Math.min(v, subtotal)
    return Math.round(d)
  }, [discRaw, discMode, subtotal])
  const total = subtotal - discount

  const payload = promptpay && total > 0 ? promptPayPayload(promptpay, total) : ''

  async function markPaid() {
    if (lines.length === 0) return
    const items: SaleItem[] = lines.map((l) => ({
      productId: l.p.id,
      name: l.p.name,
      price: l.p.price,
      qty: l.qty,
    }))
    await db.transaction('rw', db.products, db.sales, async () => {
      for (const l of lines) {
        const cur = await db.products.get(l.p.id)
        if (cur) await db.products.update(l.p.id, { stock: Math.max(0, cur.stock - l.qty) })
      }
      await db.sales.add({
        id: uid(),
        eventId: currentEventId,
        eventName: event?.name ?? '',
        items,
        subtotal,
        discount,
        total,
        method: 'promptpay',
        createdAt: Date.now(),
      })
    })
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
        {lines.map((l) => (
          <div key={l.p.id} className="flex items-center gap-3 border-b border-white/10 py-2.5">
            <div className="h-11 w-11 overflow-hidden rounded-xl bg-[#20262b]">
              {l.p.image && <img src={l.p.image} alt={l.p.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm">{l.p.name}</div>
              <div className="text-xs text-pewter">{baht(l.p.price)}</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => decCart(l.p.id)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-electrum"
              >
                <IconMinus width={16} height={16} />
              </button>
              <span className="w-6 text-center font-num text-base font-semibold">{l.qty}</span>
              <button
                onClick={() => addToCart(l.p.id)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-electrum"
              >
                <IconPlus width={16} height={16} />
              </button>
              <button
                onClick={() => removeCart(l.p.id)}
                className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-pewter"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
          </div>
        ))}

        {/* summary */}
        <div className="mt-[18px] rounded-[18px] border border-white/10 bg-surface p-4">
          <div className="mb-2 flex justify-between text-[13px] text-pewter">
            <span>ยอดรวม</span>
            <span className="font-num">{baht(subtotal)}</span>
          </div>

          <div className="my-2 flex items-center gap-2">
            <span className="text-[13px] font-medium text-electrum">ส่วนลดท้ายบิล</span>
            <div className="ml-auto flex items-center overflow-hidden rounded-xl border border-white/20 bg-black/20">
              <input
                inputMode="numeric"
                value={discRaw}
                placeholder="0"
                onChange={(e) => setDiscRaw(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-[74px] bg-transparent px-2 py-2 text-right font-num text-base font-semibold text-milky outline-none placeholder:text-pewter"
              />
              <button
                onClick={() => setDiscMode('baht')}
                className={`h-[37px] w-[34px] border-l border-white/10 text-sm font-semibold ${
                  discMode === 'baht' ? 'bg-electrum text-[#2a2115]' : 'text-pewter'
                }`}
              >
                ฿
              </button>
              <button
                onClick={() => setDiscMode('percent')}
                className={`h-[37px] w-[34px] border-l border-white/10 text-sm font-semibold ${
                  discMode === 'percent' ? 'bg-electrum text-[#2a2115]' : 'text-pewter'
                }`}
              >
                %
              </button>
            </div>
          </div>

          {discount > 0 && (
            <div className="mb-2 flex justify-between text-[13px] text-electrum">
              <span>ลดไป</span>
              <span className="font-num">− {baht(discount)}</span>
            </div>
          )}

          <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-white/20 pt-3">
            <span className="text-sm">ยอดสุทธิ</span>
            <span className="font-num text-[26px] font-bold text-milky">{baht(total)}</span>
          </div>
        </div>

        {/* QR */}
        <div className="mt-[18px] rounded-[20px] border border-white/20 bg-gradient-to-b from-[#2b343c] to-[#20262c] p-5 text-center">
          <div className="mb-3.5 flex items-center justify-center gap-2">
            <span className="text-[13px] font-bold text-milky">PromptPay</span>
            <span className="rounded-md bg-electrum px-1.5 py-0.5 text-[9px] font-bold text-[#2a2115]">
              พร้อมเพย์
            </span>
          </div>
          {payload ? (
            <div className="mx-auto h-[196px] w-[196px] rounded-2xl bg-white p-3.5 shadow-xl">
              <QRCodeSVG value={payload} className="h-full w-full" />
            </div>
          ) : (
            <div className="mx-auto flex h-[196px] w-[196px] items-center justify-center rounded-2xl border border-dashed border-white/20 px-6 text-center text-xs text-pewter">
              ตั้งค่าเบอร์พร้อมเพย์ก่อน จึงจะสร้าง QR ได้
            </div>
          )}
          <div className="mt-3.5 font-num text-xl font-semibold text-milky">{baht(total)}</div>
          <div className="mt-1 text-[11px] text-pewter">
            {promptpay ? `เงินเข้าบัญชี ${promptpay}` : 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์'}
          </div>
        </div>
      </div>

      {/* foot */}
      <div className="flex gap-2.5 border-t border-white/10 bg-ink px-5 pb-safe pt-3.5">
        <button
          onClick={() => go('pos')}
          className="flex-none rounded-[15px] border border-white/20 px-4 py-3.5 font-medium text-pewter"
        >
          ยกเลิก
        </button>
        <button
          onClick={markPaid}
          className="flex flex-1 items-center justify-center gap-2 rounded-[15px] bg-gradient-to-br from-[#EBD4A6] to-[#D9B87C] py-3.5 text-base font-bold text-[#2a2115] shadow-lg"
        >
          <IconCheck width={20} height={20} />
          จ่ายแล้ว
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
