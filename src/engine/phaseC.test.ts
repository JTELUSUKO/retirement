import { describe, expect, it } from 'vitest'
import { projectPlan } from './projection'
import { mixReturns } from './returns'
import { basePlan } from './testFixtures'
import type { Plan } from './types'

describe('investment mix and fees', () => {
  it('computes a 60/40 mix from the capital market assumptions', () => {
    const m = mixReturns(0.6)
    expect(m.mean).toBeCloseTo(0.069, 6)
    expect(m.volatility).toBeCloseTo(0.1071, 3)
    expect(mixReturns(1)).toEqual({ mean: 0.085, volatility: 0.17 })
  })

  it('charges fees on invested accounts but not cash', () => {
    const plan = (annualFee: number): Plan => ({
      ...basePlan,
      currentAge: 50, retirementAge: 70, lifeExpectancy: 75, annualSpending: 1,
      accounts: [
        { ...basePlan.accounts[0], type: 'roth', balance: 100_000 },
        { ...basePlan.accounts[0], id: 'c', type: 'cash', balance: 100_000 },
      ],
      assumptions: { ...basePlan.assumptions, returnPreRetirement: 0.06, inflation: 0, annualFee },
    })
    const y = (fee: number) => projectPlan(plan(fee), 2026).years[0]
    // Roth: 100,000 × 1.06 × (1 − 1%) = 104,940; cash unchanged
    expect(y(0.01).balance).toBeCloseTo(104_940 + 100_000)
    expect(y(0).balance).toBeCloseTo(106_000 + 100_000)
  })
})

import { householdSocialSecurityMonthly, socialSecurityAt, spousalFactor } from './survivor'

describe('spousal benefits', () => {
  // Same age; you: $3,000 at 67; spouse: $500 at 67 (under half of yours)
  const couple = (extra: Partial<Plan> = {}): Plan => ({
    ...basePlan,
    filingStatus: 'married', currentAge: 60, spouseCurrentAge: 60,
    socialSecurityAtFRA: 3_000, spouseSocialSecurityAtFRA: 500,
    socialSecurityClaimAge: 67, spouseClaimAge: 62,
    ...extra,
  })

  it('reduces the spousal benefit to 65% at 62 and pays it in full from 67', () => {
    expect(spousalFactor(62)).toBeCloseTo(0.65)
    expect(spousalFactor(64)).toBeCloseTo(1 - 36 * 25 / 3600)
    expect(spousalFactor(67)).toBe(1)
  })

  it('adds the top-up only once both have claimed', () => {
    const p = couple()
    // Spouse claims own at 62: $350; you haven't filed yet
    expect(socialSecurityAt(p, 62)).toBeCloseTo(350 * 12)
    // You file at 67: spouse adds (1,500 − 500) unreduced (spousal starts at 67)
    expect(socialSecurityAt(p, 67)).toBeCloseTo((3_000 + 350 + 1_000) * 12)
    expect(householdSocialSecurityMonthly(p)).toBeCloseTo(3_000 + 350 + 1_000)
  })

  it('reduces the top-up when both claim early', () => {
    const p = couple({ socialSecurityClaimAge: 62 })
    // You: 3,000 × 70% = 2,100; spouse: 350 + 1,000 × 65%
    expect(socialSecurityAt(p, 62)).toBeCloseTo((2_100 + 350 + 650) * 12)
  })

  it('pays no top-up when each benefit is at least half of the other', () => {
    const p = couple({ spouseSocialSecurityAtFRA: 1_600, spouseClaimAge: 67 })
    expect(socialSecurityAt(p, 67)).toBeCloseTo((3_000 + 1_600) * 12)
  })

  it('ends the spousal top-up at a death; the survivor rules apply', () => {
    const p = couple({ survivor: { enabled: true, whoDies: 'you', firstDeathAge: 75, spendingShare: 0.75 } })
    // Spouse survives: gets your $3,000 (claimed at 67) as a survivor benefit
    expect(socialSecurityAt(p, 75)).toBeCloseTo(3_000 * 12)
  })
})

import { longTermCareAt } from './longTermCare'
import { applyScenario } from './scenarios'
import { runMonteCarlo } from './monteCarlo'

describe('long-term care', () => {
  // Single, retired at 80, $1M Roth, no inflation
  const ltcPlan = (extra: Partial<Plan['longTermCare']> = {}, plan: Partial<Plan> = {}): Plan => ({
    ...basePlan,
    currentAge: 80, retirementAge: 80, lifeExpectancy: 95, annualSpending: 40_000,
    accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 1_000_000 }],
    healthcare: { preMedicareAnnual: 0, medicareAnnual: 0, excessInflation: 0 },
    longTermCare: { enabled: true, who: 'you', startAge: 85, years: 3, annualCost: 100_000, ...extra },
    ...plan,
  })

  it('adds the cost for the chosen years only', () => {
    const years = projectPlan(ltcPlan(), 2026).years
    expect(years.filter((y) => y.longTermCare > 0).map((y) => y.age)).toEqual([85, 86, 87])
    expect(years.find((y) => y.age === 86)!.healthcare).toBe(100_000)
  })

  it('stops if that person has already died (survivor modeling)', () => {
    const couple = ltcPlan({}, {
      filingStatus: 'married', spouseCurrentAge: 80, spouseClaimAge: 67,
      survivor: { enabled: true, whoDies: 'you', firstDeathAge: 84, spendingShare: 0.75 },
    })
    expect(longTermCareAt(couple, 86)).toBe(0)
  })

  it('the stress test turns it on with default settings and lowers the odds of a tight plan', () => {
    const tight = ltcPlan({ enabled: false }, {
      accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 550_000 }],
      assumptions: { ...basePlan.assumptions, returnPostRetirement: 0.05, volatilityPostRetirement: 0.1 },
    })
    const stressed = applyScenario(tight, { id: 's', name: 'LTC', overrides: {}, stress: 'long-term-care', slot: 1 })
    expect(stressed.longTermCare).toMatchObject({ enabled: true, startAge: 85, years: 3 })
    expect(runMonteCarlo(stressed).successRate).toBeLessThan(runMonteCarlo(tight).successRate)
  })
})
