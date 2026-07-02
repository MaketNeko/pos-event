import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import { useApp } from '../store'
import { fileToDataURL } from '../lib/image'
import { ScreenHeader } from '../components/ScreenHeader'
import { CropModal } from '../components/CropModal'
import {
  IconStore, IconQR, IconCalendar, IconGrid, IconPalette,
  IconDatabase, IconUpload, IconChevronRight, IconHeart, IconDownload, IconTrash, IconTag,
} from '../components/Icons'

const THEMES = [
  { id: 'dark',   label: 'Dark',    bg: '#171719', accent: '#E7CB9C' },
  { id: 'light',  label: 'Light',   bg: '#f7f6f4', accent: '#5b4fcf' },
  { id: 'citrus', label: 'Citrus',  bg: '#fff8f5', accent: '#fd5e4b' },
  { id: 'veil',   label: 'Veil',    bg: '#f8f7ff', accent: '#9f99d1' },
  { id: 'oasis',  label: 'Oasis',   bg: '#efeada', accent: '#3b584b' },
] as const

export function SettingsScreen() {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const fileRef = useRef<HTMLInputElement>(null)
  const shopFileRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const shopImage = useLiveQuery(() => getSetting('shopImage'), [])
  const shopName = useLiveQuery(() => getSetting('shopName'), [])
  const promptpay = useLiveQuery(() => getSetting('promptpay'), [])
  const currentTheme = useLiveQuery(() => getSetting('theme', 'dark'), [])
  const events = useLiveQuery(() => db.events.toArray(), [])
  const productCount = useLiveQuery(() => db.products.count(), [])
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])

  const loaded = shopName !== undefined && promptpay !== undefined

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

        <Group title="ธีม">
          <div className="flex items-center justify-around px-4 py-4">
            {THEMES.map((t) => {
              const active = (currentTheme ?? 'dark') === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => void setSetting('theme', t.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`relative h-11 w-11 rounded-full border-2 transition-all ${
                      active ? 'scale-110 border-electrum shadow-lg' : 'border-transparent'
                    }`}
                    style={{ background: t.bg }}
                  >
                    <span
                      className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white"
                      style={{ background: t.accent }}
                    />
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7L5.5 10L11.5 4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? 'text-electrum' : 'text-pewter'}`}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="ร้าน & การรับเงิน">
          <button
            onClick={() => shopFileRef.current?.click()}
            className="flex w-full items-center gap-3.5 border-b border-divider/10 px-4 py-3.5 text-left active:bg-surface-2"
          >
            <div className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-full border border-divider/15 bg-surface-2 text-pewter">
              {shopImage ? (
                <img src={shopImage} alt="ร้าน" className="h-full w-full object-cover" />
              ) : (
                <IconStore width={20} height={20} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm">รูปโปรไฟล์ร้าน</div>
              <div className="text-[11px] text-pewter">
                {shopImage ? 'แตะเพื่อเปลี่ยนรูป' : 'แตะเพื่อเพิ่มรูป'}
              </div>
            </div>
            {shopImage && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  void setSetting('shopImage', '')
                }}
                className="grid h-9 w-9 flex-none place-items-center rounded-lg text-danger"
              >
                <IconTrash width={17} height={17} />
              </span>
            )}
          </button>
          {loaded && (
            <>
              <SettingRow icon={<IconStore width={18} height={18} />} label="ชื่อร้าน">
                <input
                  defaultValue={shopName}
                  onBlur={(e) => setSetting('shopName', e.target.value)}
                  className="ml-auto w-[150px] rounded-lg border border-divider/10 bg-surface-2 px-2.5 py-2 text-right text-[13px] text-milky outline-none focus:border-electrum"
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
                  className="ml-auto w-[150px] rounded-lg border border-divider/10 bg-surface-2 px-2.5 py-2 text-right text-[13px] text-milky outline-none focus:border-electrum"
                />
              </SettingRow>
            </>
          )}
        </Group>

        <Group title="งาน & สินค้า">
          <SettingRow
            icon={<IconCalendar width={18} height={18} />}
            label="งานที่จะออก"
            sub={`จัดการ · ${events?.length ?? 0} งาน`}
            onClick={() => go('events')}
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
            icon={<IconTag width={18} height={18} />}
            label="เซ็ต / โปรโมชั่น"
            sub="เซ็ตตายตัว + มิกซ์แอนด์แมตช์"
            onClick={() => go('sets')}
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
                  className="h-[22px] w-[22px] rounded-[7px] border border-divider/20"
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
        <input
          ref={shopFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void fileToDataURL(f).then(setCropSrc).catch(() => showToast('อ่านรูปไม่สำเร็จ'))
            e.target.value = ''
          }}
        />
      </div>

      {cropSrc && (
        <CropModal
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onDone={(d) => {
            void setSetting('shopImage', d)
            setCropSrc(null)
          }}
        />
      )}
    </>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-[22px]">
      <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-pewter">
        {title}
      </div>
      <div className="overflow-hidden rounded-2xl border border-divider/10 bg-surface">{children}</div>
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
      className={`flex items-center gap-3.5 border-b border-divider/10 px-4 py-3.5 last:border-b-0 ${
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
