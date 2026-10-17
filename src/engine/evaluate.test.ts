import { describe, expect, it } from 'vitest'
import { evaluatePlan } from './evaluate'
import { projectPlan } from './projection'
import { runMonteCarlo } from './monteCarlo'
import { basePlan } from './testFixtures'

describe('evaluatePlan', () => {
  it('summarizes the projection and Monte Carlo', () => {
    const e = evaluatePlan(basePlan)
    const mc = runMonteCarlo(basePlan)
    expect(e.issues).toEqual([])
    expect(e.successRate).toBe(mc.successRate)
    expect(e.depletionAge).toBe(projectPlan(basePlan).depletionAge)
    expect(e.leftTypical).toBe(mc.years.at(-1)!.p50)
  })

  it('returns the issues and no results for an invalid plan', () => {
    const e = evaluatePlan({ ...basePlan, lifeExpectancy: 50 })
    expect(e.issues.length).toBeGreaterThan(0)
    expect(e.projection).toBeNull()
  })

  it('applies the stress test', () => {
    // $300k, $10k/yr spending: money is left at 90 without the crash, less with it
    const plan = { ...basePlan, currentAge: 55, retirementAge: 60, lifeExpectancy: 90,
      accounts: [{ ...basePlan.accounts[0], balance: 300_000 }],
      assumptions: { ...basePlan.assumptions, returnPostRetirement: 0.05, volatilityPostRetirement: 0.1 } }
    const normal = evaluatePlan(plan).leftTypical
    expect(normal).toBeGreaterThan(0)
    expect(evaluatePlan(plan, 'crash').leftTypical).toBeLessThan(normal)
  })
})
