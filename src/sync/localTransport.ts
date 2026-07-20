/**
 * src/sync/localTransport.ts
 *
 * Stub implementation of RoomTransport for Phase 1.
 * Does NO real networking. All operations resolve immediately or return
 * harmless no-op values so the UI flow can be developed and tested locally.
 *
 * TODO(phase 2+): replace with Firebase implementation.
 *   Entry point: swap `localTransport` with `firebaseTransport` in src/sync/index.ts.
 *   The Firebase transport must satisfy the same RoomTransport interface defined
 *   in src/sync/types.ts — no other files need to change.
 */

import type { RoomTransport, BoothMember, CatalogSnapshot } from './types'
import type { Sale } from '../types'

/** Generates a short random alphanumeric code (for simulating a room code locally). */
function mockCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export const localTransport: RoomTransport = {
  async createRoom(): Promise<string> {
    // TODO(phase 2+): create a Firestore room document, return its code
    const code = mockCode()
    console.debug('[localTransport] createRoom → code:', code)
    return code
  },

  async joinRoom(code: string): Promise<void> {
    // TODO(phase 2+): look up the Firestore room by code, write member record
    console.debug('[localTransport] joinRoom → code:', code)
  },

  async pushCatalog(_catalogSnapshot: CatalogSnapshot): Promise<void> {
    // TODO(phase 2+): write catalog snapshot to Firestore room document / Storage
    console.debug('[localTransport] pushCatalog (no-op in Phase 1)')
  },

  subscribeCatalog(_onUpdate: (catalogSnapshot: CatalogSnapshot) => void): () => void {
    // TODO(phase 2+): attach a Firestore onSnapshot listener on the catalog document
    console.debug('[localTransport] subscribeCatalog (no-op in Phase 1)')
    return () => { /* unsubscribe no-op */ }
  },

  async pushSale(_sale: Sale): Promise<void> {
    // TODO(phase 2+): append sale document to Firestore room's sales sub-collection
    console.debug('[localTransport] pushSale (no-op in Phase 1)')
  },

  subscribeSales(_onSale: (sale: Sale) => void): () => void {
    // TODO(phase 2+): attach a Firestore onSnapshot listener on the sales sub-collection
    console.debug('[localTransport] subscribeSales (no-op in Phase 1)')
    return () => { /* unsubscribe no-op */ }
  },

  async listMembers(): Promise<BoothMember[]> {
    console.debug('[localTransport] listMembers → []')
    return []
  },

  async kickMember(memberId: string): Promise<void> {
    console.debug('[localTransport] kickMember → memberId:', memberId)
  },

  async registerMember(name: string, role: 'master' | 'helper'): Promise<string> {
    console.debug('[localTransport] registerMember (no-op) → name:', name, 'role:', role)
    return 'local-uid'
  },

  subscribeMembers(_onUpdate: (members: BoothMember[]) => void): () => void {
    console.debug('[localTransport] subscribeMembers (no-op)')
    return () => {}
  },

  subscribeSelfMembership(_onRemoved: () => void): () => void {
    console.debug('[localTransport] subscribeSelfMembership (no-op)')
    return () => {}
  },

  async leaveMember(): Promise<void> {
    console.debug('[localTransport] leaveMember (no-op)')
  },

  async endRoom(): Promise<void> {
    console.debug('[localTransport] endRoom (no-op in Phase 1)')
  },
}
