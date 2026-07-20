/**
 * src/screens/BoothScreen.tsx
 *
 * Phase 1 UI for the online-booth feature.
 * All network actions hit the stub localTransport — no real I/O occurs.
 * Phase 2+ will wire up Firebase without changing this screen's interface.
 */

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store'
import { pendingCount } from '../sync/outbox'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconPhone, IconX, IconTrash } from '../components/Icons'
import type { BoothMember } from '../sync'

/** Build the QR join deep-link for a room code (works in dev and on GitHub Pages). */
function joinUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?booth=${code}`
}

// ── Small local icon for the "wifi / broadcast" concept ──────────────────────
// Reuses existing SVG base pattern from Icons.tsx. No new dependency needed.
function IconSignal({ width = 22, height = 22, className }: { width?: number; height?: number; className?: string }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12.5A9.9 9.9 0 0 1 12 10a9.9 9.9 0 0 1 7 2.5" />
      <path d="M8 16a5.5 5.5 0 0 1 4-1.7 5.5 5.5 0 0 1 4 1.7" />
      <circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ── Shared Banner ─────────────────────────────────────────────────────────────
function InfoBanner() {
  return (
    <div className="mx-5 mt-4 rounded-2xl border border-electrum/20 bg-electrum/5 px-4 py-3 text-[12px] leading-relaxed text-pewter">
      <span className="font-semibold text-electrum">บูธออนไลน์คืออะไร?</span>
      {'  '}เปิดให้เครื่องหลักกับผู้ช่วยขายพร้อมกันที่บูธได้ โดยข้อมูลยังเก็บในเครื่องทุกครั้ง
      การขายออฟไลน์ทำงานได้ปกติเสมอ ไม่ว่าจะเปิดโหมดนี้หรือไม่
    </div>
  )
}

// ── "Off" state — choose a role ───────────────────────────────────────────────
function BoothOffView() {
  const goLiveAsMaster = useApp((s) => s.goLiveAsMaster)
  const joinAsHelper = useApp((s) => s.joinAsHelper)
  const boothStatus = useApp((s) => s.boothStatus)
  const pendingJoinCode = useApp((s) => s.pendingJoinCode)
  const setPendingJoinCode = useApp((s) => s.setPendingJoinCode)
  const [helperCode, setHelperCode] = useState('')
  const [helperName, setHelperName] = useState('')

  // Prefill the code when arriving from a scanned QR deep-link, then consume it.
  useEffect(() => {
    if (pendingJoinCode) {
      setHelperCode(pendingJoinCode)
      setPendingJoinCode('')
    }
  }, [pendingJoinCode, setPendingJoinCode])

  const busy = boothStatus === 'connecting'

  return (
    <div className="flex flex-col gap-4 px-5 pt-5">
      {/* Master option */}
      <button
        disabled={busy}
        onClick={() => void goLiveAsMaster()}
        className="flex items-center gap-4 rounded-2xl border border-divider/10 bg-surface px-5 py-4 text-left active:bg-surface-2 disabled:opacity-50"
      >
        <div className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-electrum/10 text-electrum">
          <IconSignal width={22} height={22} />
        </div>
        <div>
          <div className="font-semibold text-milky">เปิดบูธออนไลน์</div>
          <div className="mt-0.5 text-[12px] text-pewter">เครื่องหลัก · สร้างห้องใหม่</div>
        </div>
      </button>

      {/* Helper option */}
      <div className="rounded-2xl border border-divider/10 bg-surface px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-electrum/10 text-electrum">
            <IconPhone width={20} height={20} />
          </div>
          <div>
            <div className="font-semibold text-milky">เข้าร่วมบูธ</div>
            <div className="mt-0.5 text-[12px] text-pewter">ผู้ช่วย · กรอกรหัสห้องจากเครื่องหลัก</div>
          </div>
        </div>
        {/* Name input */}
        <div className="mt-4">
          <label className="mb-1 block text-[11px] text-pewter">ชื่อของคุณ (ผู้ช่วย)</label>
          <input
            value={helperName}
            onChange={(e) => setHelperName(e.target.value)}
            maxLength={30}
            placeholder="ผู้ช่วย"
            className="w-full rounded-xl border border-divider/10 bg-surface-2 px-3 py-2.5 text-[14px] text-milky placeholder:text-pewter/40 outline-none focus:border-electrum"
          />
        </div>
        {/* Code + join */}
        <div className="mt-2 flex gap-2">
          <input
            value={helperCode}
            onChange={(e) => setHelperCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={6}
            placeholder="รหัสห้อง (6 ตัว)"
            className="flex-1 rounded-xl border border-divider/10 bg-surface-2 px-3 py-2.5 text-center text-[15px] font-mono tracking-[0.2em] text-milky placeholder:text-pewter/40 outline-none focus:border-electrum"
          />
          <button
            disabled={busy || helperCode.length < 4}
            onClick={() => void joinAsHelper(helperCode, helperName.trim() || 'ผู้ช่วย')}
            className="rounded-xl bg-electrum px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 active:brightness-90"
          >
            เข้าร่วม
          </button>
        </div>
        <p className="mt-2.5 text-[11px] text-pewter/60">
          หรือสแกน QR จากเครื่องหลักด้วยกล้องมือถือ แล้วรหัสจะเติมให้อัตโนมัติ
        </p>
      </div>

      {busy && (
        <div className="text-center text-[13px] text-pewter">กำลังเชื่อมต่อ…</div>
      )}
    </div>
  )
}

// ── Master live view ──────────────────────────────────────────────────────────
function MasterLiveView() {
  const boothCode = useApp((s) => s.boothCode)
  const boothMembers = useApp((s) => s.boothMembers)
  const sessionSales = useApp((s) => s.sessionSales)
  const endBooth = useApp((s) => s.endBooth)
  const kickMember = useApp((s) => s.kickMember)

  return (
    <div className="flex flex-col gap-4 px-5 pt-5">
      {/* Live badge + session sales */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
        <span className="text-[12px] font-semibold text-green-400">บูธออนไลน์กำลังทำงาน</span>
        <span className="ml-auto text-[12px] text-pewter">
          ขายแล้ว {sessionSales.length} บิลรอบนี้
        </span>
      </div>

      {/* QR + room code */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-divider/10 bg-surface py-6">
        {boothCode && (
          <div className="rounded-2xl bg-white p-3 shadow-xl">
            <QRCodeSVG value={joinUrl(boothCode)} size={168} />
          </div>
        )}
        <div className="font-mono text-[20px] font-bold tracking-[0.3em] text-electrum">
          {boothCode}
        </div>
        <div className="px-6 text-center text-[11px] text-pewter">
          ให้ผู้ช่วยสแกน QR ด้วยกล้องมือถือ หรือกรอกรหัสนี้ในหน้า “เข้าร่วมบูธ”
        </div>
      </div>

      {/* Members list */}
      <div>
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-pewter">
          สมาชิกในห้อง ({boothMembers.length})
        </div>
        <div className="overflow-hidden rounded-2xl border border-divider/10 bg-surface">
          {boothMembers.length === 0 ? (
            <div className="px-4 py-5 text-center text-[13px] text-pewter">
              ยังไม่มีผู้ช่วยเข้าร่วม
            </div>
          ) : (
            boothMembers.map((m: BoothMember, i) => (
              <MemberRow key={m.id} member={m} isLast={i === boothMembers.length - 1} onKick={() => void kickMember(m.id)} />
            ))
          )}
        </div>
      </div>

      {/* End booth */}
      <button
        onClick={() => void endBooth()}
        className="mt-2 w-full rounded-2xl border border-danger/30 bg-danger/10 py-3.5 text-sm font-semibold text-danger active:bg-danger/20"
      >
        จบบูธ
      </button>
    </div>
  )
}

function MemberRow({ member, isLast, onKick }: { member: BoothMember; isLast: boolean; onKick: () => void }) {
  const canKick = member.role !== 'master'
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${isLast ? '' : 'border-b border-divider/10'}`}>
      <span className={`h-2 w-2 flex-none rounded-full ${member.online ? 'bg-green-400' : 'bg-pewter/40'}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-milky">
          {member.name}
          {member.role === 'master' && (
            <span className="ml-1.5 text-[10px] font-semibold text-electrum/70">เครื่องหลัก</span>
          )}
        </div>
        <div className="text-[11px] text-pewter">
          {member.online ? 'ออนไลน์' : 'ออฟไลน์'}
        </div>
      </div>
      {canKick && (
        <button
          onClick={onKick}
          title="คิกออก"
          className="grid h-8 w-8 place-items-center rounded-lg text-danger/70 active:bg-danger/10"
        >
          <IconTrash width={16} height={16} />
        </button>
      )}
    </div>
  )
}

// ── Helper live view ──────────────────────────────────────────────────────────
function HelperLiveView() {
  const boothCode = useApp((s) => s.boothCode)
  const boothStatus = useApp((s) => s.boothStatus)
  const sessionSales = useApp((s) => s.sessionSales)
  const endBooth = useApp((s) => s.endBooth)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!boothCode) return
    let active = true
    const check = () => {
      void pendingCount(boothCode).then((n) => { if (active) setPending(n) })
    }
    check()
    const id = setInterval(check, 5000)
    return () => { active = false; clearInterval(id) }
  }, [boothCode])

  return (
    <div className="flex flex-col gap-4 px-5 pt-5">
      {/* Status badge + session sales */}
      <div className="flex items-center gap-2">
        {boothStatus === 'live' ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-[12px] font-semibold text-green-400">เชื่อมต่อสำเร็จ</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            <span className="text-[12px] font-semibold text-yellow-400">กำลังเชื่อมต่อ…</span>
          </>
        )}
        <span className="ml-auto text-[12px] text-pewter">
          ขายแล้ว {sessionSales.length} บิลรอบนี้
          {pending > 0 && <span className="ml-1 text-yellow-400">(รอส่ง {pending})</span>}
        </span>
      </div>

      {/* Room code display */}
      <div className="rounded-2xl border border-divider/10 bg-surface px-5 py-4">
        <div className="text-[11px] text-pewter">รหัสห้อง</div>
        <div className="mt-1 font-mono text-[22px] font-bold tracking-[0.25em] text-electrum">
          {boothCode}
        </div>
      </div>

      <div className="rounded-2xl border border-divider/10 bg-surface px-5 py-4 text-[13px] text-pewter">
        แค็ตตาล็อกและการขายจะถูกซิงค์ไปยังเครื่องหลักโดยอัตโนมัติ
      </div>

      {/* Leave booth */}
      <button
        onClick={() => void endBooth()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-divider/15 bg-surface py-3.5 text-sm font-semibold text-milky active:bg-surface-2"
      >
        <IconX width={16} height={16} />
        ออกจากบูธ
      </button>
    </div>
  )
}

// ── Root screen ───────────────────────────────────────────────────────────────
export function BoothScreen() {
  const boothRole = useApp((s) => s.boothRole)

  return (
    <>
      <ScreenHeader title="บูธออนไลน์" back="settings" />
      <div className="flex-1 overflow-y-auto pb-10">
        <InfoBanner />
        {boothRole === 'off' && <BoothOffView />}
        {boothRole === 'master' && <MasterLiveView />}
        {boothRole === 'helper' && <HelperLiveView />}
      </div>
    </>
  )
}
