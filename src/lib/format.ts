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

export const todayISO = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
