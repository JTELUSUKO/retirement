import { describe, expect, it } from 'vitest'
import { projectPlan } from './projection'
import { mixReturns } from './returns'
import { basePlan } from './testFixtures'
import type { Plan } from './types'

describe('investment mix and fees', () => {
  it('computes a 60/40 mix from the capital market assumptions', () => {
    const m = mixReturns(0.6)
    expect(m.mean).toBeCloseTo(0.069, 6)
    expect(m.volatility).toBeCloseTo(0.1071, 3)
    expect(mixReturns(1)).toEqual({ mean: 0.085, volatility: 0.17 })
  })

  it('charges fees on invested accounts but not cash', () => {
    const plan = (annualFee: number): Plan => ({
      ...basePlan,
      currentAge: 50, retirementAge: 70, lifeExpectancy: 75, annualSpending: 1,
      accounts: [
        { ...basePlan.accounts[0], type: 'roth', balance: 100_000 },
        { ...basePlan.accounts[0], id: 'c', type: 'cash', balance: 100_000 },
      ],
      assumptions: { ...basePlan.assumptions, returnPreRetirement: 0.06, inflation: 0, annualFee },
    })
    const y = (fee: number) => projectPlan(plan(fee), 2026).years[0]
    // Roth: 100,000 × 1.06 × (1 − 1%) = 104,940; cash unchanged
    expect(y(0.01).balance).toBeCloseTo(104_940 + 100_000)
    expect(y(0).balance).toBeCloseTo(106_000 + 100_000)
  })
})
