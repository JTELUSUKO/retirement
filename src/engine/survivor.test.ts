import { describe, expect, it } from 'vitest'
import { runMonteCarlo } from './monteCarlo'
import { projectPlan } from './projection'
import {
  deceasedBasis,
  householdAt,
  householdSocialSecurityMonthly,
  planEndAge,
  socialSecurityAt,
  survivorAgeFactor,
  survivorFromAge,
} from './survivor'
import { basePlan } from './testFixtures'
import type { Plan } from './types'
import { validatePlan } from './validation'

// Married, both 60 and retired, Roth only (no income tax from withdrawals), no growth or inflation.
// Social Security: $2,000 + $1,000/mo at 67, both claimed at 67. A $12,000 pension with a 50% survivor benefit.
const couple: Plan = {
  ...basePlan,
  filingStatus: 'married',
  lifeExpectancy: 80,
  annualSpending: 60_000,
  accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 2_000_000 }],
  socialSecurityAtFRA: 2_000,
  spouseSocialSecurityAtFRA: 1_000,
  spouseCurrentAge: 60,
  spouseClaimAge: 67,
  incomeStreams: [
    { id: 'p', name: 'Pension', kind: 'pension', annualAmount: 12_000, startAge: 60, endAge: null, inflationAdjusted: false, taxableShare: 1, survivorShare: 0.5 },
  ],
  healthcare: { preMedicareAnnual: 10_000, medicareAnnual: 6_000, excessInflation: 0 },
  survivor: { enabled: true, whoDies: 'you', firstDeathAge: 70, spendingShare: 0.75 },
}
const at = (plan: Plan, age: number) => projectPlan(plan, 2026).years.find((y) => y.age === age)!

describe('survivor modeling (same ages)', () => {
  it('before the death: both benefits, full spending, healthcare for two', () => {
    const y = at(couple, 69)
    expect(y.widowed).toBe(false)
    expect(y.healthcare).toBe(12_000)
    expect(y.spending).toBe(60_000 + 12_000)
    expect(y.otherIncome).toBe(12_000)
    expect(y.income).toBe(12_000 + 36_000)
  })

  it('after the death: survivor benefit, survivor spending and pension share, healthcare for one', () => {
    const y = at(couple, 70)
    expect(y.widowed).toBe(true)
    expect(y.healthcare).toBe(6_000)
    expect(y.spending).toBe(45_000 + 6_000)
    expect(y.otherIncome).toBe(6_000)
    expect(y.income).toBe(6_000 + 24_000)
  })

  it('files jointly in the year of death and single afterwards', () => {
    expect(householdAt(couple, 70).taxStatus).toBe('married')
    expect(householdAt(couple, 71).taxStatus).toBe('single')
  })

  it('pays more tax per dollar as a single filer (widow’s penalty)', () => {
    const pretax: Plan = { ...couple, accounts: [{ ...couple.accounts[0], type: '401k' }], survivor: { ...couple.survivor, spendingShare: 1 } }
    const noDeath: Plan = { ...pretax, survivor: { ...pretax.survivor, enabled: false } }
    const single = at(pretax, 72)
    const joint = at(noDeath, 72)
    expect(single.taxableIncome / single.federalTax).toBeLessThan(joint.taxableIncome / joint.federalTax)
  })

  it('is ignored for single filers', () => {
    const single: Plan = { ...couple, filingStatus: 'single' }
    expect(at(single, 75).widowed).toBe(false)
    expect(socialSecurityAt(single, 75)).toBe(24_000)
    expect(planEndAge(single)).toBe(80)
  })

  it('an early death lowers the chance the money lasts for a tight plan', () => {
    const tight: Plan = {
      ...couple,
      accounts: [{ ...couple.accounts[0], balance: 700_000 }],
      assumptions: { ...couple.assumptions, returnPostRetirement: 0.05, volatilityPostRetirement: 0.1, inflation: 0.025 },
      survivor: { ...couple.survivor, spendingShare: 0.9 },
    }
    const noDeath = runMonteCarlo({ ...tight, survivor: { ...tight.survivor, enabled: false } }).successRate
    expect(runMonteCarlo(tight).successRate).toBeLessThan(noDeath)
  })
})

