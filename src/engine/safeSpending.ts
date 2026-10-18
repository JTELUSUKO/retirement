import { runMonteCarlo } from './monteCarlo'
import type { Plan } from './types'

const STEP = 500

/**
 * Highest yearly spending (today's dollars, excluding healthcare, rounded down to $500) with at least `target`
 * chance the money lasts. Bisection over the same seeded simulations, so success falls steadily as spending rises.
 * Async: yields between simulations so the page stays responsive.
 */
export async function findSafeSpending(plan: Plan, target: number, runs = 1000): Promise<number> {
  const ok = (spending: number) => runMonteCarlo({ ...plan, annualSpending: spending }, { runs }).successRate >= target
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0))

  let lo = 0
  let hi = Math.max(plan.annualSpending * 2, 40_000)
  while (ok(hi) && hi < 10_000_000) {
    lo = hi
    hi *= 2
    await pause()
  }
  while (hi - lo > STEP) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
    await pause()
  }
  return Math.floor(lo / STEP) * STEP
}

/** Same search without yielding (for Ask Claude's tool, which runs synchronously). Uses fewer runs to stay quick. */
export function findSafeSpendingSync(plan: Plan, target: number, runs = 500): number {
  const ok = (spending: number) => runMonteCarlo({ ...plan, annualSpending: spending }, { runs }).successRate >= target
  let lo = 0
  let hi = Math.max(plan.annualSpending * 2, 40_000)
  while (ok(hi) && hi < 10_000_000) {
    lo = hi
    hi *= 2
  }
  while (hi - lo > STEP) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return Math.floor(lo / STEP) * STEP
}
