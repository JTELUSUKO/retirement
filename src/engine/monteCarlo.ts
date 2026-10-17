import { simulatePath } from './projection'
import { createRandom, normal } from './random'
import { planEndAge } from './survivor'
import { withAdjust, type MarketAdjust } from './scenarios'
import type { MonteCarloResult, Plan } from './types'

/**
 * Inflation model: AR(1) around the user's average inflation.
 * Persistence 0.6 and yearly shock 1.2% give a long-run spread of about 1.5%,
 * so high-inflation years tend to cluster, as they did in the 1970s.
 */
export const INFLATION_PERSISTENCE = 0.6
export const INFLATION_SHOCK = 0.012

export interface MonteCarloOptions {
  runs?: number
  /** Fixed seed so results don't jump around while the user edits inputs. */
  seed?: number
  startYear?: number
  /** Set false to hold inflation at its average (isolates market risk). */
  randomInflation?: boolean
  /** Adjust each year's drawn market conditions (stress tests). */
  adjust?: MarketAdjust
}

/**
 * Draw a yearly return from a lognormal distribution with the given arithmetic
 * mean and standard deviation. Lognormal keeps returns above -100%.
 */
function lognormalReturn(mean: number, volatility: number, z: number): number {
  const sigma2 = Math.log(1 + volatility ** 2 / (1 + mean) ** 2)
  const mu = Math.log(1 + mean) - sigma2 / 2
  return Math.exp(mu + Math.sqrt(sigma2) * z) - 1
}

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** Run the plan through many random market and inflation histories. */
export function runMonteCarlo(plan: Plan, options: MonteCarloOptions = {}): MonteCarloResult {
  const { runs = 1000, seed = 42, startYear = new Date().getFullYear(), randomInflation = true, adjust } = options
  const a = plan.assumptions
  const random = createRandom(seed)
  const yearCount = Math.max(planEndAge(plan) - plan.currentAge + 1, 0)

  // balancesByYear[t] collects every run's start-of-year real balance for year t
  const balancesByYear: number[][] = Array.from({ length: yearCount }, () => [])
  let successes = 0

  for (let run = 0; run < runs; run++) {
    let inflation = a.inflation
    const result = simulatePath(
      plan,
      withAdjust((_, retired) => {
        const z = normal(random)
        const ret = retired
          ? lognormalReturn(a.returnPostRetirement, a.volatilityPostRetirement, z)
          : lognormalReturn(a.returnPreRetirement, a.volatilityPreRetirement, z)
        if (randomInflation) {
          inflation = a.inflation + INFLATION_PERSISTENCE * (inflation - a.inflation) + INFLATION_SHOCK * normal(random)
        }
        return { return: ret, inflation }
      }, adjust),
      startYear,
    )
    if (result.depletionAge === null) successes++
    result.years.forEach((y, t) => balancesByYear[t].push(y.startBalanceReal))
  }

  return {
    runs,
    successRate: runs > 0 ? successes / runs : 0,
    years: balancesByYear.map((balances, t) => {
      const sorted = balances.sort((x, y) => x - y)
      return {
        age: plan.currentAge + t,
        p10: percentile(sorted, 0.1),
        p25: percentile(sorted, 0.25),
        p50: percentile(sorted, 0.5),
        p75: percentile(sorted, 0.75),
        p90: percentile(sorted, 0.9),
      }
    }),
  }
}
