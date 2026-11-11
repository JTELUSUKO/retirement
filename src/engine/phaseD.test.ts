import { describe, expect, it } from 'vitest'
import { TAX_CONFIG } from './config/taxYear'
import { projectPlan } from './projection'
import { benefitAtClaimAge } from './socialSecurity'
import { spousalFactor } from './survivor'
import { basePlan } from './testFixtures'
import type { Account, Plan } from './types'

const account = (type: Account['type'], balance: number, extra: Partial<Account> = {}): Account => ({
  id: type, name: type, type, balance, annualContribution: 0, employerMatch: 0, costBasis: null, ...extra,
})

describe('Roth withdrawals before 59½', () => {
  // Retired, spending $40k, no growth or inflation
  const early = (age: number, roth: Account): Plan => ({ ...basePlan, currentAge: age, retirementAge: age, lifeExpectancy: age + 5, annualSpending: 40_000, accounts: [roth] })

  it('takes contributions out first, untaxed', () => {
    const y = projectPlan(early(50, account('roth', 500_000, { costBasis: 300_000 })), 2026).years[0]
    expect(y.withdrawal).toBeCloseTo(40_000, 0)
    expect(y.tax).toBe(0)
  })

  it('taxes and penalizes earnings once contributions are used up', () => {
    const years = projectPlan(early(50, account('roth', 500_000, { costBasis: 50_000 })), 2026).years
    // Year one: $40,000 of the $50,000 contributed
    expect(years[0].tax).toBe(0)
    // Year two: the last $10,000 contributed, then earnings, including what pays the tax
    const earnings = years[1].withdrawal - 10_000
    expect(earnings).toBeGreaterThan(30_000)
    expect(years[1].earlyWithdrawalPenalty).toBeCloseTo(0.1 * earnings, 0)
    expect(years[1].federalTax).toBeGreaterThan(years[1].earlyWithdrawalPenalty)
  })

  it('treats the balance as contributed when contributions are left empty, so only later growth is earnings', () => {
    const y = projectPlan(early(50, account('roth', 500_000)), 2026).years[0]
    expect(y.tax).toBe(0)
  })

  it('leaves earnings untaxed from the year you turn 59', () => {
    const y = projectPlan(early(59, account('roth', 500_000, { costBasis: 1 })), 2026).years[0]
    expect(y.tax).toBe(0)
  })

  it('counts your own contributions while working, but not the match', () => {
    const plan: Plan = {
      ...early(49, account('roth', 100_000, { costBasis: 1, annualContribution: 30_000, employerMatch: 30_000 })),
      retirementAge: 50,
    }
    // At 50: $30,000 contributed comes out untaxed, the other $10,000 (and its tax) is earnings
    const y = projectPlan(plan, 2026).years[1]
    expect(y.earlyWithdrawalPenalty).toBeCloseTo(0.1 * (y.withdrawal - 30_000), 0)
    expect(y.earlyWithdrawalPenalty).toBeGreaterThan(0)
  })
})

describe('Social Security that starts before you retire', () => {
  const { earningsLimit, fullRetirementAge } = TAX_CONFIG.socialSecurity
  // Works to 66, claims at 62, $2,000 a month at 67; no growth or inflation
  const working = (extra: Partial<Plan> = {}): Plan => ({
    ...basePlan, currentAge: 62, retirementAge: 66, lifeExpectancy: 72, socialSecurityAtFRA: 2_000, socialSecurityClaimAge: 62, ...extra,
  })
  const reduced = benefitAtClaimAge(2_000, 62) * 12

  it('withholds every benefit before full retirement age when pay is not entered, then credits the months back', () => {
    const years = projectPlan(working(), 2026).years
    expect(years[0].income).toBe(0)
    // Retired at 66, still under 67: the reduced benefit
    expect(years[4].income).toBeCloseTo(reduced, 0)
    // From 67: as if claimed at 66, after four years withheld
    expect(years[5].income).toBeCloseTo(benefitAtClaimAge(2_000, 66) * 12, 0)
  })

  it('pays the whole benefit while working when pay is under the limit, and reinvests what is left after tax', () => {
    const y = projectPlan(working({ annualPay: earningsLimit }), 2026).years[0]
    expect(y.income).toBeCloseTo(reduced, 0)
    expect(y.surplusReinvested).toBeCloseTo(reduced - y.tax, 0)
    expect(y.balance).toBeCloseTo(100_000 + y.surplusReinvested, 0)
  })

  it('withholds $1 for every $2 of pay over the limit, and taxes what is paid on top of pay', () => {
    const years = projectPlan(working({ annualPay: earningsLimit + 10_000 }), 2026).years
    expect(years[0].income).toBeCloseTo(reduced - 5_000, 0)
    expect(years[0].tax).toBeGreaterThan(0)
    expect(years[0].tax).toBeLessThan(0.85 * years[0].income * 0.37)
    // Four years of $5,000 withheld is 20,000 / 1,400 months, credited at 67
    const credited = benefitAtClaimAge(2_000, 62 + 20_000 / (reduced / 12) / 12) * 12
    expect(years[fullRetirementAge - 62].income).toBeCloseTo(credited, 0)
  })

  it('has no earnings limit from full retirement age, and a plan claiming after retiring is unchanged', () => {
    const late = projectPlan(working({ currentAge: 67, retirementAge: 69, socialSecurityClaimAge: 67, lifeExpectancy: 75 }), 2026).years[0]
    expect(late.income).toBeCloseTo(24_000, 0)
    expect(late.tax).toBeCloseTo(0.22 * 0.85 * 24_000, 0)
    const retired = projectPlan(working({ retirementAge: 62 }), 2026).years[0]
    expect(retired.income).toBeCloseTo(reduced, 0)
  })

  it('applies each spouse’s own pay to their own benefit', () => {
    const couple = working({ filingStatus: 'married', spouseCurrentAge: 62, spouseSocialSecurityAtFRA: 2_000, spouseClaimAge: 62, annualPay: 200_000, spouseAnnualPay: earningsLimit })
    expect(projectPlan(couple, 2026).years[0].income).toBeCloseTo(reduced, 0)
  })
})

