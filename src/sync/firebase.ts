/**
 * src/sync/firebase.ts
 *
 * Firebase app initialisation for the online-booth sync layer.
 * Only Firestore + Anonymous Auth are used (no Storage/Hosting).
 *
 * NOTE: firebaseConfig is NOT a secret — these values ship in every web
 * client. Real access control lives in Firestore security rules (Phase 4) and
 * GCP API-key restrictions. Values are read from Vite env (.env / .env.example)
 * so they stay out of source control and don't trip secret scanners.
 */

import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, type User } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * True when the Firebase web config is present. When false the app still boots
 * (POS works fully offline) — only the online-booth features fail, surfacing a
 * toast when the user tries to go live / join. We must NOT throw here: this
 * module is pulled in eagerly by store.ts, so throwing would blank the whole
 * app on any build where VITE_FIREBASE_* isn't injected (e.g. CI without .env).
 */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

if (!firebaseConfigured) {
  console.warn(
    '[firebase] Missing VITE_FIREBASE_* env vars — online-booth mode is disabled. ' +
      'Copy .env.example to .env (local) or set them as GitHub repo Variables (CI).',
  )
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
