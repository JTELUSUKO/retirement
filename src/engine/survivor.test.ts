import { describe, expect, it } from 'vitest'
import { runMonteCarlo } from './monteCarlo'
import { projectPlan } from './projection'
import { householdAt, socialSecurityYearly } from './survivor'
import { basePlan } from './testFixtures'
import type { Plan } from './types'
import { validatePlan } from './validation'

// Married, both 60 and retired, Roth only (no income tax from withdrawals), no growth or inflation.
// Social Security: $2,000 + $1,000/mo at 67, claimed at 67. A $12,000 pension with a 50% survivor benefit.
const couple: Plan = {
  ...basePlan,
  filingStatus: 'married',
  lifeExpectancy: 80,
  annualSpending: 60_000,
  accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 2_000_000 }],
  socialSecurityAtFRA: 2_000,
  spouseSocialSecurityAtFRA: 1_000,
  incomeStreams: [
    { id: 'p', name: 'Pension', kind: 'pension', annualAmount: 12_000, startAge: 60, endAge: null, inflationAdjusted: false, taxableShare: 1, survivorShare: 0.5 },
  ],
  healthcare: { preMedicareAnnual: 10_000, medicareAnnual: 6_000, excessInflation: 0 },
  survivor: { enabled: true, firstDeathAge: 70, spendingShare: 0.75 },
}
const at = (plan: Plan, age: number) => projectPlan(plan, 2026).years.find((y) => y.age === age)!

describe('survivor modeling', () => {
  it('before the death: both benefits, full spending, healthcare for two', () => {
    const y = at(couple, 69)
    expect(y.widowed).toBe(false)
    expect(y.healthcare).toBe(12_000)
    expect(y.spending).toBe(60_000 + 12_000)
    expect(y.otherIncome).toBe(12_000)
    expect(y.income).toBe(12_000 + 36_000)
  })

  it('after the death: larger benefit only, survivor spending and pension share, healthcare for one', () => {
    const y = at(couple, 70)
    expect(y.widowed).toBe(true)
    expect(y.healthcare).toBe(6_000)
    expect(y.spending).toBe(45_000 + 6_000)
    expect(y.otherIncome).toBe(6_000)
    expect(y.income).toBe(6_000 + 24_000)
  })

  it('files jointly in the year of death and single afterwards', () => {
    expect(householdAt(couple, 69).taxStatus).toBe('married')
    expect(householdAt(couple, 70).taxStatus).toBe('married')
    expect(householdAt(couple, 71).taxStatus).toBe('single')
  })

  it('pays more tax as a single filer on the same income (widow’s penalty)', () => {
    // Pre-tax savings so withdrawals are taxed; compare the year after the death with no death at all
    const pretax: Plan = { ...couple, accounts: [{ ...couple.accounts[0], type: '401k' }], survivor: { ...couple.survivor, spendingShare: 1 } }
    const noDeath: Plan = { ...pretax, survivor: { ...pretax.survivor, enabled: false } }
    // Same spending; survivor has less income, so compare tax per dollar of taxable income instead
    const single = at(pretax, 72)
    const joint = at(noDeath, 72)
    expect(single.taxableIncome / single.federalTax).toBeLessThan(joint.taxableIncome / joint.federalTax)
  })

  it('keeps the larger benefit whichever spouse dies', () => {
    expect(socialSecurityYearly(couple, true)).toBe(24_000)
    expect(socialSecurityYearly({ ...couple, socialSecurityAtFRA: 1_000, spouseSocialSecurityAtFRA: 2_000 }, true)).toBe(24_000)
  })

  it('is ignored for single filers', () => {
    const single: Plan = { ...couple, filingStatus: 'single' }
    expect(at(single, 75).widowed).toBe(false)
    expect(socialSecurityYearly(single, false)).toBe(24_000)
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

  it('validates the death age and spending share', () => {
    const fields = (p: Plan) => validatePlan(p).map((i) => i.field)
    expect(fields({ ...couple, survivor: { ...couple.survivor, firstDeathAge: 85 } })).toContain('survivor')
    expect(fields({ ...couple, survivor: { ...couple.survivor, spendingShare: 0.1 } })).toContain('survivor')
    expect(fields(couple)).toEqual([])
  })
})
