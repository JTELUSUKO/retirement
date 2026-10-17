import { describe, expect, it } from 'vitest'
import { projectPlan } from './projection'
import { federalIncomeTax, taxableSocialSecurity } from './taxes'
import { basePlan } from './testFixtures'
import type { Plan } from './types'

const tax = (ordinaryIncome: number, extra: Partial<Parameters<typeof federalIncomeTax>[0]> = {}) =>
  federalIncomeTax({ ordinaryIncome, socialSecurity: 0, age: 60, year: 2026, status: 'single', priceLevel: 1, ...extra })

describe('federalIncomeTax (2026)', () => {
  it('applies the standard deduction and brackets (single)', () => {
    // 50,000 − 16,100 = 33,900 taxable → 10% of 12,400 + 12% of 21,500
    expect(tax(50_000).taxableIncome).toBe(33_900)
    expect(tax(50_000).tax).toBeCloseTo(3_820)
  })

  it('uses married-filing-jointly brackets', () => {
    // 100,000 − 32,200 = 67,800 → 10% of 24,800 + 12% of 43,000
    expect(tax(100_000, { status: 'married' }).tax).toBeCloseTo(7_640)
  })

  it('adds the 65+ and temporary senior deductions through 2028', () => {
    // 40,000 − (16,100 + 2,050 + 6,000) = 15,850
    expect(tax(40_000, { age: 66 }).tax).toBeCloseTo(1_654)
    // 2029: senior deduction expired → 40,000 − 18,150 = 21,850
    expect(tax(40_000, { age: 66, year: 2029 }).tax).toBeCloseTo(2_374)
  })

  it('phases out the senior deduction at higher incomes', () => {
    // 175,000 income: reduction 6% × 100,000 = 6,000 → senior deduction gone
    expect(tax(175_000, { age: 66 }).taxableIncome).toBeCloseTo(175_000 - 16_100 - 2_050)
  })

  it('indexes brackets and deductions with inflation', () => {
    expect(tax(100_000, { priceLevel: 2 }).tax).toBeCloseTo(tax(50_000).tax * 2)
  })

  it('owes nothing below the standard deduction', () => {
    expect(tax(16_000).tax).toBe(0)
  })
})

describe('taxableSocialSecurity', () => {
  it('is zero at low provisional income', () => {
    expect(taxableSocialSecurity(10_000, 20_000, 'single')).toBe(0)
  })

  it('taxes up to 50% between the two thresholds', () => {
    // provisional 30,000 → (30,000 − 25,000) / 2
    expect(taxableSocialSecurity(20_000, 20_000, 'single')).toBeCloseTo(2_500)
  })

  it('caps at 85% of benefits', () => {
    expect(taxableSocialSecurity(60_000, 30_000, 'single')).toBeCloseTo(25_500)
  })
})

describe('taxes in the projection', () => {
  const retiree = (accounts: Plan['accounts']): Plan => ({ ...basePlan, accounts, annualSpending: 60_000 })

  it('withdraws extra from pre-tax accounts to cover the tax', () => {
    // W = 60,000 + tax(W) → W ≈ 65,704.55 (taxable income stays in the 12% bracket)
    const y = projectPlan(retiree([{ ...basePlan.accounts[0], balance: 1_000_000 }]), 2026).years[0]
    expect(y.withdrawal).toBeCloseTo(65_704.55, 0)
    expect(y.tax).toBeCloseTo(5_704.55, 0)
  })

  it('charges no tax on Roth withdrawals', () => {
    const y = projectPlan(retiree([{ ...basePlan.accounts[0], type: 'roth', balance: 1_000_000 }]), 2026).years[0]
    expect(y.tax).toBe(0)
    expect(y.withdrawal).toBe(60_000)
  })

  it('stops HSA contributions at 65', () => {
    const plan: Plan = {
      ...basePlan,
      currentAge: 63,
      retirementAge: 67,
      lifeExpectancy: 68,
      accounts: [{ ...basePlan.accounts[0], type: 'hsa', balance: 0, annualContribution: 1_000 }],
    }
    const contributions = projectPlan(plan, 2026).years.slice(0, 4).map((y) => y.contributions)
    expect(contributions).toEqual([1_000, 1_000, 0, 0])
  })
})