describe('Withheld-month credits and pay, in the cases a review found', () => {
  const { fullRetirementAge } = TAX_CONFIG.socialSecurity
  // Both 62 and claiming at 62; work to 66 with pay not entered, so four years are withheld
  const couple = (extra: Partial<Plan> = {}): Plan => ({
    ...basePlan, currentAge: 62, retirementAge: 66, lifeExpectancy: 80, filingStatus: 'married', spouseCurrentAge: 62,
    socialSecurityAtFRA: 2_000, socialSecurityClaimAge: 62, spouseSocialSecurityAtFRA: 2_000, spouseClaimAge: 62, ...extra,
  })
  const at = (plan: Plan, age: number) => projectPlan(plan, 2026).years[age - plan.currentAge]

  it('keeps the credit for withheld months after a spouse dies', () => {
    const widowed = couple({ survivor: { ...basePlan.survivor, enabled: true, whoDies: 'spouse', firstDeathAge: 75 } })
    const credited = benefitAtClaimAge(2_000, 66) * 12
    expect(at(widowed, 70).income).toBeCloseTo(2 * credited, 0)
    // Equal records: the survivor keeps one credited benefit, not the age-62 amount
    expect(at(widowed, 76).income).toBeCloseTo(credited, 0)
  })

  it('credits a spousal top-up by its own reduction, not the worker’s', () => {
    // Spouse has no record of their own: all top-up, 65% at 62 and, after four years withheld, as if started at 66
    const topUp = couple({ spouseSocialSecurityAtFRA: 0 })
    const own = benefitAtClaimAge(2_000, 66) * 12
    expect(at(topUp, fullRetirementAge).income - own).toBeCloseTo(1_000 * spousalFactor(66) * 12, 0)
  })

  it('uses the flat tax assumption unless everyone working has pay entered', () => {
    const late = (extra: Partial<Plan>) => at(couple({ currentAge: 67, spouseCurrentAge: 67, retirementAge: 69, socialSecurityClaimAge: 67, spouseClaimAge: 67, ...extra }), 67)
    const flat = 0.22 * 0.85 * 48_000
    expect(late({}).tax).toBeCloseTo(flat, 0)
    // The spouse isn't working (1), your pay is missing: $1 of pay is not the household's income
    expect(late({ spouseAnnualPay: 1 }).tax).toBeCloseTo(flat, 0)
    expect(late({ annualPay: 150_000, spouseAnnualPay: 1 }).tax).toBeGreaterThan(0)
    expect(late({ annualPay: 150_000, spouseAnnualPay: 1 }).tax).not.toBeCloseTo(flat, 0)
  })

  it('takes pre-tax contributions off pay before taxing benefits', () => {
    const single = (accounts: Account[]) => at({ ...basePlan, currentAge: 67, retirementAge: 69, lifeExpectancy: 75, socialSecurityAtFRA: 2_000, socialSecurityClaimAge: 67, annualPay: 40_000, accounts }, 67)
    expect(single([account('401k', 100_000, { annualContribution: 20_000 })]).tax).toBeLessThan(single([account('roth', 100_000, { annualContribution: 20_000 })]).tax)
  })

  it('charges no Medicare surcharge in the first retired years for pay earned before retiring', () => {
    const plan: Plan = { ...basePlan, currentAge: 64, retirementAge: 66, lifeExpectancy: 75, annualPay: 300_000 }
    expect(at(plan, 66).irmaa).toBe(0)
  })
})
