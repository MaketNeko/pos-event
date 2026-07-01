import { useEffect, useReducer } from 'react'

// Registered at module import time so we catch the event before React mounts.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  emit()
})

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  const iOS = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ reports as Mac; detect touch
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOS || iPadOS
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  emit()
  return outcome === 'accepted'
}

/** React hook exposing install capability + platform, re-rendering on changes. */
export function useInstall() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    return () => {
      listeners.delete(force)
    }
  }, [])
  return {
    canPrompt: deferred !== null, // Android / Chromium native prompt available
    standalone: isStandalone(), // already installed / launched as app
    ios: isIOS(),
    promptInstall,
  }
}
