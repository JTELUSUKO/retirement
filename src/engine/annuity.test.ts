import { describe, expect, it } from 'vitest'
import { annuityTaxableShare, estimatePayoutRate } from './annuity'
import { projectPlan } from './projection'
import { basePlan } from './testFixtures'
import type { AnnuityPurchase, Plan } from './types'
import { validatePlan } from './validation'

describe('annuity pricing', () => {
  it('estimates higher payouts at older ages, interpolating between table ages', () => {
    expect(estimatePayoutRate(65, 'single', false)).toBeCloseTo(0.069)
    expect(estimatePayoutRate(67, 'single', false)).toBeCloseTo(0.073)
    expect(estimatePayoutRate(75, 'single', false)).toBeGreaterThan(estimatePayoutRate(65, 'single', false))
  })

  it('pays less for joint lives and for inflation-adjusted payments', () => {
    expect(estimatePayoutRate(65, 'married', false)).toBeCloseTo(0.069 * 0.88)
    expect(estimatePayoutRate(65, 'single', true)).toBeCloseTo(0.069 * 0.72)
  })

  it('taxes all of an IRA-funded annuity and only the earnings of an after-tax one', () => {
    expect(annuityTaxableShare('pretax', 65, 'single', 100_000, 7_000)).toBe(1)
    // Expected return 7,000 × 20 years = 140,000 → 100,000 is principal
    expect(annuityTaxableShare('aftertax', 65, 'single', 100_000, 7_000)).toBeCloseTo(1 - 100 / 140)
  })
})

describe('buying an annuity in the projection', () => {
  const buy = (extra: Partial<AnnuityPurchase>): AnnuityPurchase => ({
    enabled: true, amount: 200_000, purchaseAge: 65, payoutRate: 0.07, inflationAdjusted: false, fundedFrom: 'pretax', ...extra,
  })
  // Retired at 65 with $500k pre-tax, spending $30k, no growth or inflation
  const plan = (purchase: AnnuityPurchase, extra: Partial<Plan> = {}): Plan => ({
    ...basePlan,
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 75,
    annualSpending: 30_000,
    accounts: [{ ...basePlan.accounts[0], balance: 500_000 }],
    annuityPurchase: purchase,
    ...extra,
  })

  it('moves the premium out of savings and pays income from the same year', () => {
    const [y0, y1] = projectPlan(plan(buy({})), 2026).years
    expect(y0.annuityPremium).toBe(200_000)
    expect(y0.annuityIncome).toBeCloseTo(14_000)
    // The tax loop settles to within $0.50
    expect(y0.withdrawal).toBeCloseTo(16_000 + y0.tax, 0)
    expect(y1.startBalance).toBeCloseTo(500_000 - 200_000 - y0.withdrawal)
  })

  it('keeps fixed payments flat and indexes inflation-adjusted ones from the purchase year', () => {
    const inflation = { assumptions: { ...basePlan.assumptions, inflation: 0.03 } }
    const fixed = projectPlan(plan(buy({}), inflation), 2026).years
    const indexed = projectPlan(plan(buy({ inflationAdjusted: true }), inflation), 2026).years
    expect(fixed[5].annuityIncome).toBeCloseTo(14_000)
    expect(indexed[5].annuityIncome).toBeCloseTo(14_000 * 1.03 ** 5)
  })

  it('buys only what the chosen source can pay for', () => {
    const p = plan(buy({ fundedFrom: 'aftertax' }), {
      accounts: [{ ...basePlan.accounts[0], balance: 500_000 }, { ...basePlan.accounts[0], id: 'c', type: 'cash', balance: 50_000 }],
    })
    expect(projectPlan(p, 2026).years[0].annuityPremium).toBe(50_000)
  })

  it('taxes less when bought with after-tax money', () => {
    const accounts = [{ ...basePlan.accounts[0], type: 'taxable' as const, balance: 500_000 }]
    // $400k at 7% = $28k/yr: above the 65+ deductions if fully taxable, below them if ~29% taxable
    const pretaxFunded = projectPlan(plan(buy({ amount: 400_000 }), { annualSpending: 0 }), 2026).years[0]
    const afterTaxFunded = projectPlan(plan(buy({ amount: 400_000, fundedFrom: 'aftertax' }), { accounts, annualSpending: 0 }), 2026).years[0]
    expect(pretaxFunded.tax).toBeGreaterThan(0)
    expect(afterTaxFunded.tax).toBeLessThan(pretaxFunded.tax)
  })

  it('reinvests income beyond spending and tax', () => {
    const y = projectPlan(
      { ...basePlan, annualSpending: 10_000, incomeStreams: [
        { id: 'p', name: 'Pension', kind: 'pension', annualAmount: 15_000, startAge: 60, endAge: null, inflationAdjusted: false, taxableShare: 1, survivorShare: 1 },
      ] },
      2026,
    ).years[0]
    // $15k income (below the standard deduction, so no tax) − $10k spending
    expect(y.surplusReinvested).toBe(5_000)
    expect(y.balance).toBe(105_000)
  })

  it('must be bought at or after retirement', () => {
    const issues = validatePlan(plan(buy({ purchaseAge: 60 })))
    expect(issues.map((i) => i.field)).toContain('annuityPurchase')
  })
})
