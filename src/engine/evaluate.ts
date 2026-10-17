import { runMonteCarlo } from './monteCarlo'
import { projectPlan } from './projection'
import { stressAdjust, type StressTest } from './scenarios'
import type { MonteCarloResult, Plan, ProjectionResult } from './types'
import { validatePlan } from './validation'

/** Headline results for one plan (or scenario), as shown in comparisons and the summary. */
export interface PlanEvaluation {
  issues: string[]
  successRate: number
  /** Today's dollars */
  savingsAtRetirement: number
  depletionAge: number | null
  /** Savings left at the start of the final year, today's dollars */
  leftTypical: number
  leftPoor: number
  lifetimeTax: number
  lifetimeHealthcare: number
  /** Full results (null when the plan has issues) */
  projection: ProjectionResult | null
  monteCarlo: MonteCarloResult | null
}

/** Validate, then run the average-returns projection and the Monte Carlo, with an optional stress test. */
export function evaluatePlan(plan: Plan, stress: StressTest = 'none'): PlanEvaluation {
  const issues = validatePlan(plan).map((i) => i.message)
  if (issues.length > 0) {
    return {
      issues, successRate: 0, savingsAtRetirement: 0, depletionAge: null, leftTypical: 0, leftPoor: 0,
      lifetimeTax: 0, lifetimeHealthcare: 0, projection: null, monteCarlo: null,
    }
  }
  const adjust = stressAdjust(plan, stress)
  const projection = projectPlan(plan, undefined, adjust)
  const monteCarlo = runMonteCarlo(plan, { adjust })
  const last = monteCarlo.years.at(-1)!
  const real = (pick: (y: ProjectionResult['years'][number]) => number) =>
    projection.years.reduce((sum, y) => sum + pick(y) / y.priceLevel, 0)
  return {
    issues,
    successRate: monteCarlo.successRate,
    savingsAtRetirement: projection.balanceAtRetirementReal,
    depletionAge: projection.depletionAge,
    leftTypical: last.p50,
    leftPoor: last.p10,
    lifetimeTax: real((y) => y.tax),
    lifetimeHealthcare: real((y) => y.healthcare),
    projection,
    monteCarlo,
  }
}