describe('different ages and claiming ages', () => {
  // You 60, spouse 57 (3 years younger) who claims at 62
  const apart: Plan = { ...couple, spouseCurrentAge: 57, spouseClaimAge: 62, survivor: { ...couple.survivor, enabled: false } }

  it('plans until the younger spouse reaches the plan-to age', () => {
    expect(planEndAge(apart)).toBe(83)
    const last = projectPlan(apart, 2026).years.at(-1)!
    expect(last.age).toBe(83)
    expect(last.spouseAge).toBe(80)
  })

  it('pays each benefit from that spouse’s own claiming age', () => {
    // Your age 64: spouse is 61, nobody has claimed
    expect(socialSecurityAt(apart, 64)).toBe(0)
    // Your age 65: spouse 62 claims a reduced benefit (70% of $1,000)
    expect(socialSecurityAt(apart, 65)).toBeCloseTo(700 * 12)
    // Your age 67: you claim too
    expect(socialSecurityAt(apart, 67)).toBeCloseTo((2_000 + 700) * 12)
    expect(householdSocialSecurityMonthly(apart)).toBeCloseTo(2_700)
  })

  it('counts healthcare and 65+ deductions by each person’s own age', () => {
    const y = at(apart, 65) // you on Medicare, spouse (62) not yet
    expect(y.healthcare).toBe(6_000 + 10_000)
    expect(householdAt(apart, 65).livingAges.filter((a) => a >= 65)).toEqual([65])
  })

  it('converts the spouse’s death age to your timeline', () => {
    const spouseDies: Plan = { ...apart, survivor: { ...couple.survivor, whoDies: 'spouse', firstDeathAge: 70 } }
    expect(survivorFromAge(spouseDies)).toBe(73)
    expect(householdAt(spouseDies, 73).livingAges).toEqual([73])
  })

  it('requires the spouse’s age for couples', () => {
    expect(validatePlan({ ...apart, spouseCurrentAge: 0 }).map((i) => i.message)).toContain('Enter your spouse’s age.')
  })
})

describe('SSA survivor benefit rules', () => {
  it('uses the deceased’s benefit, with an 82.5% floor if they claimed early', () => {
    expect(deceasedBasis(2_000, 62, 75)).toBeCloseTo(1_650) // paid 1,400 → floor 1,650
    expect(deceasedBasis(2_000, 70, 75)).toBeCloseTo(2_480) // delayed credits kept
  })

  it('uses the full benefit (plus credits earned) when the deceased died before claiming', () => {
    expect(deceasedBasis(2_000, 70, 64)).toBe(2_000)
    expect(deceasedBasis(2_000, 70, 69)).toBeCloseTo(2_320) // 24 months of 2/3% credits
  })

  it('reduces the survivor benefit when started before full retirement age', () => {
    expect(survivorAgeFactor(60)).toBeCloseTo(0.715)
    expect(survivorAgeFactor(63.5)).toBeCloseTo(0.8575)
    expect(survivorAgeFactor(67)).toBe(1)
  })

  it('survivor gets the larger of their own and the survivor benefit', () => {
    // You claim at 70 ($2,480) and die at 72; spouse (same age) has $1,000 at 67 → survivor gets $2,480
    const delayed: Plan = { ...couple, socialSecurityClaimAge: 70, survivor: { ...couple.survivor, firstDeathAge: 72 } }
    expect(socialSecurityAt(delayed, 72)).toBeCloseTo(2_480 * 12)
  })

  it('a younger survivor waits until their own claiming age (≥ 60) to start the survivor benefit', () => {
    // You die at 65 before claiming; spouse is 62 then and claims at 67 → nothing until spouse is 67, then $2,000
    const young: Plan = {
      ...couple,
      spouseCurrentAge: 57,
      spouseClaimAge: 67,
      socialSecurityClaimAge: 70,
      survivor: { ...couple.survivor, whoDies: 'you', firstDeathAge: 65 },
    }
    expect(socialSecurityAt(young, 66)).toBe(0) // spouse 63
    expect(socialSecurityAt(young, 70)).toBeCloseTo(2_000 * 12) // spouse 67
  })
})
