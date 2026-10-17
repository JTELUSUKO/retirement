import { BUCKET_OF, WITHDRAWAL_ORDER, emptyBuckets, withdrawProportionally } from './accounts'
import { requiredMinimumDistribution, rmdStartAge } from './rmd'
import { benefitAtClaimAge } from './socialSecurity'
import type { Plan, ProjectionResult, TaxBucket, YearResult } from './types'

/** Id of the hidden taxable account that holds reinvested RMDs when the plan has none. */
export const REINVESTED_RMD_ID = 'reinvested-rmd'

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
 * Year-by-year projection under the given market conditions, tracking each account.
 *
 * Timing rules (one row per year, age = your age at the start of that year):
 * - RMDs (from the RMD start age) are taken from pre-tax accounts at the start of
 *   the year, based on the start-of-year pre-tax balance.
 * - Retired years: spending not covered by income is withdrawn at the start of the
 *   year, using the RMD first, then accounts in WITHDRAWAL_ORDER (proportionally
 *   within each tax bucket). RMD money not needed for spending is reinvested in a
 *   taxable account. Taxes are not modeled yet.
 * - Then every account grows for the year (cash earns inflation; others earn the
 *   market return), and working years add contributions at year end.
 * - "Savings at retirement" is the total balance at the start of the retirement-age year.
 *
 * Spending, contributions, pension and Social Security are entered in today's
 * dollars and rise with realized inflation.
 */
export function simulatePath(
  plan: Plan,
  marketFor: MarketFn,
  startYear = new Date().getFullYear(),
): ProjectionResult {
  const accounts = [...plan.accounts]
  // RMD excess needs a taxable account to land in; add a hidden one if there isn't any.
  if (!accounts.some((a) => a.type === 'taxable')) {
    accounts.push({ id: REINVESTED_RMD_ID, name: 'Reinvested RMDs', type: 'taxable', balance: 0, annualContribution: 0, employerMatch: 0 })
  }
  const balances = accounts.map((a) => a.balance)
  const bucketOf = accounts.map((a) => BUCKET_OF[a.type])
  const indexesIn = (bucket: TaxBucket) => bucketOf.flatMap((b, i) => (b === bucket ? [i] : []))
  const pretax = indexesIn('pretax')
  const firstTaxable = bucketOf.indexOf('taxable')
  const total = () => balances.reduce((sum, b) => sum + b, 0)

  const birthYear = startYear - plan.currentAge
  const ssYearly = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge) * 12

  const years: YearResult[] = []
  let depletionAge: number | null = null
  let balanceAtRetirement = total()
  let balanceAtRetirementReal = balanceAtRetirement
  // Price level relative to today: 1 now, 1.025 after one year of 2.5% inflation, ...
  let priceLevel = 1

  for (let age = plan.currentAge; age <= plan.lifeExpectancy; age++) {
    const t = age - plan.currentAge
    const retired = age >= plan.retirementAge
    const market = marketFor(t, retired)
    const startBalance = total()
    const startBalanceReal = startBalance / priceLevel
    const startByBucketReal = emptyBuckets()
    balances.forEach((b, i) => (startByBucketReal[bucketOf[i]] += b / priceLevel))

    if (age === plan.retirementAge) {
      balanceAtRetirement = startBalance
      balanceAtRetirementReal = startBalanceReal
    }

    const withdrawalsByBucket = emptyBuckets()
    let spending = 0
    let income = 0
    if (retired) {
      spending = plan.annualSpending * priceLevel
      income = plan.annualPension * priceLevel
      if (age >= plan.socialSecurityClaimAge) income += ssYearly * priceLevel
    }
    let needed = Math.max(spending - income, 0)

    // 1. Required minimum distribution
    const pretaxBalance = pretax.reduce((sum, i) => sum + balances[i], 0)
    const rmd = withdrawProportionally(
      balances,
      pretax,
      requiredMinimumDistribution(age, birthYear, pretaxBalance),
    )
    withdrawalsByBucket.pretax += Math.min(rmd, needed)
    const rmdReinvested = Math.max(rmd - needed, 0)
    balances[firstTaxable] += rmdReinvested
    needed = Math.max(needed - rmd, 0)

    // 2. Remaining spending, in withdrawal order
    for (const bucket of WITHDRAWAL_ORDER) {
      if (needed <= 0) break
      const taken = withdrawProportionally(balances, indexesIn(bucket), needed)
      withdrawalsByBucket[bucket] += taken
      needed -= taken
    }
    if (needed > 0.005 && depletionAge === null) depletionAge = age

    // 3. Growth, then year-end contributions while working
    let contributions = 0
    accounts.forEach((acc, i) => {
      balances[i] *= 1 + (bucketOf[i] === 'cash' ? market.inflation : market.return)
      if (!retired) {
        const added = (acc.annualContribution + acc.employerMatch) * priceLevel
        balances[i] += added
        contributions += added
      }
    })

    priceLevel *= 1 + market.inflation
    const balance = total()

    years.push({
      age,
      year: startYear + t,
      startBalance,
      startBalanceReal,
      balance,
      balanceReal: balance / priceLevel,
      contributions,
      withdrawal: Object.values(withdrawalsByBucket).reduce((sum, w) => sum + w, 0),
      rmd,
      rmdReinvested,
      withdrawalsByBucket,
      startByBucketReal,
      income,
      spending,
    })
  }

  return { years, balanceAtRetirement, balanceAtRetirementReal, depletionAge, rmdStartAge: rmdStartAge(birthYear) }
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
