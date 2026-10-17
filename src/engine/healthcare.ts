import { CONFIG_2026 } from './config/2026'
import type { Plan } from './types'

/**
 * Household healthcare cost for a retired year at `age`, in today's dollars
 * (before the extra medical inflation). Married couples are two people of the same age.
 */
export function healthcareCost(plan: Plan, age: number, people = plan.filingStatus === 'married' ? 2 : 1): number {
  const { preMedicareAnnual, medicareAnnual } = plan.healthcare
  return people * (age < CONFIG_2026.medicare.eligibilityAge ? preMedicareAnnual : medicareAnnual)
}

/** Healthcare for one person at `age`, today's dollars (before the extra medical inflation). */
export function healthcarePerPerson(plan: Plan, age: number): number {
  const { preMedicareAnnual, medicareAnnual } = plan.healthcare
  return age < CONFIG_2026.medicare.eligibilityAge ? preMedicareAnnual : medicareAnnual
}
