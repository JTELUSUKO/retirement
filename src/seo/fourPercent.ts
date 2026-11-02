import { mixReturns } from '../engine'
import { MAX_YEARS, RUNS, simulatedMarkets, yearsLasting } from './moneyLast'

/** Rows and columns of the success table */
export const GRID_RATES = [0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06]
export const GRID_YEARS = [20, 25, 30, 35, 40]
// The same markets as the "how long will my money last" page, so the two pages agree
const MARKET_YEARS = MAX_YEARS

export interface FourPercentInputs {
  savings: number
  /** First-year withdrawal as a share of savings; later years rise with inflation */
  rate: number
  /** Years the money needs to last */
  years: number
  /** Share of savings in stocks (0–1); the rest in bonds */
  stockShare: number
  /** Average yearly inflation */
  inflation: number
}

export interface FourPercentResult {
  /** First-year withdrawal (today's dollars; it rises with inflation after) */
  firstYear: number
  /** Share of the 1,000 simulated markets in which it lasts `years` */
  chanceLasts: number
  /** Highest rate that lasts `years` in 9 of 10 simulated markets */
  rateFor90: number
  mean: number
  volatility: number
}

const markets = (stockShare: number, inflation: number) => {
  const { mean, volatility } = mixReturns(stockShare)
  return simulatedMarkets(mean, volatility, inflation, MARKET_YEARS)
}

/** Share of simulated markets in which withdrawing `rate` of the starting savings (rising with inflation) lasts `years`. */
function chance(all: number[][], rate: number, years: number): number {
  return all.filter((m) => yearsLasting(1, rate, (t) => m[t], years) >= years).length / RUNS
}

export function fourPercent(inputs: FourPercentInputs): FourPercentResult {
  const { mean, volatility } = mixReturns(inputs.stockShare)
  const all = markets(inputs.stockShare, inputs.inflation)
  let lo = 0
  let hi = 0.2
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (chance(all, mid, inputs.years) >= 0.9) lo = mid
    else hi = mid
  }
  return {
    firstYear: inputs.savings * inputs.rate,
    chanceLasts: chance(all, inputs.rate, inputs.years),
    rateFor90: lo,
    mean,
    volatility,
  }
}

/** Chance each withdrawal rate (rows, GRID_RATES) lasts each length of retirement (columns, GRID_YEARS). */
export function successGrid(stockShare: number, inflation: number): number[][] {
  const all = markets(stockShare, inflation)
  return GRID_RATES.map((rate) => GRID_YEARS.map((years) => chance(all, rate, years)))
}

/** Savings needed to fund `spending` a year at `rate` (the 4% rule's "25 times spending"). */
export const savingsNeeded = (spending: number, rate: number) => (rate > 0 ? spending / rate : 0)

/** The calculator page starts with these values (the browser tests check results for them too). */
export const FOUR_PERCENT_DEFAULTS: FourPercentInputs = {
  savings: 1_000_000,
  rate: 0.04,
  years: 30,
  stockShare: 0.6,
  inflation: 0.025,
}
