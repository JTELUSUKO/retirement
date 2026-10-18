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

  it('updates existing accounts instead of duplicating them', () => {
    const savings = savingsFromPlan(examplePlan)
    savings['401k'] = { ...savings['401k'], balance: 1 }
    const accounts = applySavings(examplePlan.accounts, savings)
    expect(accounts).toHaveLength(examplePlan.accounts.length)
    expect(accounts.find((a) => a.type === '401k')!.balance).toBe(1)
    expect(accounts.find((a) => a.type === '401k')!.name).toBe(examplePlan.accounts.find((a) => a.type === '401k')!.name)
  })
})
