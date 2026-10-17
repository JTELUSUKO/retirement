import { benefitAtClaimAge } from './socialSecurity'
import type { Plan, ProjectionResult, YearResult } from './types'

/** Market conditions for one year of the plan. */
export interface YearMarket {
  /** Nominal portfolio return, e.g. 0.07 */
  return: number
  /** Inflation over the year, e.g. 0.025 */
  inflation: number
}

/** Market conditions for year `t` (0 = current year). */
export type MarketFn = (t: number, retired: boolean) => YearMarket

/**
 * Year-by-year projection under the given market conditions.
 *
 * Timing rules (one row per year, age = your age at the start of that year):
 * - Working years: the balance grows for the full year, then that year's
 *   contributions are added at year end (they earn nothing that year).
 * - Retired years: spending not covered by income is withdrawn at the start
 *   of the year, then the remainder grows for the year.
 * - "Savings at retirement" is the balance at the start of the retirement-age year.
 *
 * Spending, contributions, pension and Social Security are entered in today's
 * dollars and rise with realized inflation. All accounts are pooled into one balance.
 */
export function simulatePath(
  plan: Plan,
  marketFor: MarketFn,
  startYear = new Date().getFullYear(),
): ProjectionResult {
  let balance = plan.accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const yearlySavings = plan.accounts.reduce(
    (sum, acc) => sum + acc.annualContribution + acc.employerMatch,
    0,
  )
  const ssYearly = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge) * 12

  const years: YearResult[] = []
  let depletionAge: number | null = null
  let balanceAtRetirement = balance
  let balanceAtRetirementReal = balance
  // Price level relative to today: 1 now, 1.025 after one year of 2.5% inflation, ...
  let priceLevel = 1

  for (let age = plan.currentAge; age <= plan.lifeExpectancy; age++) {
    const t = age - plan.currentAge
    const retired = age >= plan.retirementAge
    const market = marketFor(t, retired)
    const startBalance = balance
    const startBalanceReal = balance / priceLevel

    if (age === plan.retirementAge) {
      balanceAtRetirement = startBalance
      balanceAtRetirementReal = startBalanceReal
    }

    let contributions = 0
    let withdrawal = 0
    let income = 0
    let spending = 0

    if (!retired) {
      contributions = yearlySavings * priceLevel
      balance = balance * (1 + market.return) + contributions
    } else {
      spending = plan.annualSpending * priceLevel
      income = plan.annualPension * priceLevel
      if (age >= plan.socialSecurityClaimAge) income += ssYearly * priceLevel

      const needed = Math.max(spending - income, 0)
      withdrawal = Math.min(needed, balance)
      if (needed > balance && depletionAge === null) depletionAge = age
      balance = (balance - withdrawal) * (1 + market.return)
    }

    priceLevel *= 1 + market.inflation

    years.push({
      age,
      year: startYear + t,
      startBalance,
      startBalanceReal,
      balance,
      balanceReal: balance / priceLevel,
      contributions,
      withdrawal,
      income,
      spending,
    })
  }

  return { years, balanceAtRetirement, balanceAtRetirementReal, depletionAge }
}

/** Deterministic projection: the average return and inflation every year. */
export function projectPlan(plan: Plan, startYear = new Date().getFullYear()): ProjectionResult {
  const { returnPreRetirement, returnPostRetirement, inflation } = plan.assumptions
  return simulatePath(
    plan,
    (_, retired) => ({ return: retired ? returnPostRetirement : returnPreRetirement, inflation }),
    startYear,
  )
}
