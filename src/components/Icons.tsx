import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.6}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.9-1.4 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 3 14a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.5-2.6 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 10 4.1V4a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 20 10.6" />
  </svg>
)
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 19V5m5 14V9m5 10V3m5 16v-8" />
  </svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M5 12h14" />
  </svg>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
)
export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.6}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
)
export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </svg>
)
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7" />
  </svg>
)
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 15V3m0 0 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)
export const IconDatabase = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </svg>
)
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.8}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
)
export const IconStore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M3 9l1-5h16l1 5M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zm5 4h6" />
  </svg>
)
export const IconQR = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.6}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 8h3v3H8zM8 13h3v3H8zM13 8h3v8" />
  </svg>
)
export const IconGrip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.4" />
    <circle cx="15" cy="6" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="18" r="1.4" />
    <circle cx="15" cy="18" r="1.4" />
  </svg>
)
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M12 20s-7-4.5-9.5-9A4.6 4.6 0 0 1 12 6.5 4.6 4.6 0 0 1 21.5 11C19 15.5 12 20 12 20z" />
  </svg>
)
export const IconPaw = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7} fill="currentColor" stroke="none">
    <ellipse cx="6.2" cy="10.5" rx="1.7" ry="2.3" />
    <ellipse cx="10" cy="7.6" rx="1.7" ry="2.4" />
    <ellipse cx="14" cy="7.6" rx="1.7" ry="2.4" />
    <ellipse cx="17.8" cy="10.5" rx="1.7" ry="2.3" />
    <path d="M12 12.4c2.6 0 4.7 1.7 4.7 3.9 0 1.7-1.4 2.7-3 2.7-.8 0-1.2-.3-1.7-.3s-.9.3-1.7.3c-1.6 0-3-1-3-2.7 0-2.2 2.1-3.9 4.7-3.9z" />
  </svg>
)
export const IconCoffee = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M4 8h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" />
    <path d="M17 9h2.5a2.5 2.5 0 0 1 0 5H17M6 3v2M10 3v2M14 3v2" />
  </svg>
)
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
)
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.8}>
    <path d="M12 3v13M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
)
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <path d="M10 5h4" />
  </svg>
)
export const IconDiscord = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z" />
  </svg>
)
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.7}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l8 8-9 9-9-9z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </svg>
)
export const IconPalette = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeWidth={1.6}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h1a3 3 0 0 0 3-3c0-4-3-6-7-6z" />
  </svg>
)
