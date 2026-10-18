import { describe, expect, it } from 'vitest'
import { runMonteCarlo } from './monteCarlo'
import { projectPlan } from './projection'
import { basePlan } from './testFixtures'
import type { Plan } from './types'

const volatilePlan: Plan = {
  ...basePlan,
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 95,
  accounts: [{ ...basePlan.accounts[0], balance: 500_000, annualContribution: 20_000 }],
  annualSpending: 50_000,
  socialSecurityAtFRA: 2_000,
  assumptions: {
    returnPreRetirement: 0.07,
    returnPostRetirement: 0.05,
    volatilityPreRetirement: 0.15,
    volatilityPostRetirement: 0.1,
    inflation: 0.025,
    annualFee: 0,
  },
}

describe('runMonteCarlo', () => {
  it('matches the deterministic projection when volatility is zero', () => {
    const plan: Plan = {
      ...volatilePlan,
      assumptions: { ...volatilePlan.assumptions, volatilityPreRetirement: 0, volatilityPostRetirement: 0 },
    }
    const mc = runMonteCarlo(plan, { runs: 20, startYear: 2026, randomInflation: false })
    const det = projectPlan(plan, 2026)
    mc.years.forEach((y, t) => expect(y.p50).toBeCloseTo(det.years[t].startBalanceReal, 4))
    expect(mc.successRate).toBe(det.depletionAge === null ? 1 : 0)
  })

  it('reports 0% success when the plan always runs out', () => {
    // Needs $220k over 11 years from $100k with no growth
    expect(runMonteCarlo({ ...basePlan, annualSpending: 20_000 }, { runs: 50 }).successRate).toBe(0)
  })

  it('is repeatable for the same seed', () => {
    const a = runMonteCarlo(volatilePlan, { runs: 200, seed: 7 })
    const b = runMonteCarlo(volatilePlan, { runs: 200, seed: 7 })
    expect(a).toEqual(b)
  })

  it('gives a success rate between 0 and 1 and ordered percentiles', () => {
    const mc = runMonteCarlo(volatilePlan, { runs: 500 })
    expect(mc.successRate).toBeGreaterThan(0)
    expect(mc.successRate).toBeLessThan(1)
    for (const y of mc.years) {
      expect(y.p10).toBeLessThanOrEqual(y.p25)
      expect(y.p25).toBeLessThanOrEqual(y.p50)
      expect(y.p50).toBeLessThanOrEqual(y.p75)
      expect(y.p75).toBeLessThanOrEqual(y.p90)
    }
  })

  it('random inflation adds risk compared with fixed inflation', () => {
    const fixed = runMonteCarlo(volatilePlan, { runs: 2000, randomInflation: false })
    const random = runMonteCarlo(volatilePlan, { runs: 2000 })
    expect(random.successRate).toBeLessThan(fixed.successRate)
  })

  it('returns no rows instead of crashing when the plan has no years', () => {
    expect(runMonteCarlo({ ...volatilePlan, lifeExpectancy: 40 }, { runs: 5 }).years).toEqual([])
  })

  it('has one percentile row per year of the plan', () => {
    const mc = runMonteCarlo(volatilePlan, { runs: 10 })
    expect(mc.years).toHaveLength(95 - 55 + 1)
    expect(mc.years[0].age).toBe(55)
  })
})
