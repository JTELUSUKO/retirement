import { describe, expect, it } from 'vitest'
import { projectPlan, simulatePath } from './projection'
import { basePlan } from './testFixtures'
import type { Plan } from './types'


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
    const result = projectPlan({
      ...basePlan,
      incomeStreams: [
        { id: 'p', name: 'Pension', kind: 'pension', annualAmount: 10_000, startAge: 60, endAge: null, inflationAdjusted: true, taxableShare: 1 },
      ],
    })
    expect(result.depletionAge).toBeNull()
    expect(result.years.at(-1)!.balance).toBe(100_000)
  })

  it('reports savings at retirement as the start-of-year balance', () => {
    const plan: Plan = {
      ...basePlan,
      retirementAge: 62,
      accounts: [{ ...basePlan.accounts[0], annualContribution: 10_000 }],
    }
    const result = projectPlan(plan)
    const at62 = result.years.find((y) => y.age === 62)!
    expect(result.balanceAtRetirement).toBe(120_000)
    expect(at62.startBalance).toBe(120_000)
    expect(at62.withdrawal).toBe(10_000)
  })

  it('raises spending with inflation and reports real balances in today’s dollars', () => {
    const plan: Plan = { ...basePlan, assumptions: { ...basePlan.assumptions, inflation: 0.1 } }
    const [y0, y1] = projectPlan(plan).years
    expect(y0.spending).toBeCloseTo(10_000)
    expect(y1.spending).toBeCloseTo(11_000)
    expect(y1.startBalanceReal).toBeCloseTo(90_000 / 1.1)
    expect(y0.balanceReal).toBeCloseTo(y1.startBalanceReal)
  })

  it('uses the inflation path it is given each year', () => {
    const inflations = [0.0, 0.2, 0.0]
    const result = simulatePath({ ...basePlan, lifeExpectancy: 62 }, (t) => ({ return: 0, inflation: inflations[t] }))
    expect(result.years.map((y) => Math.round(y.spending))).toEqual([10_000, 10_000, 12_000])
  })

  it('starts Social Security at the claim age', () => {
    const result = projectPlan({ ...basePlan, socialSecurityAtFRA: 1000, socialSecurityClaimAge: 67 })
    const at66 = result.years.find((y) => y.age === 66)!
    const at67 = result.years.find((y) => y.age === 67)!
    expect(at66.income).toBe(0)
    expect(at67.income).toBeCloseTo(12_000)
  })
})
