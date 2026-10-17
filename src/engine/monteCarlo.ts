import { simulatePath } from './projection'
import { createRandom, normal } from './random'
import type { MonteCarloResult, Plan } from './types'

export interface MonteCarloOptions {
  runs?: number
  /** Fixed seed so results don't jump around while the user edits inputs. */
  seed?: number
  startYear?: number
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

/** Run the plan through many random market histories. */
export function runMonteCarlo(plan: Plan, options: MonteCarloOptions = {}): MonteCarloResult {
  const { runs = 1000, seed = 42, startYear = new Date().getFullYear() } = options
  const a = plan.assumptions
  const random = createRandom(seed)
  const yearCount = plan.lifeExpectancy - plan.currentAge + 1

  // balancesByYear[t] collects every run's real balance for year t
  const balancesByYear: number[][] = Array.from({ length: yearCount }, () => [])
  let successes = 0

  for (let run = 0; run < runs; run++) {
    const result = simulatePath(
      plan,
      (_, retired) =>
        retired
          ? lognormalReturn(a.returnPostRetirement, a.volatilityPostRetirement, normal(random))
          : lognormalReturn(a.returnPreRetirement, a.volatilityPreRetirement, normal(random)),
      startYear,
    )
    if (result.depletionAge === null) successes++
    result.years.forEach((y, t) => balancesByYear[t].push(y.balanceReal))
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
