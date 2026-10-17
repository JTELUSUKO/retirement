import { BUCKET_OF, WITHDRAWAL_ORDER, emptyBuckets } from './accounts'
import { CONFIG_2026 } from './config/2026'
import { medianReturn } from './returns'
import { requiredMinimumDistribution, rmdStartAge } from './rmd'
import { householdAt, planEndAge, socialSecurityAt } from './survivor'
import { annuityTaxableShare, payoutRate } from './annuity'
import { healthcarePerPerson } from './healthcare'
import { incomeAtAge } from './income'
import { withAdjust, type MarketAdjust } from './scenarios'
import { stateIncomeTax } from './stateTax'
import { irmaaFirstThreshold, irmaaPerPersonYearly } from './irmaa'
import { bracketTop, federalIncomeTax, taxableSocialSecurity } from './taxes'
import type { FilingStatus, Plan, ProjectionResult, TaxBucket, YearResult } from './types'

/** Id of the hidden Roth account that receives conversions when the plan has none. */
export const CONVERTED_ROTH_ID = 'converted-roth'

/** Typical qualified-dividend yield of a stock-heavy brokerage account, taxed yearly in retirement. */
export const QUALIFIED_DIVIDEND_YIELD = 0.015

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
 *   Roth and cash withdrawals are untaxed. Selling taxable (brokerage) investments realizes capital gains above
 *   cost basis, and brokerage accounts pay qualified dividends each year; both are taxed at capital-gains
 *   rates (plus NIIT), and as ordinary income by states. Pre-tax withdrawals before 59½ owe a 10% penalty
 *   (401(k)s are exempt under the Rule of 55 if you retire at 55+). Taxes during working years are not modeled.
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
    accounts.push({ id: REINVESTED_RMD_ID, name: 'Reinvested RMDs', type: 'taxable', balance: 0, annualContribution: 0, employerMatch: 0, costBasis: 0 })
  }
  if (plan.rothConversion.enabled && !accounts.some((a) => a.type === 'roth')) {
    accounts.push({ id: CONVERTED_ROTH_ID, name: 'Converted Roth', type: 'roth', balance: 0, annualContribution: 0, employerMatch: 0, costBasis: null })
  }
  const balances = accounts.map((a) => a.balance)
  // Cost basis of taxable (brokerage) accounts; unused for other account types
  const basis = accounts.map((a) => (a.type === 'taxable' ? (a.costBasis ?? a.balance) : 0))
  const bucketOf = accounts.map((a) => BUCKET_OF[a.type])
  const indexesIn = (bucket: TaxBucket) => bucketOf.flatMap((b, i) => (b === bucket ? [i] : []))
  const pretax = indexesIn('pretax')
  const hsa = indexesIn('hsa')
  const firstTaxable = bucketOf.indexOf('taxable')
  const total = () => balances.reduce((sum, b) => sum + b, 0)

  const isTaxable = bucketOf.map((b) => b === 'taxable')
  const rothTarget = bucketOf.indexOf('roth')
  const { penalty: EARLY_PENALTY, ruleOf55Age } = CONFIG_2026.federalTax.earlyWithdrawal
  // Rule of 55: 401(k)s can be withdrawn without the 10% penalty if you leave work at 55 or later
  const penaltyFreeEarly = pretax.filter((i) => accounts[i].type === '401k' && plan.retirementAge >= ruleOf55Age)
  const penalizedEarly = pretax.filter((i) => !penaltyFreeEarly.includes(i))

  /**
   * Take `amount` proportionally from the accounts `idx` in (bal, bas), tracking capital gains realized from
   * taxable accounts (the part of each sale above its share of cost basis).
   */
  const take = (bal: number[], bas: number[], idx: number[], amount: number) => {
    const available = idx.reduce((sum, i) => sum + bal[i], 0)
    if (available <= 0 || amount <= 0) return { taken: 0, gains: 0 }
    const taken = Math.min(amount, available)
    let gains = 0
    for (const i of idx) {
      const part = taken * (bal[i] / available)
      if (isTaxable[i] && bal[i] > 0) {
        const basisShare = Math.min(bas[i] / bal[i], 1)
        gains += part * (1 - basisShare)
        bas[i] -= part * basisShare
      }
      bal[i] -= part
    }
    return { taken, gains }
  }

  // Withdrawal order as account groups; before 59½, penalty-free pre-tax money comes before penalized money
  type Group = { bucket: TaxBucket; idx: number[]; penalized?: boolean }
  const normalGroups: Group[] = WITHDRAWAL_ORDER.map((bucket) => ({ bucket, idx: indexesIn(bucket) }))
  const earlyGroups: Group[] = WITHDRAWAL_ORDER.flatMap((bucket): Group[] =>
    bucket === 'pretax'
      ? [
          { bucket, idx: penaltyFreeEarly },
          { bucket, idx: penalizedEarly, penalized: true },
        ]
      : [{ bucket, idx: indexesIn(bucket) }],
  )

  /**
   * Take the RMD, then `need` dollars from copies of the balances: the HSA pays up to `medicalCost` first
   * (tax-free), then accounts in withdrawal order. Before 59½, penalty-free money is used before pre-tax money
   * that would owe the 10% penalty. Pure: lets the tax loop try different amounts before committing.
   */
  const drawDown = (
    from: number[],
    fromBasis: number[],
    need: number,
    rmdRequired: number,
    medicalCost: number,
    age: number,
    convert = 0,
  ) => {
    const next = [...from]
    const nextBasis = [...fromBasis]
    const withdrawalsByBucket = emptyBuckets()
    const rmd = take(next, nextBasis, pretax, rmdRequired).taken
    withdrawalsByBucket.pretax += Math.min(rmd, need)
    const rmdReinvested = Math.max(rmd - need, 0)
    next[firstTaxable] += rmdReinvested
    nextBasis[firstTaxable] += rmdReinvested
    let remaining = Math.max(need - rmd, 0)
    let realizedGains = 0
    let penalized = 0

    const hsaMedical = take(next, nextBasis, hsa, Math.min(medicalCost, remaining)).taken
    withdrawalsByBucket.hsa += hsaMedical
    remaining -= hsaMedical

    // 59 is treated as after 59½ (withdrawals assumed in the second half of that year)
    for (const g of age < 59 ? earlyGroups : normalGroups) {
      if (remaining <= 0) break
      const { taken, gains } = take(next, nextBasis, g.idx, remaining)
      withdrawalsByBucket[g.bucket] += taken
      realizedGains += gains
      if (g.penalized) penalized += taken
      remaining -= taken
    }
    // Roth conversion: move pre-tax money (left after spending) into the first Roth account
    const pretaxLeft = pretax.reduce((sum, i) => sum + next[i], 0)
    const converted = convert > 0 && rothTarget >= 0 ? take(next, nextBasis, pretax, convert).taken : 0
    if (converted > 0) next[rothTarget] += converted
    const extraPretax = withdrawalsByBucket.pretax - Math.min(rmd, need)
    return {
      balances: next,
      basis: nextBasis,
      /** Pre-tax money moved to Roth (taxable, no penalty) */
      converted,
      /** Pre-tax balance available for conversion after this year's withdrawals */
      pretaxLeft,
      withdrawalsByBucket,
      rmd,
      rmdReinvested,
      /** All pre-tax money taken out this year (taxable as ordinary income). */
      pretaxWithdrawn: rmd + extraPretax,
      /** HSA money used for non-medical spending (taxable; 20% penalty before 65). */
      hsaNonMedical: withdrawalsByBucket.hsa - hsaMedical,
      /** Capital gains realized by selling taxable investments */
      realizedGains,
      /** Pre-tax withdrawals subject to the 10% early-withdrawal penalty */
      penalized,
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

  const endAge = planEndAge(plan)
  const years: YearResult[] = []
  // Filing status behind each year's MAGI (IRMAA uses the status of the return two years earlier)
  const magiStatus: FilingStatus[] = []
  // Roth conversion window (your ages); 0 = retirement age / the year before RMDs start
  const conv = plan.rothConversion
  const convFrom = conv.fromAge || plan.retirementAge
  const convTo = conv.toAge || rmdStartAge(startYear - plan.currentAge) - 1
  let depletionAge: number | null = null
  let balanceAtRetirement = total()
  let balanceAtRetirementReal = balanceAtRetirement
  // Price level relative to today: 1 now, 1.025 after one year of 2.5% inflation, ...
  let priceLevel = 1

  for (let age = plan.currentAge; age <= endAge; age++) {
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
    let purchaseGains = 0
    if (purchase.enabled && age === purchase.purchaseAge) {
      const sources = purchase.fundedFrom === 'pretax' ? pretax : afterTax
      const bought = take(balances, basis, sources, purchase.amount * priceLevel)
      annuityPremium = bought.taken
      purchaseGains = bought.gains
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
    let irmaa = 0
    let ssIncome = 0
    let other = { amount: 0, taxable: 0, taxableRetirement: 0 }
    if (retired) {
      const healthcareToday = household.livingAges.reduce((sum, a) => sum + healthcarePerPerson(plan, a), 0)
      const healthLevel = priceLevel * (1 + plan.healthcare.excessInflation) ** t
      // Medicare surcharges: each person 65+ pays by the household MAGI from two years earlier (retired years only)
      const lookback = years[t - 2]
      const onMedicare = household.livingAges.filter((a) => a >= CONFIG_2026.medicare.eligibilityAge).length
      if (lookback && lookback.magi > 0 && onMedicare > 0) {
        irmaa = irmaaPerPersonYearly(lookback.magi, magiStatus[t - 2], priceLevel * taxIndexAtStart) * onMedicare * healthLevel
      }
      healthcare = healthcareToday * healthLevel + irmaa
      const baseSpending = plan.annualSpending * (household.widowed ? plan.survivor.spendingShare : 1)
      spending = baseSpending * priceLevel + healthcare
      other = incomeAtAge(plan.incomeStreams, age, priceLevel, household.widowed)
      ssIncome = socialSecurityAt(plan, age) * priceLevel
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
    let capitalGains = 0
    let earlyWithdrawalPenalty = 0
    let magi = 0
    let conversion = 0
    // Qualified dividends from brokerage accounts (taxed in retirement; reinvested, so they add to basis)
    const dividends = balances.reduce((sum, b, i) => sum + (isTaxable[i] ? b * QUALIFIED_DIVIDEND_YIELD : 0), 0)
    let draw = drawDown(balances, basis, Math.max(gap, 0), rmdRequired, healthcare, age)
    if (retired) {
      const annuityTaxable = annuityIncome * (annuity?.taxableShare ?? 0)
      const taxPriceLevel = priceLevel * taxIndexAtStart
      const converting = conv.enabled && age >= convFrom && age <= convTo
      const seniors = household.livingAges.filter((a) => a >= 65).length
      const federalFor = (ordinaryIncome: number, gains: number) =>
        federalIncomeTax({
          ordinaryIncome,
          capitalGains: gains,
          socialSecurity: ssIncome,
          age,
          year: startYear + t,
          status: household.taxStatus,
          priceLevel: taxPriceLevel,
          seniors,
        })
      for (let pass = 0; pass < 25; pass++) {
        const baseOrdinary = draw.pretaxWithdrawn + draw.hsaNonMedical + other.taxable + annuityTaxable
        const ordinaryIncome = baseOrdinary + draw.converted
        capitalGains = draw.realizedGains + dividends + purchaseGains
        const result = federalFor(ordinaryIncome, capitalGains)
        earlyWithdrawalPenalty = EARLY_PENALTY * draw.penalized
        const hsaPenalty = age < CONFIG_2026.medicare.eligibilityAge ? HSA_PENALTY * draw.hsaNonMedical : 0
        const state = stateIncomeTax({
          state: plan.state,
          status: household.taxStatus,
          // State age rules (retirement-income exemptions): the oldest person alive
          age: Math.max(...household.livingAges),
          // States tax capital gains as ordinary income
          ordinaryIncome: ordinaryIncome + capitalGains,
          retirementIncome: draw.pretaxWithdrawn + draw.converted + other.taxableRetirement + annuityTaxable,
          taxableSocialSecurity: taxableSocialSecurity(ordinaryIncome + capitalGains, ssIncome, household.taxStatus),
          retirementExclusionPerPerson: plan.stateRetirementExclusion,
          priceLevel: taxPriceLevel,
        })
        taxableIncome = result.taxableIncome
        magi = result.agi
        federalTax = result.tax + hsaPenalty + earlyWithdrawalPenalty
        stateTax = state

        // Conversion that fills the chosen bracket (and stays under IRMAA if asked), given this pass's withdrawals
        let nextConversion = 0
        if (converting) {
          const available = draw.pretaxLeft
          const target = bracketTop(conv.fillToRate, household.taxStatus, taxPriceLevel)
          nextConversion = solveIncreasing((c) => federalFor(baseOrdinary + c, capitalGains).taxableOrdinary, target, available)
          // Income at 63+ sets Medicare premiums two years later
          if (conv.stayUnderIrmaa && Math.max(...household.livingAges) >= 63) {
            const cap = irmaaFirstThreshold(household.taxStatus, taxPriceLevel) * 0.99
            nextConversion = Math.min(nextConversion, solveIncreasing((c) => federalFor(baseOrdinary + c, capitalGains).agi, cap, available))
          }
        }

        const settled = Math.abs(federalTax + stateTax - tax) < 0.5 && Math.abs(nextConversion - conversion) < 1
        tax = federalTax + stateTax
        conversion = nextConversion
        if (settled) break
        draw = drawDown(balances, basis, Math.max(gap + tax, 0), rmdRequired, healthcare, age, conversion)
      }
    }
    magiStatus[t] = household.taxStatus
    balances.splice(0, balances.length, ...draw.balances)
    basis.splice(0, basis.length, ...draw.basis)
    const surplus = Math.max(-(gap + tax), 0)
    balances[firstTaxable] += surplus
    basis[firstTaxable] += surplus
    // Reinvested dividends raise the basis of each brokerage account
    balances.forEach((b, i) => {
      if (isTaxable[i]) basis[i] += b * QUALIFIED_DIVIDEND_YIELD
    })
    if (draw.shortfall > 0.005 && depletionAge === null) depletionAge = age

    // Growth, then year-end contributions while working (HSA contributions stop at Medicare age)
    let contributions = 0
    accounts.forEach((acc, i) => {
      balances[i] *= 1 + (bucketOf[i] === 'cash' ? market.inflation : market.return)
      const hsaClosed = bucketOf[i] === 'hsa' && age >= CONFIG_2026.medicare.eligibilityAge
      if (!retired && !hsaClosed) {
        const added = (acc.annualContribution + acc.employerMatch) * priceLevel
        balances[i] += added
        if (isTaxable[i]) basis[i] += added
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
      spouseAge: household.spouseAge,
      annuityIncome,
      annuityPremium,
      surplusReinvested: surplus,
      spending,
      healthcare,
      tax,
      federalTax,
      capitalGains: retired ? capitalGains : 0,
      earlyWithdrawalPenalty,
      rothConversion: draw.converted,
      irmaa,
      magi: retired ? magi : 0,
      stateTax,
      taxableIncome,
    })
  }

  return { years, balanceAtRetirement, balanceAtRetirementReal, depletionAge, rmdStartAge: rmdStartAge(birthYear) }
}

/** Deterministic projection: the typical (median) return and average inflation every year. */
export function projectPlan(
  plan: Plan,
  startYear = new Date().getFullYear(),
  adjust?: MarketAdjust,
): ProjectionResult {
  const a = plan.assumptions
  // Typical (median) returns, so this path matches the middle of the Monte Carlo rather than beating it
  const pre = medianReturn(a.returnPreRetirement, a.volatilityPreRetirement)
  const post = medianReturn(a.returnPostRetirement, a.volatilityPostRetirement)
  return simulatePath(
    plan,
    withAdjust((_, retired) => ({ return: retired ? post : pre, inflation: a.inflation }), adjust),
    startYear,
  )
}

/**
 * Largest x in [0, max] with f(x) ≤ target, for f increasing (taxable income as a function of a conversion).
 * Newton steps on the local slope, which is 1 to ~1.85 (more Social Security becomes taxable).
 */
function solveIncreasing(f: (x: number) => number, target: number, max: number): number {
  if (max <= 0 || f(0) >= target) return 0
  if (f(max) <= target) return max
  let x = Math.min(target - f(0), max)
  for (let i = 0; i < 6; i++) {
    const fx = f(x)
    if (Math.abs(fx - target) < 1) break
    const slope = Math.max((f(x + 100) - fx) / 100, 1)
    x = Math.min(Math.max(x - (fx - target) / slope, 0), max)
  }
  // Never overshoot the target
  while (x > 0 && f(x) > target + 1) x = Math.max(x - (f(x) - target), 0)
  return x
}
