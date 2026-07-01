import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, getSetting, setSetting } from '../db'
import { useApp } from '../store'
import { todayISO } from '../lib/format'
import { ScreenHeader } from '../components/ScreenHeader'
import {
  IconStore, IconQR, IconCalendar, IconGrid, IconPalette,
  IconDatabase, IconUpload, IconChevronRight, IconHeart, IconDownload,
} from '../components/Icons'

export function SettingsScreen() {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const setCurrentEvent = useApp((s) => s.setCurrentEvent)
  const fileRef = useRef<HTMLInputElement>(null)

  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const promptpay = useLiveQuery(() => getSetting('promptpay'), [])
  const events = useLiveQuery(() => db.events.toArray(), [])
  const productCount = useLiveQuery(() => db.products.count(), [])
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])

  const loaded = shopName !== undefined && promptpay !== undefined

  async function addEvent() {
    const name = window.prompt('ชื่องานใหม่')?.trim()
    if (!name) return
    const id = uid()
    await db.events.add({ id, name, date: todayISO(), createdAt: Date.now() })
    setCurrentEvent(id)
    showToast('เพิ่มงานแล้ว')
  }

  async function backup() {
    const data = {
      _v: 1,
      categories: await db.categories.toArray(),
      products: await db.products.toArray(),
      events: await db.events.toArray(),
      sales: await db.sales.toArray(),
      settings: await db.settings.toArray(),
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('สำรองข้อมูลแล้ว')
  }

  async function restore(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (!window.confirm('กู้คืนจะเขียนทับข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?')) return
      await db.transaction('rw', db.categories, db.products, db.events, db.sales, db.settings, async () => {
        await Promise.all([
          db.categories.clear(), db.products.clear(), db.events.clear(),
          db.sales.clear(), db.settings.clear(),
        ])
        await db.categories.bulkAdd(data.categories ?? [])
        await db.products.bulkAdd(data.products ?? [])
        await db.events.bulkAdd(data.events ?? [])
        await db.sales.bulkAdd(data.sales ?? [])
        await db.settings.bulkAdd(data.settings ?? [])
      })
      showToast('กู้คืนข้อมูลแล้ว')
    } catch {
      showToast('ไฟล์ไม่ถูกต้อง')
    }
  }

  return (
    <>
      <ScreenHeader title="ตั้งค่า" subtitle={shopName || 'ร้านของฉัน'} />

      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-[18px]">
        <Group title="ร้าน & การรับเงิน">
          {loaded && (
            <>
              <SettingRow icon={<IconStore width={18} height={18} />} label="ชื่อร้าน">
                <input
                  defaultValue={shopName}
                  onBlur={(e) => setSetting('shopName', e.target.value)}
                  className="ml-auto w-[150px] rounded-lg border border-white/10 bg-surface-2 px-2.5 py-2 text-right text-[13px] text-milky outline-none focus:border-electrum"
                />
              </SettingRow>
              <SettingRow
                icon={<IconQR width={18} height={18} />}
                label="พร้อมเพย์"
                sub="ไว้สร้าง QR รับเงิน"
              >
                <input
                  defaultValue={promptpay}
                  inputMode="tel"
                  placeholder="เบอร์ / เลขบัตร"
                  onChange={(e) => (e.target.value = e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={(e) => setSetting('promptpay', e.target.value)}
                  className="ml-auto w-[150px] rounded-lg border border-white/10 bg-surface-2 px-2.5 py-2 text-right text-[13px] text-milky outline-none focus:border-electrum"
                />
              </SettingRow>
            </>
          )}
        </Group>

        <Group title="งาน & สินค้า">
          <SettingRow
            icon={<IconCalendar width={18} height={18} />}
            label="เพิ่มงานใหม่"
            sub={`มีทั้งหมด ${events?.length ?? 0} งาน`}
            onClick={addEvent}
            chevron
          />
          <SettingRow
            icon={<IconGrid width={18} height={18} />}
            label="สินค้า"
            sub={`${productCount ?? 0} รายการ`}
            onClick={() => go('products')}
            chevron
          />
          <SettingRow
            icon={<IconPalette width={18} height={18} />}
            label="ประเภท & สี"
            onClick={() => go('categories')}
          >
            <div className="ml-auto flex gap-1.5">
              {(cats ?? []).map((c) => (
                <span
                  key={c.id}
                  className="h-[22px] w-[22px] rounded-[7px] border border-white/20"
                  style={{ background: c.color }}
                />
              ))}
            </div>
          </SettingRow>
        </Group>

        <Group title="ข้อมูล">
          <SettingRow
            icon={<IconDatabase width={18} height={18} />}
            label="สำรองข้อมูล"
            sub="ดาวน์โหลดไฟล์เก็บไว้"
            onClick={backup}
            chevron
          />
          <SettingRow
            icon={<IconUpload width={18} height={18} />}
            label="กู้คืนข้อมูล"
            sub="จากไฟล์สำรอง"
            onClick={() => fileRef.current?.click()}
            chevron
          />
        </Group>

        <Group title="เกี่ยวกับ">
          <SettingRow
            icon={<IconDownload width={18} height={18} />}
            label="ติดตั้งแอป / ใช้ออฟไลน์"
            sub="เพิ่มลงหน้าจอโฮม"
            onClick={() => go('install')}
            chevron
          />
          <SettingRow
            icon={<IconHeart width={18} height={18} />}
            label="สนับสนุนผู้พัฒนา"
            sub="เลี้ยงกาแฟสักแก้ว ☕"
            onClick={() => go('donate')}
            chevron
          />
        </Group>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void restore(f)
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-[22px]">
      <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-pewter">
        {title}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">{children}</div>
    </div>
  )
}

function SettingRow({
  icon, label, sub, children, onClick, chevron,
}: {
  icon: ReactNode
  label: string
  sub?: string
  children?: ReactNode
  onClick?: () => void
  chevron?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 border-b border-white/10 px-4 py-3.5 last:border-b-0 ${
        onClick ? 'cursor-pointer active:bg-surface-2' : ''
      }`}
    >
      <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-electrum/10 text-electrum">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {sub && <div className="mt-px text-[11px] text-pewter">{sub}</div>}
      </div>
      {children}
      {chevron && <IconChevronRight width={16} height={16} className="ml-auto text-pewter" />}
    </div>
  )
}
