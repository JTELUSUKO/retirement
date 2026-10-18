import { NO_INCOME_TAX_STATES, STATE_TAX_2026 } from '../engine'

/** [code, name] for every state, sorted by name. */
export const ALL_STATES = Object.entries({
  ...Object.fromEntries(Object.entries(STATE_TAX_2026).map(([code, r]) => [code, r.name])),
  ...NO_INCOME_TAX_STATES,
}).sort((a, b) => a[1].localeCompare(b[1]))
