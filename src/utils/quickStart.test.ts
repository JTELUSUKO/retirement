import { describe, expect, it } from 'vitest'
import { blankPlan, examplePlan } from '../store/planStore'
import { applySavings, isBlankPlan, savingsFromPlan } from './quickStart'

describe('guided setup', () => {
  it('recognizes a blank plan', () => {
    expect(isBlankPlan(blankPlan)).toBe(true)
    expect(isBlankPlan(examplePlan)).toBe(false)
  })

  it('adds accounts only for amounts entered, named by type', () => {
    const savings = savingsFromPlan(blankPlan)
    savings['401k'] = { balance: 300_000, annualContribution: 20_000 }
    savings.cash = { balance: 25_000, annualContribution: 0 }
    const accounts = applySavings([], savings)
    expect(accounts.map((a) => [a.name, a.type, a.balance])).toEqual([
      ['401(k)', '401k', 300_000],
      ['Savings', 'cash', 25_000],
    ])
  })

  it('shows combined totals and merges a changed type into one account', () => {
    const accounts = [
      { id: 'a', name: 'My 401(k)', type: '401k' as const, balance: 300_000, annualContribution: 20_000, employerMatch: 5_000, costBasis: null },
      { id: 'r', name: 'Roth IRA', type: 'roth' as const, balance: 50_000, annualContribution: 0, employerMatch: 0, costBasis: null },
      { id: 'b', name: 'Spouse 401(k)', type: '401k' as const, balance: 200_000, annualContribution: 10_000, employerMatch: 3_000, costBasis: null },
    ]
    const savings = savingsFromPlan({ ...blankPlan, accounts })
    expect(savings['401k']).toEqual({ balance: 500_000, annualContribution: 30_000 })
    savings['401k'] = { balance: 520_000, annualContribution: 30_000 }
    const result = applySavings(accounts, savings)
    // No double counting: one 401(k) with the new total, in the first one's place, matches combined
    expect(result.map((a) => [a.name, a.balance, a.employerMatch])).toEqual([
      ['My 401(k)', 520_000, 8_000],
      ['Roth IRA', 50_000, 0],
    ])
  })

  it('leaves unchanged types alone and removes a type set to zero', () => {
    const accounts = [
      { id: 'a', name: 'Old 401(k)', type: '401k' as const, balance: 100, annualContribution: 0, employerMatch: 0, costBasis: null },
      { id: 'b', name: 'New 401(k)', type: '401k' as const, balance: 200, annualContribution: 0, employerMatch: 0, costBasis: null },
      { id: 'c', name: 'Savings', type: 'cash' as const, balance: 900, annualContribution: 0, employerMatch: 0, costBasis: null },
    ]
    const savings = savingsFromPlan({ ...blankPlan, accounts })
    expect(applySavings(accounts, savings)).toEqual(accounts)
    savings.cash = { balance: 0, annualContribution: 0 }
    expect(applySavings(accounts, savings).map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('combines cost basis when merging brokerage accounts', () => {
    const accounts = [
      { id: 'x', name: 'Brokerage', type: 'taxable' as const, balance: 100, annualContribution: 0, employerMatch: 0, costBasis: 60 },
      { id: 'y', name: 'Brokerage 2', type: 'taxable' as const, balance: 50, annualContribution: 0, employerMatch: 0, costBasis: null },
    ]
    const savings = savingsFromPlan({ ...blankPlan, accounts })
    // Basis 60 + 50 (no basis tracked = all basis) = 110 of 150, scaled to the new 160 total
    savings.taxable = { balance: 160, annualContribution: 0 }
    expect(applySavings(accounts, savings)).toEqual([{ ...accounts[0], balance: 160, costBasis: 117 }])
  })

  it('scales cost basis down with a smaller balance, so withdrawals are not all losses', () => {
    const accounts = [
      { id: 'x', name: 'Brokerage', type: 'taxable' as const, balance: 150_000, annualContribution: 0, employerMatch: 0, costBasis: 100_000 },
    ]
    const savings = savingsFromPlan({ ...blankPlan, accounts })
    savings.taxable = { balance: 50_000, annualContribution: 0 }
    expect(applySavings(accounts, savings)[0]!.costBasis).toBe(33_333)
  })

  it('removes a type set to zero even when it has an employer match', () => {
    const accounts = [
      { id: 'a', name: '401(k)', type: '401k' as const, balance: 100_000, annualContribution: 10_000, employerMatch: 5_000, costBasis: null },
      { id: 'c', name: 'Savings', type: 'cash' as const, balance: 900, annualContribution: 0, employerMatch: 0, costBasis: null },
    ]
    const savings = savingsFromPlan({ ...blankPlan, accounts })
    savings['401k'] = { balance: 0, annualContribution: 0 }
    expect(applySavings(accounts, savings).map((a) => a.id)).toEqual(['c'])
  })

  it('updates existing accounts instead of duplicating them', () => {
    const savings = savingsFromPlan(examplePlan)
    savings['401k'] = { ...savings['401k'], balance: 1 }
    const accounts = applySavings(examplePlan.accounts, savings)
    expect(accounts).toHaveLength(examplePlan.accounts.length)
    expect(accounts.find((a) => a.type === '401k')!.balance).toBe(1)
    expect(accounts.find((a) => a.type === '401k')!.name).toBe(examplePlan.accounts.find((a) => a.type === '401k')!.name)
  })
})
