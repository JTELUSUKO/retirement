import type { Scenario } from './scenarios'

export type AccountType = '401k' | 'traditional-ira' | 'roth' | 'hsa' | 'taxable' | 'cash'

/** How an account is taxed; decides withdrawal order and RMDs. */
export type TaxBucket = 'pretax' | 'roth' | 'taxable' | 'cash' | 'hsa'

export type BucketAmounts = Record<TaxBucket, number>

/** "married" = married filing jointly; the spouse is assumed to be the same age. */
export type FilingStatus = 'single' | 'married'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  /** Your yearly contribution, in today's dollars. */
  annualContribution: number
  /** Employer match per year, in today's dollars. */
  employerMatch: number
  /**
   * Taxable accounts: what you paid for the investments. Roth accounts: what you've contributed, which comes out
   * tax-free at any age. null = same as balance (no gains yet).
   */
  costBasis: number | null
}

export interface Assumptions {
  /** Nominal annual return before retirement, e.g. 0.07 */
  returnPreRetirement: number
  /** Nominal annual return after retirement, e.g. 0.05 */
  returnPostRetirement: number
  /** Standard deviation of yearly returns before retirement, e.g. 0.15 */
  volatilityPreRetirement: number
  /** Standard deviation of yearly returns after retirement, e.g. 0.10 */
  volatilityPostRetirement: number
  inflation: number
  /** Yearly investment fees (advisory + fund expenses), e.g. 0.005; charged on invested accounts, not cash */
  annualFee: number
}

export interface Plan {
  filingStatus: FilingStatus
  /** Two-letter state code for state income tax ('' = not chosen yet: no state tax) */
  state: string
  /** Retirement income exempt from state tax, per person per year, today's dollars (partial state exclusions) */
  stateRetirementExclusion: number
  currentAge: number
  retirementAge: number
  /** Plan to this age (couples: the age the younger spouse reaches). */
  lifeExpectancy: number
  accounts: Account[]
  /** Yearly spending in retirement excluding healthcare, in today's dollars. */
  annualSpending: number
  /** Your monthly benefit at full retirement age (67), from your ssa.gov statement. */
  socialSecurityAtFRA: number
  /** Spouse's monthly benefit at 67 (married filing jointly only). */
  spouseSocialSecurityAtFRA: number
  /** Spouse's age today (married only; 0 = not entered). The timeline runs on your age. */
  spouseCurrentAge: number
  /** Age the spouse claims Social Security (their own age). */
  spouseClaimAge: number
  /** Married couples: what happens if one spouse dies first. */
  survivor: SurvivorSettings
  /** Optional Roth conversions in low-income years ("fill the bracket"). */
  rothConversion: RothConversionSettings
  /** Optional long-term care need (a cost shock). */
  longTermCare: LongTermCareSettings
  /** Big one-off or multi-year costs paid from savings: college, a wedding, a car, a home down payment… */
  bigExpenses: BigExpense[]
  /** Fixed spending, or guardrails that cut/raise spending after bad/good markets. */
  spendingRule: SpendingRule
  socialSecurityClaimAge: number
  /**
   * Yearly pay while working, today's dollars (0 = not entered). Only used for Social Security that starts before
   * you retire: the earnings limit and the tax on those benefits. Without it, benefits before full retirement age are
   * assumed to be withheld in full.
   */
  annualPay: number
  /** Spouse's yearly pay while working (married only), used the same way. */
  spouseAnnualPay: number
  /** Pensions, annuities, part-time work, rental income, ... */
  incomeStreams: IncomeStream[]
  /** Optional: turn part of your savings into lifetime income. */
  annuityPurchase: AnnuityPurchase
  /** What-if variations compared against this plan (see scenarios.ts). */
  scenarios: Scenario[]
  healthcare: HealthcareCosts
  assumptions: Assumptions
}

export type BigExpenseKind = 'college' | 'wedding' | 'other'
export type CollegeType = 'publicInState' | 'publicOutOfState' | 'privateNonprofit'

