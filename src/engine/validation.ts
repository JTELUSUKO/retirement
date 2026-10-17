import { CONFIG_2026 } from './config/2026'
import type { Plan, PlanIssue } from './types'

const { earliestClaimAge, latestClaimAge } = CONFIG_2026.socialSecurity

export const AGE_LIMITS = { min: 18, max: 110 }

/**
 * Essentials not filled in yet (0 = left blank). Pages show a getting-started checklist,
 * not errors, until this is empty.
 */
export function missingEssentials(plan: Plan): string[] {
  const missing: string[] = []
  if (plan.currentAge === 0) missing.push('your age')
  if (plan.retirementAge === 0) missing.push('the age you plan to retire')
  if (plan.lifeExpectancy === 0) missing.push('the age to plan to (many people use 90–95)')
  if (plan.annualSpending === 0) missing.push('your yearly spending in retirement')
  return missing
}

/** Problems that would make the projection meaningless. Empty array = OK to run. */
export function validatePlan(plan: Plan): PlanIssue[] {
  const issues: PlanIssue[] = []
  const { currentAge, retirementAge, lifeExpectancy } = plan

  // Blank ages: ask for them, and skip comparisons that would only produce confusing messages
  const blanks: [keyof Plan, string][] = [
    ['currentAge', 'Enter your age.'],
    ['retirementAge', 'Enter the age you plan to retire.'],
    ['lifeExpectancy', 'Enter the age to plan to.'],
  ]
  for (const [field, message] of blanks) if (plan[field] === 0) issues.push({ field, message })
  if (issues.length > 0) return issues

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
    plan.spouseSocialSecurityAtFRA,
    ...plan.incomeStreams.map((i) => i.annualAmount),
    plan.healthcare.preMedicareAnnual,
    plan.healthcare.medicareAnnual,
    plan.stateRetirementExclusion,
    ...plan.accounts.flatMap((a) => [a.balance, a.annualContribution, a.employerMatch]),
  ]
  if (plan.filingStatus === 'married' && plan.survivor.enabled) {
    const { firstDeathAge, spendingShare } = plan.survivor
    if (firstDeathAge <= currentAge || firstDeathAge >= lifeExpectancy) {
      issues.push({ field: 'survivor', message: 'The age one of you dies must be after today and before your “plan to” age.' })
    }
    if (spendingShare < 0.3 || spendingShare > 1) {
      issues.push({ field: 'survivor', message: 'Survivor spending should be between 30% and 100% of the couple’s.' })
    }
  }
  for (const stream of plan.incomeStreams) {
    if (stream.survivorShare < 0 || stream.survivorShare > 1) {
      issues.push({ field: 'incomeStreams', message: `“${stream.name}” survivor share must be 0–100%.` })
    }
  }

  const annuity = plan.annuityPurchase
  if (annuity.enabled) {
    if (annuity.purchaseAge < retirementAge || annuity.purchaseAge > lifeExpectancy) {
      issues.push({ field: 'annuityPurchase', message: 'Buy the annuity at or after your retirement age, and before your “plan to age”.' })
    }
    if (annuity.amount <= 0) {
      issues.push({ field: 'annuityPurchase', message: 'Enter how much to put into the annuity.' })
    }
    if (annuity.payoutRate !== null && (annuity.payoutRate <= 0 || annuity.payoutRate > 0.3)) {
      issues.push({ field: 'annuityPurchase', message: 'Annuity payout rate should be between 0% and 30%.' })
    }
  }
  for (const stream of plan.incomeStreams) {
    if (stream.startAge < AGE_LIMITS.min) {
      issues.push({ field: 'incomeStreams', message: `Enter when “${stream.name}” starts.` })
    }
    if (stream.endAge !== null && stream.endAge < stream.startAge) {
      issues.push({ field: 'incomeStreams', message: `“${stream.name}” ends before it starts.` })
    }
    if (stream.taxableShare < 0 || stream.taxableShare > 1) {
      issues.push({ field: 'incomeStreams', message: `“${stream.name}” taxable share must be 0–100%.` })
    }
  }
  if (amounts.some((n) => !Number.isFinite(n) || n < 0)) {
    issues.push({ field: 'accounts', message: 'Dollar amounts can’t be negative.' })
  }
  return issues
}
