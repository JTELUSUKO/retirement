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
  socialSecurityClaimAge: number
  /** Pensions, annuities, part-time work, rental income, ... */
  incomeStreams: IncomeStream[]
  /** Optional: turn part of your savings into lifetime income. */
  annuityPurchase: AnnuityPurchase
  /** What-if variations compared against this plan (see scenarios.ts). */
  scenarios: Scenario[]
  healthcare: HealthcareCosts
  assumptions: Assumptions
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
  /** Social Security + other income received this year. */
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
  /** All income tax for the year (federal + HSA penalty + state), retired years only, paid from savings. */
  tax: number
  /** Federal income tax plus any HSA penalty */
  federalTax: number
  stateTax: number
  /** Taxable income after deductions. */
  taxableIncome: number
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
}

export interface PlanIssue {
  field: keyof Plan | 'accounts'
  message: string
}
