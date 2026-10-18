import { describe, expect, it } from 'vitest'
import { contributionWarnings, k401Limit } from './contributions'
import { runMonteCarlo } from './monteCarlo'
import { projectPlan, QUALIFIED_DIVIDEND_YIELD } from './projection'
import { medianReturn } from './returns'
import { federalIncomeTax } from './taxes'
import { basePlan } from './testFixtures'
import type { Account, Plan } from './types'

const account = (type: Account['type'], balance: number, extra: Partial<Account> = {}): Account => ({
  id: type, name: type, type, balance, annualContribution: 0, employerMatch: 0, costBasis: null, ...extra,
})

describe('typical (median) returns for the deterministic projection', () => {
  it('is about 1 point below the average at 15% volatility, and equal with no volatility', () => {
    expect(medianReturn(0.07, 0.15)).toBeCloseTo(0.05964, 4)
    expect(medianReturn(0.05, 0)).toBeCloseTo(0.05, 12)
  })

  it('ends near the Monte Carlo median instead of far above it', () => {
    const plan: Plan = {
      ...basePlan,
      currentAge: 55, retirementAge: 65, lifeExpectancy: 95, annualSpending: 50_000,
      accounts: [account('roth', 800_000, { annualContribution: 20_000 })],
      assumptions: { returnPreRetirement: 0.07, returnPostRetirement: 0.05, volatilityPreRetirement: 0.15, volatilityPostRetirement: 0.1, inflation: 0.025, annualFee: 0 },
    }
    const det = projectPlan(plan, 2026).years.at(-1)!.startBalanceReal
    const median = runMonteCarlo(plan, { randomInflation: false }).years.at(-1)!.p50
    expect(Math.abs(det - median) / median).toBeLessThan(0.15)
  })
})

describe('10% early-withdrawal penalty', () => {
  // Retired, spending $40k, no growth or inflation
  const early = (age: number, retirementAge: number, accounts: Account[]): Plan => ({
    ...basePlan, currentAge: age, retirementAge, lifeExpectancy: age + 5, annualSpending: 40_000, accounts,
  })

  it('applies to IRA/401(k) withdrawals before 59½', () => {
    const y = projectPlan(early(50, 50, [account('401k', 1_000_000)]), 2026).years[0]
    expect(y.earlyWithdrawalPenalty).toBeCloseTo(0.1 * y.withdrawal, 0)
    expect(y.federalTax).toBeGreaterThan(y.earlyWithdrawalPenalty)
  })

  it('does not apply from the year you turn 59', () => {
    expect(projectPlan(early(59, 59, [account('401k', 1_000_000)]), 2026).years[0].earlyWithdrawalPenalty).toBe(0)
  })

  it('Rule of 55: no penalty on a 401(k) when you retire at 55+, but IRAs still owe it', () => {
    expect(projectPlan(early(56, 56, [account('401k', 1_000_000)]), 2026).years[0].earlyWithdrawalPenalty).toBe(0)
    expect(projectPlan(early(56, 56, [account('traditional-ira', 1_000_000)]), 2026).years[0].earlyWithdrawalPenalty).toBeGreaterThan(0)
  })

  it('uses penalty-free 401(k) money before penalized IRA money', () => {
    const y = projectPlan(early(56, 56, [account('traditional-ira', 500_000), account('401k', 500_000)]), 2026).years[0]
    expect(y.earlyWithdrawalPenalty).toBe(0)
  })
})

describe('capital gains and NIIT (2026)', () => {
  const tax = (ordinaryIncome: number, capitalGains: number) =>
    federalIncomeTax({ ordinaryIncome, capitalGains, socialSecurity: 0, age: 66, year: 2026, status: 'single', priceLevel: 1 })

  it('taxes gains at 0% within the zero-rate bracket', () => {
    // 60,000 − 24,150 deductions = 35,850 taxable gains, all under 49,450
    expect(tax(0, 60_000).tax).toBe(0)
  })

  it('stacks gains on top of ordinary income', () => {
    // Income 100,000 trims the senior deduction by 6% × 25,000 = 1,500 → deductions 22,650.
    // Ordinary 40,000 → 17,350 taxable (tax 1,834); gains fill 0% to 49,450 (32,100), 27,900 at 15% = 4,185
    const r = tax(40_000, 60_000)
    expect(r.capitalGainsTax).toBeCloseTo(4_185)
    expect(r.tax).toBeCloseTo(1_834 + 4_185)
  })

  it('adds the 3.8% net investment income tax above $200k (single)', () => {
    expect(tax(0, 300_000).niit).toBeCloseTo(0.038 * 100_000)
  })
})

describe('brokerage accounts in the projection', () => {
  const brokerage = (costBasis: number | null): Plan => ({
    ...basePlan, currentAge: 66, retirementAge: 66, lifeExpectancy: 70, annualSpending: 150_000,
    accounts: [account('taxable', 3_000_000, { costBasis })],
  })

  it('taxes the gains part of each sale, so low basis means more tax', () => {
    const lowBasis = projectPlan(brokerage(500_000), 2026).years[0]
    const fullBasis = projectPlan(brokerage(null), 2026).years[0]
    expect(lowBasis.capitalGains).toBeGreaterThan(fullBasis.capitalGains)
    expect(lowBasis.federalTax).toBeGreaterThan(0)
    expect(lowBasis.federalTax).toBeGreaterThan(fullBasis.federalTax)
  })

  it('counts qualified dividends even with no gains in the sale', () => {
    const y = projectPlan(brokerage(null), 2026).years[0]
    expect(y.capitalGains).toBeCloseTo(3_000_000 * QUALIFIED_DIVIDEND_YIELD, 0)
  })
})

describe('contribution limit warnings (2026)', () => {
  const plan = (age: number, accounts: Account[], extra: Partial<Plan> = {}): Plan => ({ ...basePlan, currentAge: age, retirementAge: 67, accounts, ...extra })

  it('uses the age-based 401(k) catch-up', () => {
    expect(k401Limit(45)).toBe(24_500)
    expect(k401Limit(55)).toBe(32_500)
    expect(k401Limit(61)).toBe(35_750)
    expect(contributionWarnings(plan(55, [account('401k', 0, { annualContribution: 30_000 })]))).toEqual([])
    expect(contributionWarnings(plan(55, [account('401k', 0, { annualContribution: 40_000 })]))).toHaveLength(1)
  })

  it('checks IRA and HSA limits (HSA family limit for couples)', () => {
    expect(contributionWarnings(plan(55, [account('traditional-ira', 0, { annualContribution: 9_000 })]))).toHaveLength(1)
    expect(contributionWarnings(plan(56, [account('hsa', 0, { annualContribution: 6_000 })]))).toHaveLength(1)
    expect(contributionWarnings(plan(56, [account('hsa', 0, { annualContribution: 6_000 })], { filingStatus: 'married' }))).toEqual([])
  })
})
