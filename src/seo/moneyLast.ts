import {
  createRandom,
  INFLATION_PERSISTENCE,
  INFLATION_SHOCK,
  lognormalReturn,
  medianReturn,
  mixReturns,
  normal,
} from '../engine'

/** Longest stretch followed; money that lasts this long is treated as lasting indefinitely. */
export const MAX_YEARS = 100
/** The year-by-year table stops at this age */
const OLDEST_AGE = 110
export const RUNS = 1000
const SEED = 20260101

export interface MoneyLastInputs {
  savings: number
  /** Yearly spending from savings, in today's dollars (it rises with inflation) */
  spending: number
  age: number
  planToAge: number
  /** Share of savings in stocks (0–1); the rest in bonds */
  stockShare: number
  /** Average yearly inflation */
  inflation: number
}

export interface MoneyLastYear {
  age: number
  /** Start-of-year balance, today's dollars */
  start: number
  withdrawal: number
  /** End-of-year balance, today's dollars */
  end: number
}

export interface MoneyLastResult {
  /** Years of planned spending */
  horizon: number
  withdrawalRate: number
  /** Assumed average return and volatility of the mix */
  mean: number
  volatility: number
  /** With typical (median) returns and steady inflation */
  typical: { years: number; runOutAge: number | null; schedule: MoneyLastYear[] }
  /** Across 1,000 simulated markets with changing inflation */
  simulated: { chanceLasts: number; medianYears: number; poorYears: number }
  /** Spending that lasts to planToAge with typical returns, and in 9 of 10 simulated markets */
  spendingThatLasts: { typical: number; ninetyPercent: number }
}

/**
 * Years the money lasts when `spending` (today's dollars) comes out at the start of each year and the rest earns
 * `realReturn(year)` after inflation. Fractional: the last year counts as the share of spending still covered.
 */
export function yearsLasting(savings: number, spending: number, realReturn: (year: number) => number, cap = MAX_YEARS): number {
  if (spending <= 0) return Infinity
  let balance = savings
  for (let year = 0; year < cap; year++) {
    if (balance < spending) return year + balance / spending
    balance = (balance - spending) * (1 + realReturn(year))
  }
  return Infinity
}

let cached: { key: string; markets: number[][] } | null = null

/**
 * Real returns for each simulated market, with the same model as the planner's Monte Carlo. Fixed seed, so results
 * don't jump while you type; kept for the last mix and inflation, since only the amounts change as you type.
 */
export function simulatedMarkets(mean: number, volatility: number, inflation: number, years: number): number[][] {
  const key = `${mean}:${volatility}:${inflation}:${years}`
  if (cached?.key === key) return cached.markets
  const random = createRandom(SEED)
  const markets = Array.from({ length: RUNS }, () => {
    let yearInflation = inflation
    return Array.from({ length: years }, () => {
      const nominal = lognormalReturn(mean, volatility, normal(random))
      yearInflation = inflation + INFLATION_PERSISTENCE * (yearInflation - inflation) + INFLATION_SHOCK * normal(random)
      return (1 + nominal) / (1 + yearInflation) - 1
    })
  })
  cached = { key, markets }
  return markets
}

/** Value at share `p` (0–1) of an ascending list */
export const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]

/** Largest spending (to the dollar) for which `lasts` holds, by bisection. */
function largestSpending(savings: number, lasts: (spending: number) => boolean): number {
  let lo = 0
  let hi = savings
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (lasts(mid)) lo = mid
    else hi = mid
  }
  return Math.floor(lo)
}

export function moneyLast(inputs: MoneyLastInputs): MoneyLastResult {
  const horizon = Math.max(inputs.planToAge - inputs.age, 1)
  const { mean, volatility } = mixReturns(inputs.stockShare)
  const typicalReal = (1 + medianReturn(mean, volatility)) / (1 + inputs.inflation) - 1

  // Typical path, year by year in today's dollars
  const years = yearsLasting(inputs.savings, inputs.spending, () => typicalReal)
  const schedule: MoneyLastYear[] = []
  let balance = inputs.savings
  const rows = Math.min(Number.isFinite(years) ? Math.ceil(years) : horizon, MAX_YEARS, OLDEST_AGE - inputs.age + 1)
  for (let t = 0; t < rows; t++) {
    const withdrawal = Math.min(inputs.spending, balance)
    const end = (balance - withdrawal) * (1 + typicalReal)
    schedule.push({ age: inputs.age + t, start: balance, withdrawal, end })
    balance = end
  }

  const markets = simulatedMarkets(mean, volatility, inputs.inflation, MAX_YEARS)
  const lastsIn = (spending: number, market: number[], cap = MAX_YEARS) => yearsLasting(inputs.savings, spending, (t) => market[t], cap)
  const simulatedYears = markets.map((m) => lastsIn(inputs.spending, m)).sort((a, b) => a - b)
  const chanceLasts = simulatedYears.filter((y) => y >= horizon).length / RUNS

  // Spending that lasts the horizon: with typical returns, and in at least 90% of the simulated markets
  const typicalSpending = largestSpending(inputs.savings, (s) => yearsLasting(inputs.savings, s, () => typicalReal, horizon) >= horizon)
  const ninetyPercent = largestSpending(
    inputs.savings,
    (s) => markets.filter((m) => lastsIn(s, m, horizon) >= horizon).length >= 0.9 * RUNS,
  )

  return {
    horizon,
    withdrawalRate: inputs.savings > 0 ? inputs.spending / inputs.savings : 0,
    mean,
    volatility,
    typical: { years, runOutAge: Number.isFinite(years) ? inputs.age + years : null, schedule },
    simulated: { chanceLasts, medianYears: percentile(simulatedYears, 0.5), poorYears: percentile(simulatedYears, 0.1) },
    spendingThatLasts: { typical: typicalSpending, ninetyPercent },
  }
}

/** The calculator page starts with these values (the browser tests check results for them too). */
export const MONEY_LAST_DEFAULTS: MoneyLastInputs = {
  savings: 1_000_000,
  spending: 50_000,
  age: 65,
  planToAge: 95,
  stockShare: 0.6,
  inflation: 0.025,
}
