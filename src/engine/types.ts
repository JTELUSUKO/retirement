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
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  accounts: Account[]
  /** Yearly spending in retirement excluding healthcare, in today's dollars. */
  annualSpending: number
  /** Monthly benefit at full retirement age (67), from your ssa.gov statement (combined for couples). */
  socialSecurityAtFRA: number
  socialSecurityClaimAge: number
  /** Yearly pension, in today's dollars. Starts at retirement. */
  annualPension: number
  healthcare: HealthcareCosts
  assumptions: Assumptions
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
  income: number
  /** Total spending need for the year, including healthcare. */
  spending: number
  /** Healthcare costs for the year (included in spending). */
  healthcare: number
  /** Federal income tax (plus any HSA penalty) for the year, retired years only, paid from savings. */
  tax: number
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
