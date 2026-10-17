// The visitor's Anthropic API key. Kept for this tab only (sessionStorage) unless they choose
// "remember on this device" (localStorage). Never sent anywhere except api.anthropic.com.
const KEY = 'anthropic-api-key'

const safely = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function loadApiKey(): { key: string; remembered: boolean } | null {
  const remembered = safely(() => localStorage.getItem(KEY), null)
  if (remembered) return { key: remembered, remembered: true }
  const session = safely(() => sessionStorage.getItem(KEY), null)
  return session ? { key: session, remembered: false } : null
}

export function saveApiKey(key: string, remember: boolean) {
  forgetApiKey()
  safely(() => (remember ? localStorage : sessionStorage).setItem(KEY, key), undefined)
}

export function forgetApiKey() {
  safely(() => localStorage.removeItem(KEY), undefined)
  safely(() => sessionStorage.removeItem(KEY), undefined)
}
