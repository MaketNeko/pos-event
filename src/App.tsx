import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from './db'
import { useApp } from './store'
import { BottomNav } from './components/BottomNav'
import { Toast } from './components/Toast'
import { PosScreen } from './screens/PosScreen'
import { CheckoutScreen } from './screens/CheckoutScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ProductsScreen } from './screens/ProductsScreen'
import { AddProductScreen } from './screens/AddProductScreen'
import { CategoriesScreen } from './screens/CategoriesScreen'
import { DonateScreen } from './screens/DonateScreen'
import { InstallScreen } from './screens/InstallScreen'
import { InstallBanner } from './components/InstallBanner'

const MAIN = new Set(['pos', 'history', 'settings'])

export default function App() {
  const screen = useApp((s) => s.screen)
  const currentEventId = useApp((s) => s.currentEventId)
  const setCurrentEvent = useApp((s) => s.setCurrentEvent)
  const events = useLiveQuery(() => db.events.orderBy('createdAt').toArray(), [])

  // load saved current event once
  useEffect(() => {
    void getSetting('currentEventId').then((id) => {
      if (id) setCurrentEvent(id)
    })
  }, [setCurrentEvent])

  // keep current event valid
  useEffect(() => {
    if (!events || !events.length) return
    if (!events.find((e) => e.id === currentEventId)) setCurrentEvent(events[0].id)
  }, [events, currentEventId, setCurrentEvent])

  return (
    <div className="flex h-[100dvh] justify-center bg-[#0e0f10]">
      <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-ink">
        {MAIN.has(screen) && <InstallBanner />}
        {screen === 'pos' && <PosScreen />}
        {screen === 'checkout' && <CheckoutScreen />}
        {screen === 'history' && <HistoryScreen />}
        {screen === 'settings' && <SettingsScreen />}
        {screen === 'products' && <ProductsScreen />}
        {screen === 'addProduct' && <AddProductScreen />}
        {screen === 'categories' && <CategoriesScreen />}
        {screen === 'donate' && <DonateScreen />}
        {screen === 'install' && <InstallScreen />}
        {MAIN.has(screen) && <BottomNav />}
        <Toast />
      </div>
    </div>
  )
}
