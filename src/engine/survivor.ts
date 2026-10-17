import { benefitAtClaimAge } from './socialSecurity'
import type { FilingStatus, Plan } from './types'

/** Age from which survivor rules apply (Infinity when not modeled). */
export const survivorFromAge = (plan: Plan): number =>
  plan.filingStatus === 'married' && plan.survivor.enabled && plan.survivor.firstDeathAge > 0
    ? plan.survivor.firstDeathAge
    : Infinity

export interface HouseholdYear {
  /** One spouse has died */
  widowed: boolean
  /** Filing status for taxes this year (single from the year after the death) */
  taxStatus: FilingStatus
  /** People in the household (healthcare) */
  people: number
}

export function householdAt(plan: Plan, age: number): HouseholdYear {
  const from = survivorFromAge(plan)
  const widowed = age >= from
  const married = plan.filingStatus === 'married'
  return {
    widowed,
    taxStatus: married && age > from ? 'single' : plan.filingStatus,
    people: married && !widowed ? 2 : 1,
  }
}

/**
 * Yearly Social Security in today's dollars once claimed. Couples get both benefits; after a death,
 * the survivor keeps the larger of the two (SSA survivor benefit).
 */
export function socialSecurityYearly(plan: Plan, widowed: boolean): number {
  const yours = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge)
  const spouse =
    plan.filingStatus === 'married' ? benefitAtClaimAge(plan.spouseSocialSecurityAtFRA, plan.socialSecurityClaimAge) : 0
  return (widowed ? Math.max(yours, spouse) : yours + spouse) * 12
}
