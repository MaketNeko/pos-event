import { useApp } from '../store'
import { useInstall } from '../lib/pwa'
import { ScreenHeader } from '../components/ScreenHeader'
import {
  IconDownload, IconCheck, IconShare, IconPlus, IconPhone,
} from '../components/Icons'

export function InstallScreen() {
  const showToast = useApp((s) => s.showToast)
  const { canPrompt, standalone, ios, promptInstall } = useInstall()

  async function install() {
    const ok = await promptInstall()
    if (!ok) showToast('ยังไม่ได้ติดตั้ง')
  }

  return (
    <>
      <ScreenHeader title="ติดตั้งแอป" subtitle="ใช้เหมือนแอป · เปิดออฟไลน์ได้" back="settings" />

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {/* status */}
        {standalone ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#82C08C]/30 bg-[#82C08C]/10 p-4">
            <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#82C08C]/20 text-[#82C08C]">
              <IconCheck width={20} height={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-milky">ติดตั้งแล้ว</div>
              <div className="text-[11px] text-pewter">คุณกำลังใช้งานแบบแอป พร้อมออฟไลน์</div>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] border border-divider/10 bg-surface-2 p-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-electrum text-electrum">
              <IconPhone width={28} height={28} />
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold text-milky">ติดตั้ง NekoPOS</h3>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-relaxed text-pewter">
              เพิ่มลงหน้าจอโฮม แล้วเปิดใช้เหมือนแอปจริง เต็มจอ ไม่มีแถบเบราว์เซอร์ และ
              <span className="text-milky"> ใช้งานได้แม้ไม่มีเน็ต</span>
            </p>

            {canPrompt && (
              <button
                onClick={install}
                className="mx-auto mt-5 flex items-center justify-center gap-2 rounded-2xl bg-electrum px-6 py-3 font-semibold text-accent-on"
              >
                <IconDownload width={20} height={20} />
                ติดตั้งเลย
              </button>
            )}
          </div>
        )}

        {/* iOS steps */}
        {!standalone && ios && (
          <div className="mt-5">
            <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-pewter">
              วิธีติดตั้งบน iPhone / iPad
            </div>
            <div className="overflow-hidden rounded-2xl border border-divider/10 bg-surface">
              <Step n="1" icon={<IconShare width={18} height={18} />} title="กดปุ่ม “แชร์”" sub="ไอคอนสี่เหลี่ยมลูกศรขึ้น ด้านล่างจอ Safari" />
              <Step n="2" icon={<IconPlus width={18} height={18} />} title="เลือก “เพิ่มไปยังหน้าจอโฮม”" sub="เลื่อนหาในเมนูที่เด้งขึ้น" />
              <Step n="3" icon={<IconCheck width={18} height={18} />} title="กด “เพิ่ม”" sub="ไอคอน NekoPOS จะขึ้นหน้าจอโฮม" last />
            </div>
            <p className="mt-2 px-1 text-[11px] text-pewter/70">
              * ต้องเปิดด้วย Safari เท่านั้น (Chrome บน iPhone ติดตั้งไม่ได้)
            </p>
          </div>
        )}

        {/* generic (desktop / other) */}
        {!standalone && !ios && !canPrompt && (
          <div className="mt-5 rounded-2xl border border-divider/10 bg-surface p-4 text-[13px] leading-relaxed text-pewter">
            เปิดเมนูเบราว์เซอร์ (⋮ มุมขวาบน) แล้วเลือก
            <span className="text-milky"> “ติดตั้งแอป” </span>
            หรือ “เพิ่มไปยังหน้าจอหลัก”
          </div>
        )}

        {/* offline note */}
        <div className="mt-6 rounded-2xl border border-divider/10 bg-surface p-4">
          <div className="text-[13px] font-medium text-milky">ใช้งานออฟไลน์ได้ 100%</div>
          <p className="mt-1 text-[12px] leading-relaxed text-pewter">
            เปิดแอปครั้งแรกตอนมีเน็ต ระบบจะเก็บทุกอย่างไว้ในเครื่อง หลังจากนั้นเปิดใช้หน้างานได้เลย
            แม้ไม่มีสัญญาณ · ข้อมูลสินค้า/ยอดขายอยู่ในเครื่องคุณเท่านั้น
          </p>
        </div>
      </div>
    </>
  )
}

function Step({
  n, icon, title, sub, last,
}: {
  n: string
  icon: React.ReactNode
  title: string
  sub: string
  last?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-divider/10'}`}>
      <div className="grid h-8 w-8 flex-none place-items-center rounded-full bg-electrum text-[13px] font-bold text-accent-on">
        {n}
      </div>
      <div className="flex-none text-electrum">{icon}</div>
      <div className="min-w-0">
        <div className="text-[13px] text-milky">{title}</div>
        <div className="text-[11px] text-pewter">{sub}</div>
      </div>
    </div>
  )
}
