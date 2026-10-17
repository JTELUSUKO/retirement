import { BUCKET_OF, WITHDRAWAL_ORDER, emptyBuckets, withdrawProportionally } from './accounts'
import { CONFIG_2026 } from './config/2026'
import { requiredMinimumDistribution, rmdStartAge } from './rmd'
import { benefitAtClaimAge } from './socialSecurity'
import { federalIncomeTax } from './taxes'
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
 *   taxable account.
 * - Federal income tax (retired years) is paid from savings too: pre-tax withdrawals
 *   (including the whole RMD), pension and taxable Social Security are taxed. Roth, HSA
 *   (assumed spent on medical costs), cash and taxable-account withdrawals are untaxed
 *   (capital gains are not modeled). Taxes during working years are not modeled.
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

  /**
   * Take the RMD, then `need` dollars in withdrawal order, from a copy of `from`.
   * Pure: lets the tax loop try different amounts before committing.
   */
  const drawDown = (from: number[], need: number, rmdRequired: number) => {
    const next = [...from]
    const withdrawalsByBucket = emptyBuckets()
    const rmd = withdrawProportionally(next, pretax, rmdRequired)
    withdrawalsByBucket.pretax += Math.min(rmd, need)
    const rmdReinvested = Math.max(rmd - need, 0)
    next[firstTaxable] += rmdReinvested
    let remaining = Math.max(need - rmd, 0)
    for (const bucket of WITHDRAWAL_ORDER) {
      if (remaining <= 0) break
      const taken = withdrawProportionally(next, indexesIn(bucket), remaining)
      withdrawalsByBucket[bucket] += taken
      remaining -= taken
    }
    const extraPretax = withdrawalsByBucket.pretax - Math.min(rmd, need)
    return {
      balances: next,
      withdrawalsByBucket,
      rmd,
      rmdReinvested,
      /** All pre-tax money taken out this year (taxable as ordinary income). */
      pretaxWithdrawn: rmd + extraPretax,
      shortfall: remaining,
    }
  }

  const birthYear = startYear - plan.currentAge
  // Tax brackets are in 2026 dollars; shift them if the projection starts in another year.
  const taxIndexAtStart = (1 + plan.assumptions.inflation) ** (startYear - CONFIG_2026.year)
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
    const startPriceLevel = priceLevel
    const startByBucketReal = emptyBuckets()
    balances.forEach((b, i) => (startByBucketReal[bucketOf[i]] += b / priceLevel))

    if (age === plan.retirementAge) {
      balanceAtRetirement = startBalance
      balanceAtRetirementReal = startBalanceReal
    }

    let spending = 0
    let ssIncome = 0
    let pensionIncome = 0
    if (retired) {
      spending = plan.annualSpending * priceLevel
      pensionIncome = plan.annualPension * priceLevel
      if (age >= plan.socialSecurityClaimAge) ssIncome = ssYearly * priceLevel
    }
    const income = pensionIncome + ssIncome
    const gap = Math.max(spending - income, 0)
    const rmdRequired = requiredMinimumDistribution(
      age,
      birthYear,
      pretax.reduce((sum, i) => sum + balances[i], 0),
    )

    // Withdrawals and tax depend on each other (pre-tax withdrawals are taxable, and the
    // tax is paid from savings), so repeat until the tax settles. Converges in a few
    // passes because the marginal rate is well below 100%.
    let tax = 0
    let taxableIncome = 0
    let draw = drawDown(balances, gap, rmdRequired)
    if (retired) {
      for (let pass = 0; pass < 25; pass++) {
        const result = federalIncomeTax({
          ordinaryIncome: draw.pretaxWithdrawn + pensionIncome,
          socialSecurity: ssIncome,
          age,
          year: startYear + t,
          status: plan.filingStatus,
          priceLevel: priceLevel * taxIndexAtStart,
        })
        taxableIncome = result.taxableIncome
        const settled = Math.abs(result.tax - tax) < 0.5
        tax = result.tax
        if (settled) break
        draw = drawDown(balances, gap + tax, rmdRequired)
      }
    }
    balances.splice(0, balances.length, ...draw.balances)
    if (draw.shortfall > 0.005 && depletionAge === null) depletionAge = age

    // Growth, then year-end contributions while working (HSA contributions stop at Medicare age)
    let contributions = 0
    accounts.forEach((acc, i) => {
      balances[i] *= 1 + (bucketOf[i] === 'cash' ? market.inflation : market.return)
      const hsaClosed = bucketOf[i] === 'hsa' && age >= CONFIG_2026.medicare.eligibilityAge
      if (!retired && !hsaClosed) {
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
      priceLevel: startPriceLevel,
      startBalance,
      startBalanceReal,
      balance,
      balanceReal: balance / priceLevel,
      contributions,
      withdrawal: Object.values(draw.withdrawalsByBucket).reduce((sum, w) => sum + w, 0),
      rmd: draw.rmd,
      rmdReinvested: draw.rmdReinvested,
      withdrawalsByBucket: draw.withdrawalsByBucket,
      startByBucketReal,
      income,
      spending,
      tax,
      taxableIncome,
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