export interface BigExpense {
  id: string
  name: string
  kind: BigExpenseKind
  /** Cost per year, in today's dollars */
  annualAmount: number
  /** Years it's paid (1 = a one-time cost) */
  years: number
  /** A child's expense starts at a child's age: their age today (null = timed by your age, `startAge`) */
  childAgeNow: number | null
  /** The child's age when it starts (with childAgeNow) */
  atChildAge: number
  /** Your age when it starts (when childAgeNow is null) */
  startAge: number
  /** Yearly cost growth above inflation (college has historically risen faster than prices) */
  excessInflation: number
  /** College: the cost preset picked, or null for your own amount (annualAmount). A preset always uses the current
   *  yearly figure (expenseAmount), so it follows the yearly update */
  collegeType: CollegeType | null
  /** College: 529 balance today, used first for this expense (tax-free) */
  saved529: number
  /** College: yearly 529 contributions until it starts, today's dollars (from your pay, like other contributions) */
  yearly529: number
}

export type IncomeKind = 'pension' | 'annuity' | 'work' | 'rental' | 'other'

/** A source of retirement income other than Social Security. Counted in retired years only. */
export interface IncomeStream {
  id: string
  name: string
  kind: IncomeKind
  /**
   * Yearly amount. If `inflationAdjusted`, in today's dollars and rising with inflation;
   * otherwise the fixed dollar amount actually paid each year (like most annuities).
   */
  annualAmount: number
  startAge: number
  /** Last age it is paid; null = for life. */
  endAge: number | null
  inflationAdjusted: boolean
  /** Share taxed as ordinary income, 0–1 (e.g. 1 for a pension or an annuity bought in an IRA). */
  taxableShare: number
  /** Married: share that continues after the first death, 0–1 (e.g. 0.5 for a 50% survivor pension). */
  survivorShare: number
}

/** Buying an immediate annuity with savings: payments start in the purchase year, for life. */
export interface AnnuityPurchase {
  enabled: boolean
  /** Premium in today's dollars (scaled to the purchase year with inflation). */
  amount: number
  purchaseAge: number
  /** Yearly payment ÷ premium from a real quote, e.g. 0.07; null = use the estimate. */
  payoutRate: number | null
  /** Payments rise with inflation (starts lower). Otherwise a fixed dollar amount. */
  inflationAdjusted: boolean
  /** "pretax" = IRA rollover (payments fully taxable); "aftertax" = taxable or cash money. */
  fundedFrom: 'pretax' | 'aftertax'
}

/**
 * One spouse (`whoDies`) dies at `firstDeathAge` (their own age). From then on the survivor receives the larger of
 * their own benefit and an SSA-style survivor benefit, spends `spendingShare` of the couple's spending, pays
 * healthcare for one, and receives each income stream at its `survivorShare`. From the next year they file single.
 */
export interface SurvivorSettings {
  enabled: boolean
  /** Which spouse dies first */
  whoDies: 'you' | 'spouse'
  /** Age of that spouse when they die */
  firstDeathAge: number
  /** Survivor's spending as a share of the couple's (excluding healthcare), e.g. 0.75 */
  spendingShare: number
}

/**
 * Each year from `fromAge` to `toAge` (your ages; 0 = retirement age / the year before RMDs start), move pre-tax
 * money to Roth until taxable ordinary income reaches the top of the `fillToRate` federal bracket. Optionally keep
 * income under the first Medicare surcharge (IRMAA) threshold in years that set Medicare premiums.
 */
export interface RothConversionSettings {
  enabled: boolean
  /** Federal bracket rate to fill, e.g. 0.12 or 0.22 */
  fillToRate: number
  fromAge: number
  toAge: number
  stayUnderIrmaa: boolean
}

/**
 * Guardrails (simplified Guyton–Klinger): the starting withdrawal rate (spending not covered by income ÷ savings)
 * is set in the first retired year in which Social Security is flowing. Later, if the rate is more than `band`
 * above it, spending (excluding healthcare) is cut by `adjustment`, never below `floor` of the plan and not in the
 * plan's last 15 years; if more than `band` below, earlier cuts are restored by `adjustment` (never above the plan).
 */
export interface SpendingRule {
  type: 'fixed' | 'guardrails'
  band: number
  adjustment: number
  floor: number
}

/** A period of long-term care for one person, paid like healthcare (HSA first), rising with healthcare costs. */
export interface LongTermCareSettings {
  enabled: boolean
  /** Couples: who needs care */
  who: 'you' | 'spouse'
  /** That person's age when care starts */
  startAge: number
  years: number
  /** Yearly cost in today's dollars */
  annualCost: number
}

