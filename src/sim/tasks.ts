import {
  evaluatePlan,
  findSafeSpendingSync,
  runMonteCarlo,
  type MonteCarloOptions,
  type MonteCarloResult,
  type Plan,
  type PlanEvaluation,
  type StressTest,
} from '../engine'

/** Work that runs in a simulation worker. Plain data in and out (structured-clone safe). */
export type SimTask =
  | { kind: 'monteCarlo'; plan: Plan; options?: Omit<MonteCarloOptions, 'adjust'> }
  | { kind: 'evaluate'; plan: Plan; stress: StressTest }
  | { kind: 'safeSpending'; plan: Plan; target: number }

export type SimResult<T extends SimTask> = T extends { kind: 'monteCarlo' }
  ? MonteCarloResult
  : T extends { kind: 'evaluate' }
    ? PlanEvaluation
    : number

/** Run a task (inside a worker, or directly when workers aren't available). */
export function runTask(task: SimTask): MonteCarloResult | PlanEvaluation | number {
  switch (task.kind) {
    case 'monteCarlo':
      return runMonteCarlo(task.plan, task.options)
    case 'evaluate':
      return evaluatePlan(task.plan, task.stress)
    case 'safeSpending':
      return findSafeSpendingSync(task.plan, task.target, 1000)
  }
}
