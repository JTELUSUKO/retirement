import { householdAt, spouseOffset } from './survivor'
import type { LongTermCareSettings, Plan } from './types'

/** Defaults used when the long-term care stress test runs on a plan without its own settings. */
export const DEFAULT_LONG_TERM_CARE: LongTermCareSettings = {
  enabled: true,
  who: 'you',
  startAge: 85,
  years: 3,
  annualCost: 100_000,
}

/** Long-term care cost in the year you are `age`, today's dollars (before healthcare inflation). */
export function longTermCareAt(plan: Plan, age: number): number {
  const ltc = plan.longTermCare
  if (!ltc.enabled) return 0
  const forSpouse = plan.filingStatus === 'married' && ltc.who === 'spouse'
  const theirAge = age + (forSpouse ? spouseOffset(plan) : 0)
  if (theirAge < ltc.startAge || theirAge >= ltc.startAge + ltc.years) return 0
  // No care costs once that person has died (survivor modeling)
  const h = householdAt(plan, age)
  if (h.widowed && plan.survivor.whoDies === (forSpouse ? 'spouse' : 'you')) return 0
  return ltc.annualCost
}
