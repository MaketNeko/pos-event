/**
 * src/sync/index.ts
 *
 * Public facade for the sync module. The rest of the app imports ONLY from here.
 *
 * To swap in the real Firebase transport (Phase 2+):
 *   1. Add `src/sync/firebaseTransport.ts` implementing RoomTransport.
 *   2. Change the `transport` export below to point at the Firebase implementation.
 *   3. No other files need to change.
 */

export type { BoothRole, BoothStatus, BoothMember, RoomTransport } from './types'
export { localTransport } from './localTransport'

// Active transport used by the store. Phase 2+: swap for firebaseTransport.
import { localTransport } from './localTransport'
export const transport = localTransport
