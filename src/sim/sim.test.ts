import { describe, expect, it } from 'vitest'
import { evaluatePlan, findSafeSpendingSync, runMonteCarlo } from '../engine'
import { examplePlan } from '../store/planStore'
import { runSimulation } from './pool'
import { runTask } from './tasks'

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

describe('worker pool without Worker support (tests, old browsers)', () => {
  it('falls back to running on the main thread', async () => {
    expect(typeof Worker).toBe('undefined')
    const result = await runSimulation({ kind: 'monteCarlo', plan: examplePlan }, 'g')
    expect(result.successRate).toBe(runMonteCarlo(examplePlan).successRate)
  })
})
