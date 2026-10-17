import { benefitAtClaimAge } from './socialSecurity'
import type { Plan, ProjectionResult, YearResult } from './types'

/**
 * Deterministic year-by-year projection.
 * All accounts are pooled into one balance (tax treatment comes in a later phase).
 * Contributions, spending, pension and Social Security are entered in today's
 * dollars and grow with inflation.
 */
export function projectPlan(plan: Plan, startYear = new Date().getFullYear()): ProjectionResult {
  const { assumptions: a } = plan
  let balance = plan.accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const yearlySavings = plan.accounts.reduce(
    (sum, acc) => sum + acc.annualContribution + acc.employerMatch,
    0,
  )
  const ssYearly = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge) * 12

  const years: YearResult[] = []
  let depletionAge: number | null = null
  let balanceAtRetirement = balance

  for (let age = plan.currentAge; age <= plan.lifeExpectancy; age++) {
    const t = age - plan.currentAge
    const inflationFactor = (1 + a.inflation) ** t
    const retired = age >= plan.retirementAge

    if (age === plan.retirementAge) balanceAtRetirement = balance

    let contributions = 0
    let withdrawal = 0
    let income = 0
    let spending = 0

    if (!retired) {
      contributions = yearlySavings * inflationFactor
      balance = balance * (1 + a.returnPreRetirement) + contributions
    } else {
      spending = plan.annualSpending * inflationFactor
      income = plan.annualPension * inflationFactor
      if (age >= plan.socialSecurityClaimAge) income += ssYearly * inflationFactor

      const needed = Math.max(spending - income, 0)
      withdrawal = Math.min(needed, balance)
      if (needed > balance && depletionAge === null) depletionAge = age
      balance = (balance - withdrawal) * (1 + a.returnPostRetirement)
    }

    years.push({
      age,
      year: startYear + t,
      balance,
      balanceReal: balance / (1 + a.inflation) ** (t + 1),
      contributions,
      withdrawal,
      income,
      spending,
    })
  }

  const yearsToRetirement = plan.retirementAge - plan.currentAge
  return {
    years,
    balanceAtRetirement,
    balanceAtRetirementReal: balanceAtRetirement / (1 + a.inflation) ** yearsToRetirement,
    depletionAge,
  }
}
