import { NO_INCOME_TAX_STATES, STATE_TAX_RULES } from '../engine'

/** [code, name] for every state, sorted by name. */
export const ALL_STATES = Object.entries({
  ...Object.fromEntries(Object.entries(STATE_TAX_RULES).map(([code, r]) => [code, r.name])),
  ...NO_INCOME_TAX_STATES,
}).sort((a, b) => a[1].localeCompare(b[1]))

export interface StateOption {
  code: string
  name: string
}

/**
 * States whose name starts with the typed text first, then names with a word starting with it ("carolina"), then a
 * matching two-letter code ("nc"). Empty text lists every state.
 */
export function matchStates(query: string): StateOption[] {
  const q = query.trim().toLowerCase()
  const all = ALL_STATES.map(([code, name]) => ({ code, name }))
  if (!q) return all
  const starts = all.filter((s) => s.name.toLowerCase().startsWith(q))
  const word = all.filter((s) => !starts.includes(s) && s.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)))
  const code = all.filter((s) => !starts.includes(s) && !word.includes(s) && s.code.toLowerCase() === q)
  return [...starts, ...word, ...code]
}
