/**
 * src/sync/index.ts
 *
 * Public facade for the sync module. The rest of the app imports ONLY from here.
 *
 * Phase 2: switched to firebaseTransport (catalog + room lifecycle).
 *   Sales (Phase 3) and membership (Phase 4) are still stubs inside firebaseTransport.
 *
 * To revert to local-only during development: swap the import below back to localTransport.
 */

export type { BoothRole, BoothStatus, BoothMember, RoomTransport, CatalogSnapshot } from './types'
export { localTransport } from './localTransport'
export { firebaseTransport } from './firebaseTransport'

// Active transport used by the store.
import { firebaseTransport } from './firebaseTransport'
export const transport = firebaseTransport
