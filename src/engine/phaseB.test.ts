import { describe, expect, it } from 'vitest'
import { irmaaPerPersonYearly } from './irmaa'
import { projectPlan } from './projection'
import { bracketTop, federalIncomeTax } from './taxes'
import { basePlan } from './testFixtures'
import type { Account, Plan } from './types'

const account = (type: Account['type'], balance: number): Account => ({
  id: type, name: type, type, balance, annualContribution: 0, employerMatch: 0, costBasis: null,
})

describe('IRMAA (CMS 2026)', () => {
  it('charges nothing at or below $109k single / $218k joint', () => {
    expect(irmaaPerPersonYearly(109_000, 'single', 1)).toBe(0)
    expect(irmaaPerPersonYearly(218_000, 'married', 1)).toBe(0)
  })

  it('charges the tier’s Part B + Part D surcharges per person', () => {
    expect(irmaaPerPersonYearly(120_000, 'single', 1)).toBeCloseTo((81.2 + 14.5) * 12)
    expect(irmaaPerPersonYearly(300_000, 'married', 1)).toBeCloseTo((202.9 + 37.5) * 12)
    expect(irmaaPerPersonYearly(600_000, 'single', 1)).toBeCloseTo((487 + 91) * 12)
  })

  it('indexes the income thresholds', () => {
    expect(irmaaPerPersonYearly(200_000, 'single', 2)).toBe(0)
  })

  it('uses income from two years earlier, so the first two retired years have no surcharge', () => {
    // Single, retired at 66, big 401(k) and high spending → MAGI well above $109k
    const plan: Plan = { ...basePlan, currentAge: 66, retirementAge: 66, lifeExpectancy: 72, annualSpending: 200_000, accounts: [account('401k', 5_000_000)] }
    const years = projectPlan(plan, 2026).years
    expect(years[0].irmaa).toBe(0)
    expect(years[1].irmaa).toBe(0)
    expect(years[2].magi).toBeGreaterThan(109_000)
    expect(years[2].irmaa).toBeGreaterThan(0)
    expect(years[2].healthcare).toBeGreaterThanOrEqual(years[2].irmaa)
  })
})

describe('Roth conversions (fill the bracket)', () => {
  it('finds the top of each 2026 bracket', () => {
    expect(bracketTop(0.12, 'single', 1)).toBe(50_400)
    expect(bracketTop(0.22, 'married', 1)).toBe(211_400)
  })

  // Retired at 62, spending paid from cash, $1M in a traditional IRA, no other income
  const converter = (extra: Partial<Plan['rothConversion']> = {}, plan: Partial<Plan> = {}): Plan => ({
    ...basePlan,
    currentAge: 62, retirementAge: 62, lifeExpectancy: 80, annualSpending: 30_000,
    accounts: [account('cash', 600_000), account('traditional-ira', 1_000_000)],
    rothConversion: { enabled: true, fillToRate: 0.12, fromAge: 62, toAge: 64, stayUnderIrmaa: false, ...extra },
    ...plan,
  })

  it('converts exactly enough to fill the 12% bracket', () => {
    const y = projectPlan(converter(), 2026).years[0]
    // 16,100 standard deduction + 50,400 = 66,500 of conversion income
    expect(y.rothConversion).toBeCloseTo(66_500, -1)
    const check = federalIncomeTax({ ordinaryIncome: y.rothConversion, socialSecurity: 0, age: 62, year: 2026, status: 'single', priceLevel: 1 })
    expect(check.taxableOrdinary).toBeLessThanOrEqual(50_401)
  })

  it('moves the money into a Roth account (created if needed)', () => {
    const years = projectPlan(converter(), 2026).years
    expect(years[1].startByBucketReal.roth).toBeCloseTo(years[0].rothConversion, -1)
  })

  it('only converts inside the chosen ages', () => {
    const years = projectPlan(converter(), 2026).years
    expect(years.find((y) => y.age === 64)!.rothConversion).toBeGreaterThan(0)
    expect(years.find((y) => y.age === 65)!.rothConversion).toBe(0)
  })

  it('accounts for Social Security becoming taxable', () => {
    const y = projectPlan(converter({}, { socialSecurityAtFRA: 2_000, socialSecurityClaimAge: 62 }), 2026).years[0]
    const check = federalIncomeTax({ ordinaryIncome: y.rothConversion, socialSecurity: 2_000 * 0.7 * 12, age: 62, year: 2026, status: 'single', priceLevel: 1 })
    expect(check.taxableOrdinary).toBeGreaterThan(50_000)
    expect(check.taxableOrdinary).toBeLessThanOrEqual(50_401)
  })

  it('can stay under the first IRMAA threshold from age 63', () => {
    // Filling the 24% bracket would push MAGI far above $109k
    const years = projectPlan(converter({ fillToRate: 0.24, stayUnderIrmaa: true, fromAge: 62, toAge: 66 }), 2026).years
    expect(years.find((y) => y.age === 62)!.magi).toBeGreaterThan(109_000) // 62: doesn't affect Medicare yet
    expect(years.find((y) => y.age === 63)!.magi).toBeLessThanOrEqual(109_000)
    expect(years.find((y) => y.age === 65)!.irmaa).toBe(0)
  })

  it('shrinks later RMDs', () => {
    const at75 = (p: Plan) => projectPlan(p, 2026).years.find((y) => y.age === 75)!.rmd
    const without = converter({}, { rothConversion: { enabled: false, fillToRate: 0.12, fromAge: 0, toAge: 0, stayUnderIrmaa: false } })
    expect(at75(converter({ toAge: 72 }))).toBeLessThan(at75(without))
  })
})
