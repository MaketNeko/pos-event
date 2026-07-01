import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// เปลี่ยนตรงนี้ให้ตรงกับชื่อ repo บน GitHub (สำหรับ GitHub Pages)
const REPO = 'pos-event'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' ? `/${REPO}/` : '/'
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'POS ขายตามงาน',
          short_name: 'POS งาน',
          description: 'ระบบขายหน้าร้านสำหรับออกงาน ใช้งานออฟไลน์',
          lang: 'th',
          theme_color: '#171719',
          background_color: '#171719',
          display: 'standalone',
          orientation: 'portrait',
          scope: base,
          start_url: base,
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        },
      }),
    ],
  }
})
