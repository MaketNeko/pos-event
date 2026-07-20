/**
 * src/sync/outbox.ts
 *
 * Durable offline-first outbox for booth sales.
 *
 * Lifecycle:
 *   1. enqueueSale() — writes the sale to IndexedDB (outbox table) immediately,
 *      so completing a sale always succeeds locally even when offline.
 *      Then fires a fire-and-forget flushOutbox() attempt.
 *   2. flushOutbox() — iterates pending rows whose roomCode matches the
 *      currently active room and calls transport.pushSale() for each.
 *      On success the row is deleted. On failure (offline / error) it
 *      stops early, leaving the rest for the next flush attempt.
 *   3. initOutboxAutoFlush() — attaches a 'online' window event listener
 *      (idempotent) so flushOutbox() is re-attempted every time the
 *      device reconnects. Call this from store actions that start a
 *      live booth session (goLiveAsMaster / joinAsHelper).
 *
 * The outbox table persists across page reloads — rows are only removed
 * after a confirmed push. Phase 5 should handle teardown/safe-end cleanup
 * (e.g., flush + clear for the closed room code).
 */

import { db } from '../db'
import { transport } from './index'
import { getCurrentRoomCode } from './firebaseTransport'
import type { Sale } from '../types'

// ── Concurrency guard ─────────────────────────────────────────────────────────

let flushing = false

// ── Auto-flush init (idempotent) ──────────────────────────────────────────────

let _autoFlushAttached = false

/**
 * Attach a window 'online' listener that re-triggers flushOutbox() whenever
 * the device reconnects. Safe to call multiple times — only registers once.
 * Called by store when a room becomes live (goLiveAsMaster / joinAsHelper).
 */
export function initOutboxAutoFlush(): void {
  if (_autoFlushAttached) return
  _autoFlushAttached = true
  window.addEventListener('online', () => {
    void flushOutbox()
  })
  console.debug('[outbox] auto-flush listener attached')
}

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Durably enqueue a sale for the given room.
 * Writes to IndexedDB first (always succeeds), then attempts an immediate flush.
 * The flush failure is swallowed — the outbox will retry on the next 'online' event.
 */
export async function enqueueSale(roomCode: string, sale: Sale): Promise<void> {
  await db.outbox.put({ id: sale.id, roomCode, sale, createdAt: Date.now() })
  console.debug('[outbox] enqueued sale:', sale.id, 'for room:', roomCode)
  // Fire-and-forget — don't await, don't throw
  void flushOutbox().catch(() => { /* swallowed — will retry on reconnect */ })
}

/**
 * Attempt to push all pending outbox rows for the currently active room.
 * Rows are flushed in insertion order (createdAt ASC).
 * Stops at the first push failure to preserve ordering (no partial-success gaps).
 * Guard against concurrent runs with the `flushing` boolean.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) return
  const code = getCurrentRoomCode()
  if (!code) return // no active room; nothing to flush

  flushing = true
  try {
    const pending = await db.outbox
      .where('roomCode')
      .equals(code)
      .sortBy('createdAt')

    for (const row of pending) {
      try {
        await transport.pushSale(row.sale)
        await db.outbox.delete(row.id)
        console.debug('[outbox] flushed sale:', row.id)
      } catch (err) {
        // Offline or transient error — stop here; leave remaining rows for next flush
        console.debug('[outbox] flush stopped at sale:', row.id, err)
        break
      }
    }
  } finally {
    flushing = false
  }
}

/**
 * Count pending outbox rows for a given room.
 * Used for UI indicators (Phase 5 / BoothScreen badge).
 */
export async function pendingCount(roomCode: string): Promise<number> {
  return db.outbox.where('roomCode').equals(roomCode).count()
}
