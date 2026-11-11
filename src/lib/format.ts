export const baht = (n: number): string =>
  '฿' + Math.round(n).toLocaleString('th-TH')

export const timeOf = (ms: number): string =>
  new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

export function thaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ]
  return `${d} ${months[m - 1]} ${y + 543}`
}

/** yyyy-mm-dd ตามเวลาเครื่อง (ไม่ใช่ UTC) */
export const isoOf = (ms: number): string => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const todayISO = (): string => isoOf(Date.now())
