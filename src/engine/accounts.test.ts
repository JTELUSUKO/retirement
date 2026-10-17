import { describe, expect, it } from 'vitest'
import { projectPlan } from './projection'
import { basePlan } from './testFixtures'
import type { Account, Plan } from './types'

const account = (id: string, type: Account['type'], balance: number): Account => ({
  id, name: id, type, balance, annualContribution: 0, employerMatch: 0, costBasis: null,
})

// Retired at 60 with $10k/yr spending and no growth or inflation (from basePlan)
const plan = (accounts: Account[], extra: Partial<Plan> = {}): Plan => ({ ...basePlan, accounts, ...extra })

describe('per-account withdrawals', () => {
  it('spends cash, then taxable, then pre-tax, then Roth, then HSA', () => {
    const result = projectPlan(
      plan([account('roth', 'roth', 10_000), account('hsa', 'hsa', 10_000), account('ira', 'traditional-ira', 10_000),
        account('brokerage', 'taxable', 10_000), account('cash', 'cash', 10_000)]),
    )
    const firstBucket = result.years.slice(0, 5).map((y) =>
      Object.entries(y.withdrawalsByBucket).find(([, v]) => v > 0)?.[0],
    )
    expect(firstBucket).toEqual(['cash', 'taxable', 'pretax', 'roth', 'hsa'])
  })

  it('splits a withdrawal across accounts of the same type by balance', () => {
    const result = projectPlan(plan([account('a', '401k', 30_000), account('b', 'traditional-ira', 10_000)]))
    expect(result.years[0].withdrawalsByBucket.pretax).toBe(10_000)
    // 75/25 split leaves 22.5k + 7.5k
    expect(result.years[1].startBalance).toBe(30_000)
  })

  it('moves to the next bucket mid-year when one runs out', () => {
    const result = projectPlan(plan([account('cash', 'cash', 4_000), account('roth', 'roth', 50_000)]))
    expect(result.years[0].withdrawalsByBucket).toMatchObject({ cash: 4_000, roth: 6_000 })
  })

  it('grows cash with inflation and investments with the market return', () => {
    const p = plan([account('cash', 'cash', 100_000), account('k', '401k', 100_000)], {
      annualSpending: 0,
      assumptions: { ...basePlan.assumptions, inflation: 0.03, returnPostRetirement: 0.06 },
    })
    const y0 = projectPlan(p).years[0]
    expect(y0.balance).toBeCloseTo(103_000 + 106_000)
  })

  it('keeps bucket balances adding up to the total', () => {
    const result = projectPlan(
      plan([account('k', '401k', 300_000), account('r', 'roth', 100_000), account('c', 'cash', 20_000)], {
        currentAge: 70, retirementAge: 70, lifeExpectancy: 95, annualSpending: 30_000,
        assumptions: { ...basePlan.assumptions, returnPostRetirement: 0.05, inflation: 0.02 },
      }),
      2026,
    )
    for (const y of result.years) {
      const sum = Object.values(y.startByBucketReal).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(y.startBalanceReal, 4)
    }
  })
})

describe('RMDs in the projection', () => {
  // Born 1953 → RMDs from 73. Pre-tax $265k → first RMD $10k.
  const rmdPlan = (spending: number, accounts: Account[]) =>
    plan(accounts, { currentAge: 73, retirementAge: 73, lifeExpectancy: 75, annualSpending: spending })

  it('uses the RMD for spending before touching other accounts', () => {
    const y = projectPlan(rmdPlan(10_000, [account('cash', 'cash', 50_000), account('ira', 'traditional-ira', 265_000)]), 2026).years[0]
    expect(y.rmd).toBeCloseTo(10_000)
    expect(y.withdrawalsByBucket).toMatchObject({ pretax: 10_000, cash: 0 })
    expect(y.rmdReinvested).toBe(0)
  })

  it('reinvests the unspent RMD in a taxable account', () => {
    const y = projectPlan(rmdPlan(4_000, [account('ira', 'traditional-ira', 265_000), account('brk', 'taxable', 0)]), 2026).years[0]
    expect(y.rmdReinvested).toBeCloseTo(6_000)
    expect(y.withdrawal).toBeCloseTo(4_000)
    expect(y.balance).toBeCloseTo(265_000 - 4_000)
  })

  it('creates a taxable account for reinvested RMDs when there is none', () => {
    const result = projectPlan(rmdPlan(0, [account('ira', 'traditional-ira', 265_000)]), 2026)
    expect(result.years[1].startByBucketReal.taxable).toBeCloseTo(10_000)
    expect(result.years[1].startBalance).toBeCloseTo(265_000)
  })

  it('takes RMDs even while still working', () => {
    const y = projectPlan(
      plan([account('ira', 'traditional-ira', 265_000)], { currentAge: 73, retirementAge: 75, lifeExpectancy: 80 }),
      2026,
    ).years[0]
    expect(y.rmd).toBeCloseTo(10_000)
    expect(y.rmdReinvested).toBeCloseTo(10_000)
  })
})
