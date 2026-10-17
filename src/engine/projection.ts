import { BUCKET_OF, WITHDRAWAL_ORDER, emptyBuckets, withdrawProportionally } from './accounts'
import { CONFIG_2026 } from './config/2026'
import { requiredMinimumDistribution, rmdStartAge } from './rmd'
import { householdAt, socialSecurityYearly } from './survivor'
import { annuityTaxableShare, payoutRate } from './annuity'
import { healthcareCost } from './healthcare'
import { incomeAtAge } from './income'
import { withAdjust, type MarketAdjust } from './scenarios'
import { stateIncomeTax } from './stateTax'
import { federalIncomeTax, taxableSocialSecurity } from './taxes'
import type { Plan, ProjectionResult, TaxBucket, YearResult } from './types'

/** Penalty on non-medical HSA withdrawals before 65. */
export const HSA_PENALTY = 0.2

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
 *   (including the whole RMD), the taxable share of other income, taxable Social Security and non-medical HSA
 *   withdrawals are taxed (plus a 20% penalty on non-medical HSA money before 65).
 *   Roth, cash and taxable-account withdrawals are untaxed (capital gains are not
 *   modeled). Taxes during working years are not modeled.
 * - State income tax (retired years) is added the same way, using the plan's state (see stateTax.ts).
 * - Healthcare costs (retired years) are added to spending; the HSA pays them first.
 * - Married couples can model one spouse dying first (see survivor.ts): from that age the survivor keeps
 *   the larger Social Security benefit, spends less, pays healthcare for one, and files single the next year.
 * - Income beyond spending and tax is reinvested in a taxable account.
 * - An annuity purchase (at or after retirement) moves the premium out of savings at the
 *   start of the purchase year; payments start that year and last for life.
 * - Then every account grows for the year (cash earns inflation; others earn the
 *   market return), and working years add contributions at year end.
 * - "Savings at retirement" is the total balance at the start of the retirement-age year.
 *
 * Spending, contributions and Social Security are entered in today's dollars and rise
 * with realized inflation. Other income rises with inflation only if marked so; fixed
 * amounts (most annuities) stay flat. Other income counts in retired years only.
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
  const hsa = indexesIn('hsa')
  const firstTaxable = bucketOf.indexOf('taxable')
  const total = () => balances.reduce((sum, b) => sum + b, 0)

  /**
   * Take the RMD, then `need` dollars from a copy of `from`: the HSA pays up to
   * `medicalCost` first (tax-free), then accounts in withdrawal order.
   * Pure: lets the tax loop try different amounts before committing.
   */
  const drawDown = (from: number[], need: number, rmdRequired: number, medicalCost: number) => {
    const next = [...from]
    const withdrawalsByBucket = emptyBuckets()
    const rmd = withdrawProportionally(next, pretax, rmdRequired)
    withdrawalsByBucket.pretax += Math.min(rmd, need)
    const rmdReinvested = Math.max(rmd - need, 0)
    next[firstTaxable] += rmdReinvested
    let remaining = Math.max(need - rmd, 0)

    const hsaMedical = withdrawProportionally(next, hsa, Math.min(medicalCost, remaining))
    withdrawalsByBucket.hsa += hsaMedical
    remaining -= hsaMedical

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
      /** HSA money used for non-medical spending (taxable; 20% penalty before 65). */
      hsaNonMedical: withdrawalsByBucket.hsa - hsaMedical,
      shortfall: remaining,
    }
  }

  const birthYear = startYear - plan.currentAge
  // Tax brackets are in 2026 dollars; shift them if the projection starts in another year.
  const taxIndexAtStart = (1 + plan.assumptions.inflation) ** (startYear - CONFIG_2026.year)

  // Annuity bought during the projection: fixed nominal payment (or one indexed to inflation)
  let annuity: { payment: number; priceLevelAtPurchase: number; taxableShare: number } | null = null
  const purchase = plan.annuityPurchase
  const afterTax = [...indexesIn('cash'), ...indexesIn('taxable')]

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

    // Buy the annuity at the start of the purchase year (after recording the start balance)
    let annuityPremium = 0
    if (purchase.enabled && age === purchase.purchaseAge) {
      const sources = purchase.fundedFrom === 'pretax' ? pretax : afterTax
      annuityPremium = withdrawProportionally(balances, sources, purchase.amount * priceLevel)
      const payment = annuityPremium * payoutRate(purchase, plan.filingStatus)
      annuity = {
        payment,
        priceLevelAtPurchase: priceLevel,
        taxableShare: annuityTaxableShare(purchase.fundedFrom, age, plan.filingStatus, annuityPremium, payment),
      }
    }
    const annuityIncome = annuity
      ? annuity.payment * (purchase.inflationAdjusted ? priceLevel / annuity.priceLevelAtPurchase : 1)
      : 0

    const household = householdAt(plan, age)
    let spending = 0
    let healthcare = 0
    let ssIncome = 0
    let other = { amount: 0, taxable: 0, taxableRetirement: 0 }
    if (retired) {
      healthcare = healthcareCost(plan, age, household.people) * priceLevel * (1 + plan.healthcare.excessInflation) ** t
      const baseSpending = plan.annualSpending * (household.widowed ? plan.survivor.spendingShare : 1)
      spending = baseSpending * priceLevel + healthcare
      other = incomeAtAge(plan.incomeStreams, age, priceLevel, household.widowed)
      if (age >= plan.socialSecurityClaimAge) ssIncome = socialSecurityYearly(plan, household.widowed) * priceLevel
    }
    const income = other.amount + ssIncome + annuityIncome
    // Negative when income exceeds spending; the surplus (after tax) is reinvested below
    const gap = spending - income
    const rmdRequired = requiredMinimumDistribution(
      age,
      birthYear,
      pretax.reduce((sum, i) => sum + balances[i], 0),
    )

    // Withdrawals and tax depend on each other (pre-tax withdrawals are taxable, and the
    // tax is paid from savings), so repeat until the tax settles. Converges in a few
    // passes because the marginal rate is well below 100%.
    let tax = 0
    let federalTax = 0
    let stateTax = 0
    let taxableIncome = 0
    let draw = drawDown(balances, Math.max(gap, 0), rmdRequired, healthcare)
    if (retired) {
      const annuityTaxable = annuityIncome * (annuity?.taxableShare ?? 0)
      const taxPriceLevel = priceLevel * taxIndexAtStart
      for (let pass = 0; pass < 25; pass++) {
        const ordinaryIncome = draw.pretaxWithdrawn + draw.hsaNonMedical + other.taxable + annuityTaxable
        const result = federalIncomeTax({
          ordinaryIncome,
          socialSecurity: ssIncome,
          age,
          year: startYear + t,
          status: household.taxStatus,
          priceLevel: taxPriceLevel,
        })
        const penalty = age < CONFIG_2026.medicare.eligibilityAge ? HSA_PENALTY * draw.hsaNonMedical : 0
        const state = stateIncomeTax({
          state: plan.state,
          status: household.taxStatus,
          age,
          ordinaryIncome,
          retirementIncome: draw.pretaxWithdrawn + other.taxableRetirement + annuityTaxable,
          taxableSocialSecurity: taxableSocialSecurity(ordinaryIncome, ssIncome, household.taxStatus),
          retirementExclusionPerPerson: plan.stateRetirementExclusion,
          priceLevel: taxPriceLevel,
        })
        taxableIncome = result.taxableIncome
        federalTax = result.tax + penalty
        stateTax = state
        const settled = Math.abs(federalTax + stateTax - tax) < 0.5
        tax = federalTax + stateTax
        if (settled) break
        draw = drawDown(balances, Math.max(gap + tax, 0), rmdRequired, healthcare)
      }
    }
    balances.splice(0, balances.length, ...draw.balances)
    const surplus = Math.max(-(gap + tax), 0)
    balances[firstTaxable] += surplus
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
      otherIncome: other.amount,
      widowed: household.widowed,
      annuityIncome,
      annuityPremium,
      surplusReinvested: surplus,
      spending,
      healthcare,
      tax,
      federalTax,
      stateTax,
      taxableIncome,
    })
  }

  return { years, balanceAtRetirement, balanceAtRetirementReal, depletionAge, rmdStartAge: rmdStartAge(birthYear) }
}

/** Deterministic projection: the average return and inflation every year. */
export function projectPlan(
  plan: Plan,
  startYear = new Date().getFullYear(),
  adjust?: MarketAdjust,
): ProjectionResult {
  const { returnPreRetirement, returnPostRetirement, inflation } = plan.assumptions
  return simulatePath(
    plan,
    withAdjust((_, retired) => ({ return: retired ? returnPostRetirement : returnPreRetirement, inflation }), adjust),
    startYear,
  )
}
