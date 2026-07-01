import { useEffect, useState } from 'react'
import { useApp } from '../store'

export function Toast() {
  const toast = useApp((s) => s.toast)
  const toastKey = useApp((s) => s.toastKey)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!toastKey) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 1800)
    return () => clearTimeout(t)
  }, [toastKey])

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-20 z-[80] -translate-x-1/2 rounded-xl bg-electrum px-4 py-2.5 text-sm font-semibold text-[#2a2115] shadow-lg transition-all duration-300 ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      {toast}
    </div>
  )
}
