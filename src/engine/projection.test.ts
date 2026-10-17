import { describe, expect, it } from 'vitest'
import { projectPlan } from './projection'
import type { Plan } from './types'

const basePlan: Plan = {
  currentAge: 60,
  retirementAge: 60,
  lifeExpectancy: 70,
  accounts: [
    { id: 'a', name: '401k', type: '401k', balance: 100_000, annualContribution: 0, employerMatch: 0 },
  ],
  annualSpending: 10_000,
  socialSecurityAtFRA: 0,
  socialSecurityClaimAge: 67,
  annualPension: 0,
  assumptions: { returnPreRetirement: 0, returnPostRetirement: 0, inflation: 0 },
}

describe('projectPlan', () => {
  it('grows savings and adds contributions before retirement', () => {
    const plan: Plan = {
      ...basePlan,
      retirementAge: 65,
      accounts: [{ ...basePlan.accounts[0], annualContribution: 8_000, employerMatch: 2_000 }],
      assumptions: { ...basePlan.assumptions, returnPreRetirement: 0.1 },
    }
    const result = projectPlan(plan, 2026)
    expect(result.years[0].balance).toBeCloseTo(120_000)
    expect(result.years[0].year).toBe(2026)
  })

  it('reports the age the money runs out', () => {
    // 11 years of $10k spending (ages 60–70) against $100k
    const result = projectPlan(basePlan)
    expect(result.depletionAge).toBe(70)
    expect(result.years.at(-1)!.balance).toBe(0)
  })

  it('lasts when income covers spending', () => {
    const result = projectPlan({ ...basePlan, annualPension: 10_000 })
    expect(result.depletionAge).toBeNull()
    expect(result.years.at(-1)!.balance).toBe(100_000)
  })

  it('starts Social Security at the claim age', () => {
    const result = projectPlan({ ...basePlan, socialSecurityAtFRA: 1000, socialSecurityClaimAge: 67 })
    const at66 = result.years.find((y) => y.age === 66)!
    const at67 = result.years.find((y) => y.age === 67)!
    expect(at66.income).toBe(0)
    expect(at67.income).toBeCloseTo(12_000)
  })
})
