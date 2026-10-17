import { CONFIG_2026 } from './config/2026'
import type { Plan, PlanIssue } from './types'

const { earliestClaimAge, latestClaimAge } = CONFIG_2026.socialSecurity

export const AGE_LIMITS = { min: 18, max: 110 }

/** Problems that would make the projection meaningless. Empty array = OK to run. */
export function validatePlan(plan: Plan): PlanIssue[] {
  const issues: PlanIssue[] = []
  const { currentAge, retirementAge, lifeExpectancy } = plan

  if (currentAge < AGE_LIMITS.min || currentAge > AGE_LIMITS.max) {
    issues.push({ field: 'currentAge', message: `Age must be between ${AGE_LIMITS.min} and ${AGE_LIMITS.max}.` })
  }
  if (retirementAge < currentAge) {
    issues.push({ field: 'retirementAge', message: 'Retirement age can’t be earlier than your current age.' })
  }
  if (lifeExpectancy <= retirementAge) {
    issues.push({ field: 'lifeExpectancy', message: '“Plan to age” must be later than your retirement age.' })
  }
  if (lifeExpectancy > AGE_LIMITS.max) {
    issues.push({ field: 'lifeExpectancy', message: `“Plan to age” can be at most ${AGE_LIMITS.max}.` })
  }
  if (plan.socialSecurityClaimAge < earliestClaimAge || plan.socialSecurityClaimAge > latestClaimAge) {
    issues.push({
      field: 'socialSecurityClaimAge',
      message: `Social Security can be claimed between ${earliestClaimAge} and ${latestClaimAge}.`,
    })
  }
  const amounts = [
    plan.annualSpending,
    plan.socialSecurityAtFRA,
    plan.annualPension,
    plan.healthcare.preMedicareAnnual,
    plan.healthcare.medicareAnnual,
    ...plan.accounts.flatMap((a) => [a.balance, a.annualContribution, a.employerMatch]),
  ]
  if (amounts.some((n) => !Number.isFinite(n) || n < 0)) {
    issues.push({ field: 'accounts', message: 'Dollar amounts can’t be negative.' })
  }
  return issues
}
