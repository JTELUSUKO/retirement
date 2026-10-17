export type AccountType = '401k' | 'traditional-ira' | 'roth' | 'hsa' | 'taxable' | 'cash'

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
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  accounts: Account[]
  /** Yearly spending in retirement, in today's dollars. */
  annualSpending: number
  /** Monthly benefit at full retirement age (67), from your ssa.gov statement. */
  socialSecurityAtFRA: number
  socialSecurityClaimAge: number
  /** Yearly pension, in today's dollars. Starts at retirement. */
  annualPension: number
  assumptions: Assumptions
}

export interface YearResult {
  age: number
  year: number
  /** Balance at the start of the year, nominal dollars. */
  startBalance: number
  /** Balance at the start of the year, in today's dollars. */
  startBalanceReal: number
  /** End-of-year portfolio balance, nominal dollars. */
  balance: number
  /** End-of-year balance in today's dollars. */
  balanceReal: number
  contributions: number
  withdrawal: number
  income: number
  spending: number
}

export interface ProjectionResult {
  years: YearResult[]
  balanceAtRetirement: number
  balanceAtRetirementReal: number
  /** First age at which the portfolio cannot cover spending, or null if it lasts. */
  depletionAge: number | null
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
