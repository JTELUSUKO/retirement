import { describe, expect, it } from 'vitest'
import { projectPlan } from './projection'
import { federalIncomeTax } from './taxes'
import { basePlan } from './testFixtures'
import type { Account, Plan } from './types'

const account = (type: Account['type'], balance: number): Account => ({
  id: type, name: type, type, balance, annualContribution: 0, employerMatch: 0,
})

// Retired at 60, no growth or inflation (from basePlan)
const plan = (extra: Partial<Plan>, accounts: Account[]): Plan => ({
  ...basePlan,
  annualSpending: 0,
  accounts,
  healthcare: { preMedicareAnnual: 10_000, medicareAnnual: 6_000, excessInflation: 0 },
  ...extra,
})

describe('healthcare costs', () => {
  it('uses the pre-Medicare cost before 65 and the Medicare cost from 65', () => {
    const years = projectPlan(plan({ currentAge: 63, retirementAge: 63, lifeExpectancy: 66 }, [account('roth', 100_000)]), 2026).years
    expect(years.map((y) => y.healthcare)).toEqual([10_000, 10_000, 6_000, 6_000])
  })

  it('doubles for married couples', () => {
    const y = projectPlan(plan({ filingStatus: 'married' }, [account('roth', 100_000)]), 2026).years[0]
    expect(y.healthcare).toBe(20_000)
  })

  it('rises faster than general inflation by the extra medical inflation', () => {
    const p = plan(
      { healthcare: { preMedicareAnnual: 10_000, medicareAnnual: 6_000, excessInflation: 0.03 },
        assumptions: { ...basePlan.assumptions, inflation: 0.02 } },
      [account('roth', 1_000_000)],
    )
    const y2 = projectPlan(p, 2026).years[2]
    expect(y2.healthcare).toBeCloseTo(10_000 * 1.02 ** 2 * 1.03 ** 2)
  })

  it('is zero while still working', () => {
    const y = projectPlan(plan({ retirementAge: 62 }, [account('roth', 100_000)]), 2026).years[0]
    expect(y.healthcare).toBe(0)
  })
})

describe('HSA', () => {
  it('pays medical costs first, tax-free, before cash', () => {
    const y = projectPlan(plan({}, [account('cash', 50_000), account('hsa', 50_000)]), 2026).years[0]
    expect(y.withdrawalsByBucket).toMatchObject({ hsa: 10_000, cash: 0 })
    expect(y.tax).toBe(0)
  })

  it('taxes non-medical HSA withdrawals and adds a 20% penalty before 65', () => {
    // $30k of non-medical spending from the HSA at 60: W = 30,000 + tax(W) + 20% × W
    const y = projectPlan(plan({ annualSpending: 30_000, healthcare: { preMedicareAnnual: 0, medicareAnnual: 0, excessInflation: 0 } },
      [account('hsa', 500_000)]), 2026).years[0]
    const federal = federalIncomeTax({ ordinaryIncome: y.withdrawal, socialSecurity: 0, age: 60, year: 2026, status: 'single', priceLevel: 1 }).tax
    expect(y.tax).toBeCloseTo(federal + 0.2 * y.withdrawal, 0)
    expect(y.withdrawal).toBeCloseTo(30_000 + y.tax, 0)
  })

  it('has no penalty on non-medical HSA withdrawals from 65', () => {
    const y = projectPlan(plan({ currentAge: 66, retirementAge: 66, lifeExpectancy: 70, annualSpending: 30_000,
      healthcare: { preMedicareAnnual: 0, medicareAnnual: 0, excessInflation: 0 } }, [account('hsa', 500_000)]), 2026).years[0]
    const federal = federalIncomeTax({ ordinaryIncome: y.withdrawal, socialSecurity: 0, age: 66, year: 2026, status: 'single', priceLevel: 1 }).tax
    expect(y.tax).toBeCloseTo(federal, 0)
  })
})
