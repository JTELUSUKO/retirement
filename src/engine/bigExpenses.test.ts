import { describe, expect, it } from 'vitest'
import { expenseAt, expenseStartAge } from './bigExpenses'
import { projectPlan, WORKING_YEARS_GAINS_RATE, WORKING_YEARS_ORDINARY_RATE } from './projection'
import { TAX_CONFIG } from './config/taxYear'
import { basePlan } from './testFixtures'
import { validatePlan } from './validation'
import type { BigExpense, Plan } from './types'

const expense = (patch: Partial<BigExpense>): BigExpense => ({
  id: 'e',
  name: 'Expense',
  kind: 'other',
  annualAmount: 10_000,
  years: 1,
  childAgeNow: null,
  atChildAge: 18,
  startAge: 60,
  excessInflation: 0,
  collegeType: null,
  saved529: 0,
  yearly529: 0,
  ...patch,
})

// Working at 50, retiring at 60; no growth, inflation or spending before retirement
const working: Plan = {
  ...basePlan,
  currentAge: 50,
  retirementAge: 60,
  lifeExpectancy: 70,
  accounts: [
    { id: 'c', name: 'Cash', type: 'cash', balance: 20_000, annualContribution: 0, employerMatch: 0, costBasis: null },
    { id: 'k', name: '401k', type: '401k', balance: 200_000, annualContribution: 0, employerMatch: 0, costBasis: null },
  ],
}
const row = (plan: Plan, age: number) => projectPlan(plan).years.find((y) => y.age === age)!

describe('big expenses', () => {
  it("times a child's expense by the child's age", () => {
    const college = expense({ kind: 'college', childAgeNow: 10, atChildAge: 18, years: 4 })
    expect(expenseStartAge(working, college)).toBe(58)
    expect([57, 58, 61, 62].map((age) => expenseAt(working, college, age))).toEqual([0, 10_000, 10_000, 0])
  })

  it('is paid from cash first in working years, with no tax on cash', () => {
    const plan = { ...working, bigExpenses: [expense({ startAge: 52 })] }
    const y = row(plan, 52)
    expect(y.bigExpenses).toBe(10_000)
    expect(y.withdrawalsByBucket.cash).toBe(10_000)
    expect(y.tax).toBe(0)
    expect(row(plan, 53).startBalance).toBe(210_000)
  })

  it('before 59½, pre-tax money pays the working-years rate plus the 10% penalty, grossed up from savings', () => {
    const plan = { ...working, accounts: [working.accounts[1]], bigExpenses: [expense({ startAge: 52 })] }
    const y = row(plan, 52)
    const rate = WORKING_YEARS_ORDINARY_RATE + TAX_CONFIG.federalTax.earlyWithdrawal.penalty
    // The withdrawal covers the expense and its own tax: w = 10,000 + rate × w
    expect(y.withdrawalsByBucket.pretax).toBeCloseTo(10_000 / (1 - rate), -1)
    expect(y.tax).toBeCloseTo((10_000 / (1 - rate)) * rate, -1)
    expect(y.earlyWithdrawalPenalty).toBeGreaterThan(0)
  })

  it('taxes brokerage gains at the working-years capital gains rate', () => {
    const brokerage = { id: 't', name: 'Brokerage', type: 'taxable' as const, balance: 100_000, annualContribution: 0, employerMatch: 0, costBasis: 50_000 }
    // In the first year, before dividends raise the basis
    const plan = { ...working, accounts: [brokerage], bigExpenses: [expense({ startAge: 50 })] }
    const y = row(plan, 50)
    // Half of each sale is gain: w = 10,000 + 15% × w / 2
    const w = 10_000 / (1 - WORKING_YEARS_GAINS_RATE / 2)
    expect(y.withdrawalsByBucket.taxable).toBeCloseTo(w, 0)
  })

  it('a college 529 pays first, gets its contributions until college, and the rest comes from savings', () => {
    const college = expense({ kind: 'college', childAgeNow: 16, atChildAge: 18, years: 2, saved529: 5_000, yearly529: 2_000 })
    const plan = { ...working, bigExpenses: [college] }
    // 529: 5,000 + 2,000 (end of 50) + 2,000 (end of 51) = 9,000 at 52, all used in the first year
    const first = row(plan, 52)
    expect(first.bigExpensesFrom529).toBe(9_000)
    expect(first.withdrawalsByBucket.cash).toBe(1_000)
    const second = row(plan, 53)
    expect(second.bigExpensesFrom529).toBe(0)
    expect(second.withdrawalsByBucket.cash).toBe(10_000)
  })

  it('in retirement it adds to spending, and guardrails never cut it', () => {
    const plan: Plan = { ...basePlan, bigExpenses: [expense({ startAge: 62, years: 2 })] }
    expect(row(plan, 61).spending).toBe(10_000)
    expect(row(plan, 62).spending).toBe(20_000)
    expect(row(plan, 64).spending).toBe(10_000)
  })

  it('grows with inflation plus its own extra growth', () => {
    const plan: Plan = {
      ...basePlan,
      assumptions: { ...basePlan.assumptions, inflation: 0.02 },
      bigExpenses: [expense({ startAge: 62, excessInflation: 0.01 })],
    }
    // Two years in: 10,000 × 1.02² × 1.01²
    expect(row(plan, 62).bigExpenses).toBeCloseTo(10_000 * 1.02 ** 2 * 1.01 ** 2, 6)
  })

  it('a one-off cost in retirement never triggers a guardrail cut', () => {
    const guarded: Plan = { ...basePlan, accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 250_000 }], spendingRule: { type: 'guardrails', band: 0.2, adjustment: 0.1, floor: 0.75 } }
    const plan = { ...guarded, bigExpenses: [expense({ startAge: 63, annualAmount: 40_000 })] }
    expect(projectPlan(plan).years.map((y) => y.spendingFactor)).toEqual(projectPlan(guarded).years.map((y) => y.spendingFactor))
  })

  it('529 contributions stop when you retire (they come from your pay)', () => {
    const college = expense({ kind: 'college', childAgeNow: 10, atChildAge: 18, years: 1, yearly529: 1_000 })
    // College when you're 58; retiring at 55 leaves 5 years of contributions (50–54), not 8
    const plan = { ...working, retirementAge: 55, bigExpenses: [college] }
    expect(row(plan, 58).bigExpensesFrom529).toBe(5_000)
  })

  it('an RMD while still working stays untaxed, even in a year with a big expense', () => {
    const late: Plan = { ...working, currentAge: 74, retirementAge: 80, lifeExpectancy: 85, accounts: [working.accounts[1]] }
    const withExpense = { ...late, bigExpenses: [expense({ startAge: 74, annualAmount: 1_000 })] }
    const y = row(withExpense, 74)
    // The RMD more than covers the expense, so nothing extra is withdrawn and there's no tax
    expect(y.rmd).toBeGreaterThan(1_000)
    expect(y.tax).toBe(0)
  })

  it('flags an expense that starts after the plan ends', () => {
    const plan = { ...working, bigExpenses: [expense({ name: 'Wedding', childAgeNow: 0, atChildAge: 30 })] }
    expect(validatePlan(plan).map((i) => i.message).join(' ')).toMatch(/starts after your plan ends/)
  })
})
