import { CONFIG_2026 } from './config/2026'
import type { Plan } from './types'

/**
 * Household healthcare cost for a retired year at `age`, in today's dollars
 * (before the extra medical inflation). Married couples are two people of the same age.
 */
export function healthcareCost(plan: Plan, age: number): number {
  const people = plan.filingStatus === 'married' ? 2 : 1
  const { preMedicareAnnual, medicareAnnual } = plan.healthcare
  return people * (age < CONFIG_2026.medicare.eligibilityAge ? preMedicareAnnual : medicareAnnual)
}
