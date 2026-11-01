import { APP_ID, MAX_FILE_BYTES, parsePlanFile, type ParseResult } from './planFile'

// The site moved from <user>.github.io/retirement/ to willitlast.app. Saved plans live in each site's own
// localStorage, so the old address sends the visitor's plan along in the URL fragment (#moved=…), which
// browsers never send to a server, and the new address imports it once.

export const NEW_HOME = 'https://willitlast.app/'
const PREFIX = '#moved='

const toBase64Url = (text: string) =>
  btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (data: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(data.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  )

/**
 * Where to send a visitor from the old address. `saved` is the raw "retirement-plan" localStorage value;
 * `hash` is the current page (#terms…), kept when there's no plan to carry.
 */
export function movedUrl(saved: string | null, hash: string): string {
  try {
    const stored: unknown = saved ? JSON.parse(saved) : null
    if (stored && typeof stored === 'object' && 'state' in stored && 'version' in stored) {
      const { state, version } = stored as { state: { plan?: unknown }; version: unknown }
      if (state?.plan) return NEW_HOME + PREFIX + toBase64Url(JSON.stringify({ app: APP_ID, version, plan: state.plan }))
    }
  } catch {
    // Unreadable save: move without it
  }
  return NEW_HOME + hash
}

/** The plan carried in a #moved=… fragment (checked and upgraded like a backup file), or null if there isn't one. */
export function planFromMove(hash: string): ParseResult | null {
  if (!hash.startsWith(PREFIX)) return null
  if (hash.length > MAX_FILE_BYTES * 2) return { ok: false, error: 'The moved plan is too large.' }
  try {
    return parsePlanFile(fromBase64Url(hash.slice(PREFIX.length)))
  } catch {
    return { ok: false, error: 'The moved plan couldn’t be read.' }
  }
}
