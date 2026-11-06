import { describe, expect, it } from 'vitest'
import { evaluatePlan, findSafeSpendingSync, runMonteCarlo } from '../engine'
import { examplePlan } from '../store/planStore'
import { runSimulation } from './pool'
import { runTask } from './tasks'
import { settleJob } from './useSimulation'

describe('simulation tasks', () => {
  it('run the same engine functions the pages used to call directly', () => {
    expect(runTask({ kind: 'monteCarlo', plan: examplePlan })).toEqual(runMonteCarlo(examplePlan))
    expect(runTask({ kind: 'evaluate', plan: examplePlan, stress: 'crash' })).toEqual(evaluatePlan(examplePlan, 'crash'))
  })

  it('return plain data that survives structured cloning (worker messages)', () => {
    const result = runTask({ kind: 'evaluate', plan: examplePlan, stress: 'none' })
    expect(structuredClone(result)).toEqual(result)
  })

  it('safe spending uses the full 1,000-run search', () => {
    const plan = { ...examplePlan, annualSpending: 40_000 }
    expect(runTask({ kind: 'safeSpending', plan, target: 0.9 })).toBe(findSafeSpendingSync(plan, 0.9, 1000))
  })
})

describe('a background batch', () => {
  const start = { values: { old: 1 }, done: 7, error: 'stale', forJobs: 'earlier' }

  it('a failure counts as finished and keeps its message, even as the first job of a new batch', () => {
    const failed = settleJob(start, 'jobs', { error: 'boom' })
    expect(failed).toEqual({ values: { old: 1 }, done: 1, error: 'boom', forJobs: 'jobs' })
    expect(settleJob(failed, 'jobs', { key: 'a', value: 2 })).toEqual({ values: { old: 1, a: 2 }, done: 2, error: 'boom', forJobs: 'jobs' })
  })

  it("a new batch clears the last one's error and count, and keeps its numbers until replaced", () => {
    expect(settleJob(start, 'jobs', { key: 'a', value: 2 })).toEqual({ values: { old: 1, a: 2 }, done: 1, error: null, forJobs: 'jobs' })
  })
})

describe('worker pool without Worker support (tests, old browsers)', () => {
  it('falls back to running on the main thread', async () => {
    expect(typeof Worker).toBe('undefined')
    const result = await runSimulation({ kind: 'monteCarlo', plan: examplePlan }, 'g')
    expect(result.successRate).toBe(runMonteCarlo(examplePlan).successRate)
  })
})
