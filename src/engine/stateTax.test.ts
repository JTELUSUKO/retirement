import { describe, expect, it } from 'vitest'
import { STATE_TAX_2026 } from './config/stateTax2026'
import { projectPlan } from './projection'
import { describeStateRule, stateIncomeTax, type StateTaxInput } from './stateTax'
import { basePlan } from './testFixtures'
import type { Plan } from './types'

const input = (extra: Partial<StateTaxInput>): StateTaxInput => ({
  state: 'CA', status: 'single', age: 70, ordinaryIncome: 0, retirementIncome: 0,
  taxableSocialSecurity: 0, retirementExclusionPerPerson: 0, priceLevel: 1, ...extra,
})

describe('state income tax (2026)', () => {
  it('has 41 states plus DC with an income tax', () => {
    expect(Object.keys(STATE_TAX_2026)).toHaveLength(42)
  })

  it('charges nothing in no-income-tax states or when no state is chosen', () => {
    expect(stateIncomeTax(input({ state: 'TX', ordinaryIncome: 100_000 }))).toBe(0)
    expect(stateIncomeTax(input({ state: '', ordinaryIncome: 100_000 }))).toBe(0)
  })

  it('applies California brackets, standard deduction and credit', () => {
    // 60,000 − 5,540 = 54,460 taxable → 110.79 + 303.70 + 607.52 + 780.48 = 1,802.49; − 153 credit
    expect(stateIncomeTax(input({ ordinaryIncome: 60_000 }))).toBeCloseTo(1_649.49, 2)
  })

  it('exempts retirement income in Illinois but taxes other income', () => {
    expect(stateIncomeTax(input({ state: 'IL', ordinaryIncome: 50_000, retirementIncome: 50_000 }))).toBe(0)
    // Part-time work: 4.95% × (50,000 − 2,925 exemption)
    expect(stateIncomeTax(input({ state: 'IL', ordinaryIncome: 50_000 }))).toBeCloseTo(2_330.21, 2)
  })

  it('applies the age rule for retirement-income exemptions (Mississippi from ~59)', () => {
    const ms = (age: number) => stateIncomeTax(input({ state: 'MS', age, ordinaryIncome: 50_000, retirementIncome: 50_000 }))
    expect(ms(58)).toBeGreaterThan(0)
    expect(ms(60)).toBe(0)
  })

  it('taxes Social Security only in states that tax it', () => {
    const withSs = (state: string) => stateIncomeTax(input({ state, ordinaryIncome: 30_000, taxableSocialSecurity: 20_000 }))
    const withoutSs = (state: string) => stateIncomeTax(input({ state, ordinaryIncome: 30_000 }))
    expect(withSs('UT')).toBeGreaterThan(withoutSs('UT'))
    expect(withSs('NC')).toBe(withoutSs('NC'))
  })

  it('applies a per-person retirement exclusion (doubled for couples)', () => {
    const nc = (status: 'single' | 'married') =>
      stateIncomeTax(input({ state: 'NC', status, ordinaryIncome: 80_000, retirementIncome: 80_000, retirementExclusionPerPerson: 10_000 }))
    // NC 3.99%: single (80,000 − 10,000 − 12,750) ; married (80,000 − 20,000 − 25,500)
    expect(nc('single')).toBeCloseTo(0.0399 * 57_250, 2)
    expect(nc('married')).toBeCloseTo(0.0399 * 34_500, 2)
  })

  it('scales brackets and deductions with inflation', () => {
    expect(stateIncomeTax(input({ ordinaryIncome: 120_000, priceLevel: 2 }))).toBeCloseTo(
      2 * stateIncomeTax(input({ ordinaryIncome: 60_000 })),
      6,
    )
  })

  it('describes each state’s treatment of retirees', () => {
    expect(describeStateRule('TX')).toBe('No state income tax.')
    expect(describeStateRule('IL')).toMatch(/Retirement income .* exempt/)
    expect(describeStateRule('UT')).toMatch(/Social Security/)
  })
})

describe('state tax in the projection', () => {
  // Retired at 60 with $1M pre-tax, spending $60k, no growth or inflation
  const plan = (state: string): Plan => ({
    ...basePlan,
    state,
    annualSpending: 60_000,
    accounts: [{ ...basePlan.accounts[0], balance: 1_000_000 }],
  })

  it('withdraws more to pay state tax, and reports federal and state separately', () => {
    const tx = projectPlan(plan('TX'), 2026).years[0]
    const ca = projectPlan(plan('CA'), 2026).years[0]
    expect(tx.stateTax).toBe(0)
    expect(ca.stateTax).toBeGreaterThan(0)
    expect(ca.tax).toBeCloseTo(ca.federalTax + ca.stateTax)
    expect(ca.withdrawal).toBeGreaterThan(tx.withdrawal)
  })

  it('charges no state tax on IRA withdrawals in Pennsylvania after ~59', () => {
    expect(projectPlan(plan('PA'), 2026).years[0].stateTax).toBe(0)
  })
})
