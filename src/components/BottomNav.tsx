import { useApp, type Screen } from '../store'
import { IconGrid, IconClock, IconGear, IconChart } from './Icons'

const items: { key: Screen; label: string; Icon: typeof IconGrid }[] = [
  { key: 'pos', label: 'ขายของ', Icon: IconGrid },
  { key: 'history', label: 'ประวัติ', Icon: IconClock },
  { key: 'dashboard', label: 'สรุป', Icon: IconChart },
  { key: 'settings', label: 'ตั้งค่า', Icon: IconGear },
]

export function BottomNav() {
  const screen = useApp((s) => s.screen)
  const go = useApp((s) => s.go)

  return (
    <nav className="absolute inset-x-0 bottom-0 z-50 flex h-[68px] border-t border-divider/10 bg-ink/90 px-2.5 pt-1.5 backdrop-blur-lg">
      {items.map(({ key, label, Icon }) => {
        const active = screen === key
        return (
          <button
            key={key}
            onClick={() => go(key)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition active:scale-95 ${
              active ? 'text-electrum' : 'text-pewter'
            }`}
          >
            <Icon width={22} height={22} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
