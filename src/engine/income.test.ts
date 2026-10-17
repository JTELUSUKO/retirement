import { describe, expect, it } from 'vitest'
import { incomeAtAge } from './income'
import { projectPlan } from './projection'
import { basePlan } from './testFixtures'
import type { IncomeStream, Plan } from './types'
import { validatePlan } from './validation'

const stream = (extra: Partial<IncomeStream>): IncomeStream => ({
  id: 's', name: 'Annuity', kind: 'annuity', annualAmount: 12_000, startAge: 65, endAge: null,
  inflationAdjusted: false, taxableShare: 1, ...extra,
})

describe('incomeAtAge', () => {
  it('pays only between the start and end ages (inclusive)', () => {
    const s = [stream({ startAge: 62, endAge: 64 })]
    expect([61, 62, 64, 65].map((age) => incomeAtAge(s, age, 1).amount)).toEqual([0, 12_000, 12_000, 0])
  })

  it('pays for life when there is no end age', () => {
    expect(incomeAtAge([stream({})], 100, 1).amount).toBe(12_000)
  })

  it('keeps fixed amounts flat and grows inflation-adjusted ones', () => {
    expect(incomeAtAge([stream({})], 70, 1.5).amount).toBe(12_000)
    expect(incomeAtAge([stream({ inflationAdjusted: true })], 70, 1.5).amount).toBe(18_000)
  })

  it('counts only pensions and annuities as retirement income', () => {
    const r = incomeAtAge([stream({ kind: 'work', annualAmount: 5_000 }), stream({ kind: 'pension', annualAmount: 1_000 })], 70, 1)
    expect(r).toEqual({ amount: 6_000, taxable: 6_000, taxableRetirement: 1_000 })
  })

  it('splits out the taxable share', () => {
    const r = incomeAtAge([stream({ taxableShare: 0.25 }), stream({ annualAmount: 1_000 })], 70, 1)
    expect(r).toEqual({ amount: 13_000, taxable: 4_000, taxableRetirement: 4_000 })
  })
})

describe('income streams in the projection', () => {
  // Retired at 60, $10k/yr spending, $100k in a 401k, no growth (basePlan)
  const withStreams = (incomeStreams: IncomeStream[], extra: Partial<Plan> = {}): Plan => ({ ...basePlan, incomeStreams, ...extra })

  it('reduces withdrawals by the income received', () => {
    const y = projectPlan(withStreams([stream({ startAge: 60, annualAmount: 4_000 })]), 2026).years[0]
    expect(y.otherIncome).toBe(4_000)
    expect(y.withdrawal).toBe(6_000)
  })

  it('a fixed annuity loses buying power to inflation', () => {
    const plan = withStreams([stream({ startAge: 60, annualAmount: 10_000 })], {
      accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 1_000_000 }],
      assumptions: { ...basePlan.assumptions, inflation: 0.03 },
    })
    const y10 = projectPlan(plan, 2026).years[10]
    expect(y10.otherIncome).toBe(10_000)
    expect(y10.withdrawal).toBeCloseTo(10_000 * 1.03 ** 10 - 10_000)
  })

  it('taxes only the taxable share', () => {
    const big = { annualSpending: 0, accounts: [{ ...basePlan.accounts[0], type: 'roth' as const }] }
    const full = projectPlan(withStreams([stream({ startAge: 60, annualAmount: 60_000 })], big), 2026).years[0]
    const none = projectPlan(withStreams([stream({ startAge: 60, annualAmount: 60_000, taxableShare: 0 })], big), 2026).years[0]
    expect(full.tax).toBeGreaterThan(0)
    expect(none.tax).toBe(0)
  })

  it('ignores income before retirement', () => {
    const y = projectPlan(withStreams([stream({ startAge: 60 })], { retirementAge: 62 }), 2026).years[0]
    expect(y.otherIncome).toBe(0)
  })
})

describe('income stream validation', () => {
  it('rejects an end age before the start age', () => {
    const issues = validatePlan({ ...basePlan, incomeStreams: [stream({ startAge: 70, endAge: 65 })] })
    expect(issues.map((i) => i.field)).toContain('incomeStreams')
  })

  it('rejects negative amounts', () => {
    expect(validatePlan({ ...basePlan, incomeStreams: [stream({ annualAmount: -1 })] })).not.toEqual([])
  })
})
