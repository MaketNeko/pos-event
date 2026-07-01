import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { IconDownload, IconX } from './Icons'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [notes, setNotes] = useState<string[]>([])

  // เมื่อมีอัปเดตรออยู่ ดึงสรุป "อัปเดตอะไรบ้าง" จากเวอร์ชันใหม่ (สดจากเน็ต)
  useEffect(() => {
    if (!needRefresh) return
    const url = `${import.meta.env.BASE_URL}release-notes.json?t=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setNotes(Array.isArray(d?.notes) ? d.notes.slice(0, 4) : []))
      .catch(() => setNotes([]))
  }, [needRefresh])

  if (!needRefresh) return null

  return (
    <div className="absolute inset-x-3 top-3 z-[85] rounded-2xl border border-electrum/40 bg-gradient-to-br from-[#2c363f] to-[#232a30] p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-electrum/15 text-electrum">
          <IconDownload width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-milky">มีเวอร์ชันใหม่ของ NekoPOS</div>
          {notes.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-pewter">
              {notes.map((n, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-electrum">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-[11px] text-pewter">ปรับปรุงการทำงานเล็กน้อย</div>
          )}
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="flex-none text-pewter"
          aria-label="ไว้ทีหลัง"
        >
          <IconX width={16} height={16} />
        </button>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="mt-3 w-full rounded-xl bg-electrum py-2.5 text-[13px] font-semibold text-[#2a2115]"
      >
        อัปเดตเลย
      </button>
    </div>
  )
}
