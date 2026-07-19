import { ScreenHeader } from '../components/ScreenHeader'

// รายการอัปเดต — ใหม่สุดอยู่บนสุด
interface Release {
  date: string   // แสดงเป็นหัวข้อ
  title: string
  items: string[]
}

const RELEASES: Release[] = [
  {
    date: 'ก.ค. 2026',
    title: 'ดูยอดฝากขายรายคน',
    items: [
      'Dashboard เลือกดูเฉพาะเจ้าของคนใดคนหนึ่งได้ (KPI/สินค้า/ประเภท เหลือเฉพาะคนนั้น)',
      'แตะชื่อเจ้าของในสรุป เพื่อกางดูว่าเขาขายอะไรไปบ้าง — ไว้เคลียร์เงินง่ายขึ้น',
    ],
  },
  {
    date: 'ก.ค. 2026',
    title: 'สำรอง & กู้คืนข้อมูล',
    items: [
      'ไฟล์สำรองครอบคลุมครบ รวมเจ้าของฝากขายและเซ็ต/โปรโมชั่น',
      'กู้คืนจากไฟล์เขียนทับข้อมูลทั้งหมด (รวมประวัติการขาย) แต่ไม่แตะจุดสำรองในเครื่อง',
      'สำรองในเครื่องแบบย้อนกลับได้ — เก็บจุดสำรองอัตโนมัติเมื่อเปิดแอปและก่อนกู้คืน จัดการในหน้าแยก',
    ],
  },
  {
    date: 'ก.ค. 2026',
    title: 'ระบบฝากขาย',
    items: [
      'ติดป้าย “เจ้าของ” ให้สินค้า สำหรับของที่เพื่อนฝากขาย',
      'หน้าสินค้ากรองดูของแต่ละคนได้ + เพิ่มของรัว ๆ ให้ค่าเจ้าของอัตโนมัติตามที่กรองอยู่',
      'Dashboard เพิ่มสรุป “ยอดขายแยกตามเจ้าของ”',
    ],
  },
  {
    date: 'ก.ค. 2026',
    title: 'จอใหญ่ & ธีม',
    items: [
      'เลย์เอาต์สองแผงบน iPad/เดสก์ท็อป ทั้งหน้าขายและหน้าเพิ่มสินค้า',
      'เพิ่มระบบธีม 5 แบบ (มีธีม Star ✦)',
      'Dashboard สรุปยอดขายต่อสินค้า/ประเภท/วิธีจ่ายเงิน',
    ],
  },
  {
    date: 'ก.ค. 2026',
    title: 'ขายง่ายขึ้น',
    items: [
      'เซ็ต / โปรโมชั่น (เซ็ตตายตัว + มิกซ์แอนด์แมตช์)',
      'ปุ่มล้างตะกร้าก่อนคิดเงิน',
      'เลย์เอาต์รองรับแท็บเล็ต 3 คอลัมน์',
    ],
  },
]

export function ChangelogScreen() {
  return (
    <>
      <ScreenHeader title="สรุปการอัปเดต" subtitle="มีอะไรใหม่ในแอป" back="settings" />

      <div className="flex-1 overflow-y-auto px-5 pb-[90px] pt-[18px]">
        {RELEASES.map((r, i) => (
          <div key={i} className="mb-[22px]">
            <div className="mb-2.5 flex items-baseline gap-2 px-1">
              <span className="font-serif text-sm font-semibold text-milky">{r.title}</span>
              <span className="text-[11px] text-pewter">{r.date}</span>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-divider/10 bg-surface">
              {r.items.map((it, j) => (
                <li
                  key={j}
                  className="flex gap-2.5 border-b border-divider/10 px-4 py-3 text-[13px] leading-relaxed text-milky last:border-b-0"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-electrum" />
                  <span className="min-w-0 flex-1">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
