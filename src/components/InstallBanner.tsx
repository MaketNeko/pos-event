import { useState } from 'react'
import { useApp } from '../store'
import { useInstall } from '../lib/pwa'
import { IconDownload, IconX } from './Icons'

const KEY = 'installBannerDismissed'

export function InstallBanner() {
  const go = useApp((s) => s.go)
  const showToast = useApp((s) => s.showToast)
  const { canPrompt, standalone, ios, promptInstall } = useInstall()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === '1')

  // already installed, dismissed, or no way to install → nothing to show
  if (standalone || dismissed) return null
  if (!canPrompt && !ios) return null

  function close() {
    localStorage.setItem(KEY, '1')
    setDismissed(true)
  }

  async function install() {
    const ok = await promptInstall()
    if (!ok) showToast('ยังไม่ได้ติดตั้ง')
  }

  return (
    <div className="flex flex-none items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#2c363f] to-[#232a30] px-4 py-2.5 pt-safe">
      <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-electrum/15 text-electrum">
        <IconDownload width={18} height={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-milky">ติดตั้ง NekoPOS</div>
        <div className="text-[11px] text-pewter">ใช้เหมือนแอป · เปิดออฟไลน์ได้</div>
      </div>
      {canPrompt ? (
        <button
          onClick={install}
          className="flex-none rounded-lg bg-electrum px-3 py-1.5 text-[12px] font-semibold text-[#2a2115]"
        >
          ติดตั้ง
        </button>
      ) : (
        <button
          onClick={() => go('install')}
          className="flex-none rounded-lg border border-electrum px-3 py-1.5 text-[12px] font-semibold text-electrum"
        >
          วิธีติดตั้ง
        </button>
      )}
      <button onClick={close} className="flex-none text-pewter" aria-label="ปิด">
        <IconX width={18} height={18} />
      </button>
    </div>
  )
}
