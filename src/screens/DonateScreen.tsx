import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { baht } from '../lib/format'
import { promptPayPayload } from '../lib/promptpay'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconCoffee, IconCopy, IconDiscord } from '../components/Icons'

// ผู้พัฒนา — ล็อกไว้ตายตัว ไม่แสดงเบอร์ ไม่ให้แก้ไข (แอปนี้ฟรีสำหรับคนขายของ)
const DONATE_PROMPTPAY = '0973101570'
const DISCORD = 'MaketNeko'
const AMOUNTS = [0, 20, 50, 100]

export function DonateScreen() {
  const showToast = useApp((s) => s.showToast)
  const [amount, setAmount] = useState(0)

  const payload = promptPayPayload(DONATE_PROMPTPAY, amount)

  async function copyDiscord() {
    try {
      await navigator.clipboard.writeText(DISCORD)
      showToast('คัดลอก Discord แล้ว')
    } catch {
      showToast('คัดลอกไม่สำเร็จ')
    }
  }

  return (
    <>
      <ScreenHeader title="สนับสนุนผู้พัฒนา" subtitle="เลี้ยงมัทฉะสักแก้ว" back="settings" />

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {/* hero */}
        <div className="rounded-[22px] border border-divider/10 bg-surface-2 p-6 text-center">
          <img
            src={`${import.meta.env.BASE_URL}cat-donate.png`}
            alt="เจ้าเหมียวผู้พัฒนากำลังฝันถึงมัทฉะ"
            draggable={false}
            className="mx-auto h-32 w-auto select-none"
          />
          <h3 className="mt-4 font-serif text-xl font-semibold text-milky">ขอบคุณที่ใช้แอปนี้</h3>
          <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-relaxed text-pewter">
            แอปนี้ทำด้วยใจและให้ใช้ฟรีสำหรับพ่อค้าแม่ค้า ถ้าถูกใจ เลี้ยงมัทฉะผู้พัฒนาสักแก้วก็ยินดีมากครับ
            กำลังใจเล็ก ๆ ช่วยให้มีของอัปเดตใหม่ ๆ ต่อไป
          </p>
        </div>

        {/* amount chips */}
        <div className="mt-5 flex gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className={`flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition ${
                amount === a
                  ? 'border-electrum bg-electrum text-accent-on'
                  : 'border-divider/10 bg-surface text-pewter'
              }`}
            >
              {a === 0 ? 'ตามใจ' : baht(a)}
            </button>
          ))}
        </div>

        {/* QR only — no phone number shown anywhere */}
        <div className="mt-4 rounded-[20px] border border-divider/20 bg-surface-2 p-5 text-center">
          <div className="mb-3.5 flex items-center justify-center gap-2">
            <IconCoffee width={18} height={18} className="text-electrum" />
            <span className="text-[13px] font-bold text-milky">PromptPay</span>
          </div>
          <div className="mx-auto h-[196px] w-[196px] rounded-2xl bg-white p-3.5 shadow-xl">
            <QRCodeSVG value={payload} className="h-full w-full" />
          </div>
          <div className="mt-3.5 font-num text-xl font-semibold text-milky">
            {amount === 0 ? 'สแกนแล้วใส่จำนวนเอง' : baht(amount)}
          </div>
          <div className="mt-1 text-[11px] text-pewter">สแกนด้วยแอปธนาคารเพื่อสนับสนุน</div>
        </div>

        {/* contact */}
        <div className="mt-6">
          <label className="mb-2 block px-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-pewter">
            ติดต่อ / สอบถาม
          </label>
          <button
            onClick={copyDiscord}
            className="flex w-full items-center gap-3 rounded-2xl border border-divider/10 bg-surface px-4 py-3.5 text-left active:bg-surface-2"
          >
            <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#5865F2]/15 text-[#8b93f8]">
              <IconDiscord width={20} height={20} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-pewter">Discord</div>
              <div className="text-sm font-medium text-milky">{DISCORD}</div>
            </div>
            <IconCopy width={16} height={16} className="ml-auto flex-none text-pewter" />
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-pewter/70">พัฒนาด้วยใจ · ขอบคุณครับ</p>
      </div>
    </>
  )
}
