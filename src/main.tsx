import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './fonts.ts'
import './index.css'
import './lib/pwa.ts'
import { seedIfEmpty } from './lib/seed.ts'

seedIfEmpty().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
