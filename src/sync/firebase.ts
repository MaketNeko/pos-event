/**
 * src/sync/firebase.ts
 *
 * Firebase app initialisation for the online-booth sync layer.
 * Only Firestore + Anonymous Auth are used (no Storage/Hosting).
 *
 * NOTE: firebaseConfig is NOT a secret — these values ship in every web
 * client. Real access control lives in Firestore security rules (Phase 4).
 */

import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, type User } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDh-bU06vtue7JehARLvYgUH9eGy3oxjpQ',
  authDomain: 'nekopos-99a46.firebaseapp.com',
  projectId: 'nekopos-99a46',
  storageBucket: 'nekopos-99a46.firebasestorage.app',
  messagingSenderId: '785934952373',
  appId: '1:785934952373:web:12cd2ea0e3bcc8062d1bfc',
}

const app = initializeApp(firebaseConfig)

/**
 * Firestore instance for the booth sync layer (distinct from the local Dexie `db`).
 * `ignoreUndefinedProperties` so optional fields (e.g. a product's `ownerId` or a
 * sale item's `ownerName`) that are `undefined` are dropped on write instead of
 * throwing — Firestore rejects undefined field values.
 */
export const firestore = initializeFirestore(app, { ignoreUndefinedProperties: true })

export const auth = getAuth(app)

let authPromise: Promise<User> | null = null

/**
 * Ensure the current device is signed in anonymously, returning the User.
 * Cached so repeated calls reuse the same anonymous identity/uid.
 */
export function ensureAuth(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  if (!authPromise) {
    authPromise = signInAnonymously(auth).then((cred) => cred.user)
  }
  return authPromise
}