/** Healthcare costs in retirement, per person per year in today's dollars. */
export interface HealthcareCosts {
  /** Premiums + out-of-pocket before Medicare (only if you retire before 65). */
  preMedicareAnnual: number
  /** Medicare Part B + Part D + supplement + out-of-pocket, from 65. */
  medicareAnnual: number
  /** How much faster medical costs rise than general inflation, e.g. 0.02 */
  excessInflation: number
}

export interface YearResult {
  age: number
  year: number
  /** Price level at the start of the year (1 = today). Divide by it for today's dollars. */
  priceLevel: number
  /** Balance at the start of the year, nominal dollars. */
  startBalance: number
  /** Balance at the start of the year, in today's dollars. */
  startBalanceReal: number
  /** End-of-year portfolio balance, nominal dollars. */
  balance: number
  /** End-of-year balance in today's dollars. */
  balanceReal: number
  contributions: number
  /** Total taken from savings this year (RMD used for spending + other withdrawals). */
  withdrawal: number
  /** Required minimum distribution taken from pre-tax accounts this year. */
  rmd: number
  /** Part of the RMD not needed for spending, reinvested in a taxable account. */
  rmdReinvested: number
  withdrawalsByBucket: BucketAmounts
  /** Start-of-year balances by tax bucket, in today's dollars. */
  startByBucketReal: BucketAmounts
  /** Social Security + other income received this year (Social Security after anything the earnings limit withholds). */
  income: number
  /** Other income (pensions, annuities, work, rental) received this year. */
  otherIncome: number
  /** One spouse has died (survivor modeling) */
  widowed: boolean
  /** Spouse's age this year (couples), else null */
  spouseAge: number | null
  /** Payments from a purchased annuity this year (included in income). */
  annuityIncome: number
  /** Savings used to buy the annuity this year (not spending; leaves the portfolio). */
  annuityPremium: number
  /** Income left over after spending and tax, reinvested in a taxable account. */
  surplusReinvested: number
  /** Total spending need for the year, including healthcare. */
  spending: number
  /** Healthcare costs for the year (included in spending). */
  healthcare: number
  /**
   * All income tax for the year (federal + penalties + state), paid from savings. Working years only count the tax
   * on withdrawals for big expenses and on Social Security received (tax on pay isn't modeled).
   */
  tax: number
  /** Federal income tax, capital gains tax, NIIT, plus any early-withdrawal / HSA penalties */
  federalTax: number
  /** Capital gains realized plus qualified dividends this year (nominal) */
  capitalGains: number
  /** 10% early-withdrawal penalty (pre-tax withdrawals and Roth earnings before 59½), included in federalTax */
  earlyWithdrawalPenalty: number
  /** Pre-tax money converted to Roth this year (nominal; taxable as ordinary income) */
  rothConversion: number
  /** Medicare income surcharges this year (nominal; included in healthcare) */
  irmaa: number
  /** Long-term care costs this year (nominal; included in healthcare) */
  longTermCare: number
  /** Big expenses this year (nominal): their full cost, and the part paid from 529s; the rest is in spending */
  bigExpenses: number
  bigExpensesFrom529: number
  /** Spending as a share of the plan this year (1 unless guardrails adjusted it) */
  spendingFactor: number
  /** Modified AGI this year (nominal), used for IRMAA two years later. Working years: 0 (see projection.ts). */
  magi: number
  stateTax: number
  /** Taxable income after deductions. */
  taxableIncome: number
  /** Federal bracket of the last dollar of ordinary income (0 when none is taxable), retired years only */
  federalBracket: number
}

export interface ProjectionResult {
  years: YearResult[]
  balanceAtRetirement: number
  balanceAtRetirementReal: number
  /** First age at which the portfolio cannot cover spending, or null if it lasts. */
  depletionAge: number | null
  /** Age RMDs start, based on birth year (start year − current age). */
  rmdStartAge: number
}

export interface PercentileYear {
  age: number
  /** Start-of-year balances in today's dollars at each percentile. */
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface MonteCarloResult {
  runs: number
  /** Share of runs where the money lasted to the planning age (0–1). */
  successRate: number
  years: PercentileYear[]
  /** With guardrails: how often and how far spending was cut */
  guardrails?: {
    /** Share of runs with at least one cut */
    cutChance: number
    /** Lowest spending (share of plan) in poor markets (10th percentile of each run's lowest) */
    lowestP10: number
    /** Typical lowest spending (median of each run's lowest) */
    lowestMedian: number
  }
}

export interface PlanIssue {
  field: keyof Plan | 'accounts'
  message: string
}
