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
