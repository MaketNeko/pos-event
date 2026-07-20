/**
 * src/sync/types.ts
 *
 * Core types for the online-booth sync layer.
 * These are the contracts that Phase 2+ (Firebase) must fulfill.
 * The app imports ONLY from src/sync/index.ts — never directly from Firebase.
 */

import type { Product, Category, ProductSet, Owner, Sale } from '../types'

/**
 * The full catalog snapshot pushed from master → helpers.
 * Phase 2: products, categories, sets, owners + current event info.
 */
export interface CatalogSnapshot {
  products: Product[]
  categories: Category[]
  sets: ProductSet[]
  owners: Owner[]
  eventId: string
  eventName: string
}

/** Whether this device is participating in a live booth session and in what role. */
export type BoothRole = 'off' | 'master' | 'helper'

/** Connection state of the current booth session. */
export type BoothStatus = 'offline' | 'connecting' | 'live'

/** A participant in the booth session as seen from any device. */
export interface BoothMember {
  /** Unique device/session identifier assigned when joining. */
  id: string
  /** Human-readable display name (device name or helper alias). */
  name: string
  /** Whether this member is currently online (has an active connection). */
  online: boolean
  /** Epoch-ms of the last heartbeat or activity seen from this member. */
  lastSeen: number
}

/**
 * RoomTransport — the async interface that encapsulates ALL network I/O for booth mode.
 *
 * Phase 1: fulfilled by `localTransport` (stubs, no network).
 * Phase 2+: fulfilled by a Firebase implementation that plugs in here.
 *
 * The rest of the app (store, screens) depends ONLY on this interface,
 * never on Firebase directly.
 */
export interface RoomTransport {
  /**
   * Create a new booth room as master.
   * Returns the room code that helpers use to join.
   * Master's device becomes the authoritative source for the catalog.
   */
  createRoom(): Promise<string>

  /**
   * Join an existing booth room as a helper.
   * @param code - The room code shared by the master (e.g. via QR or manual entry).
   */
  joinRoom(code: string): Promise<void>

  /**
   * Push the full catalog snapshot (products, categories, sets, owners, current event)
   * from master → all helpers.
   * Called by master whenever the catalog changes while a room is live.
   * No-op when called from a helper device.
   */
  pushCatalog(catalogSnapshot: CatalogSnapshot): Promise<void>

  /**
   * Subscribe to catalog updates pushed by master.
   * Fires the callback whenever master calls pushCatalog.
   * Helpers call this after joining; master may ignore or use for confirmation.
   * Returns an unsubscribe function.
   */
  subscribeCatalog(onUpdate: (catalogSnapshot: CatalogSnapshot) => void): () => void

  /**
   * Push a completed sale from any device into the shared append-only sales log.
   * Both master and helpers call this after a bill is completed.
   */
  pushSale(sale: Sale): Promise<void>

  /**
   * Subscribe to new sales pushed by any member.
   * Fires the callback for each incoming sale so other devices can merge it locally.
   * Returns an unsubscribe function.
   */
  subscribeSales(onSale: (sale: Sale) => void): () => void

  /**
   * List all currently connected members in the room.
   * Resolves with the latest snapshot of BoothMember records.
   */
  listMembers(): Promise<BoothMember[]>

  /**
   * Kick a member from the room (master-only operation).
   * The kicked member should lose access and transition to role 'off'.
   * @param memberId - The id of the BoothMember to remove.
   */
  kickMember(memberId: string): Promise<void>

  /**
   * End the booth session (master-only operation).
   * Signals helpers to stop syncing, clears the cloud room.
   * Local data (sales history, catalog) is never deleted by this call.
   */
  endRoom(): Promise<void>
}
