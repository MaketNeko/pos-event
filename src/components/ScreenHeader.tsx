import type { ReactNode } from 'react'
import { useApp, type Screen } from '../store'
import { IconBack } from './Icons'

interface Props {
  title: string
  subtitle?: string
  back?: Screen
  right?: ReactNode
}

export function ScreenHeader({ title, subtitle, back, right }: Props) {
  const go = useApp((s) => s.go)
  return (
    <header className="flex items-center gap-3.5 border-b border-divider/10 px-5 pb-4 pt-[38px]">
      {back && (
        <button
          onClick={() => go(back)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-divider/10 bg-surface text-milky"
        >
          <IconBack width={20} height={20} />
        </button>
      )}
      <div className="min-w-0">
        <h2 className="font-serif text-[19px] font-semibold text-milky">{title}</h2>
        {subtitle && <div className="text-[11px] text-pewter">{subtitle}</div>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </header>
  )
}
