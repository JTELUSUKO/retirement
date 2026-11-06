import { describe, expect, it } from 'vitest'
import { runMonteCarlo, TAX_CONFIG } from '../engine'
import { basePlan } from '../engine/testFixtures'
import type { Plan } from '../engine'
import { HEAT_BANDS, heatBand, heatCellPatch, heatKey, heatmapGrid } from './heatmap'
import { verdictFor } from './levers'

const plan: Plan = { ...basePlan, currentAge: 55, retirementAge: 65, lifeExpectancy: 95, socialSecurityClaimAge: 67, socialSecurityAtFRA: 2500 }
const cellOf = (p: Plan, retire: number, claim: number) => heatmapGrid(p).cells.find((c) => c.key === heatKey(retire, claim))!

describe('heatmap grid', () => {
  it('runs from your age to 70 by every claiming age, highest claiming age first', () => {
    const { retireAges, claimAges, cells } = heatmapGrid(plan)
    expect([retireAges[0], retireAges.at(-1)]).toEqual([55, 70])
    expect(claimAges[0]).toBe(TAX_CONFIG.socialSecurity.latestClaimAge)
    expect(claimAges.at(-1)).toBe(TAX_CONFIG.socialSecurity.earliestClaimAge)
    expect(cells).toHaveLength(16 * 9)
  })

  it("the plan's own cell is exactly the plan, so it matches the headline chance", () => {
    const cell = cellOf(plan, 65, 67)
    expect(runMonteCarlo(cell.plan!).successRate).toBe(runMonteCarlo(plan).successRate)
  })

  it('stops before the plan ends and keeps a retirement age past 70', () => {
    expect(heatmapGrid({ ...plan, retirementAge: 60, lifeExpectancy: 66 }).retireAges.at(-1)).toBe(65)
    const late = heatmapGrid({ ...plan, currentAge: 60, retirementAge: 74 }).retireAges
    expect([late[0], late.at(-1)]).toEqual([60, 74])
  })

  it('a young plan shows at most 16 columns, around its retirement age', () => {
    const { retireAges } = heatmapGrid({ ...plan, currentAge: 30, retirementAge: 50, socialSecurityClaimAge: 67 })
    expect(retireAges).toHaveLength(16)
    expect([retireAges[0], retireAges.at(-1)]).toEqual([45, 60])
  })

  it("leaves out claiming ages already past, but keeps the plan's own", () => {
    const { claimAges } = heatmapGrid({ ...plan, currentAge: 66, retirementAge: 66, socialSecurityClaimAge: 62 })
    expect(claimAges).toEqual([70, 69, 68, 67, 66, 62])
  })

  it('marks a claim before retiring, not one at or after', () => {
    expect(cellOf(plan, 67, 62).claimsBeforeRetiring).toBe(true)
    expect(cellOf(plan, 67, 67).claimsBeforeRetiring).toBe(false)
    expect(cellOf(plan, 62, 67).claimsBeforeRetiring).toBe(false)
  })

  it("marks a spouse's benefit that starts before you retire, by your age at the time", () => {
    // Your spouse is 5 years older: claiming at 65 is your age 60
    const couple: Plan = { ...plan, filingStatus: 'married', spouseCurrentAge: 60, spouseClaimAge: 65, spouseSocialSecurityAtFRA: 1500 }
    expect(cellOf(couple, 67, 67).claimsBeforeRetiring).toBe(true)
    expect(cellOf(couple, 60, 67).claimsBeforeRetiring).toBe(false)
    expect(cellOf({ ...couple, spouseSocialSecurityAtFRA: 0 }, 67, 67).claimsBeforeRetiring).toBe(false)
  })

  it('marks nothing when retiring now, with no working years to miss a benefit in', () => {
    expect(cellOf({ ...plan, currentAge: 66, retirementAge: 66, socialSecurityClaimAge: 62 }, 66, 62).claimsBeforeRetiring).toBe(false)
  })

  it('a combination the plan rules out has no plan to simulate', () => {
    const annuity = { ...plan.annuityPurchase, enabled: true, amount: 100_000, purchaseAge: 66 }
    const withAnnuity = { ...plan, annuityPurchase: annuity }
    expect(cellOf(withAnnuity, 68, 67).plan).toBeNull()
    expect(cellOf(withAnnuity, 64, 67).plan).not.toBeNull()
  })
})

describe('applying a cell', () => {
  it('changes only the ages it moved, onto the latest plan', () => {
    const base = { ...plan, annuityPurchase: { ...plan.annuityPurchase, purchaseAge: 0 } }
    const latest = { ...base, annualSpending: 99_000 }
    expect(heatCellPatch(latest, base, cellOf(base, 60, 67))).toEqual({ retirementAge: 60 })
    expect(heatCellPatch(latest, base, cellOf(base, 65, 70))).toEqual({ socialSecurityClaimAge: 70 })
    expect(heatCellPatch(latest, base, cellOf(base, 65, 67))).toEqual({})
  })

  it('applying gives the plan the cell simulated, including an annuity bought at retirement', () => {
    const annuity = { ...plan.annuityPurchase, enabled: true, amount: 100_000, purchaseAge: 65 }
    const withAnnuity = { ...plan, annuityPurchase: annuity }
    const cell = cellOf(withAnnuity, 68, 70)
    const applied = { ...withAnnuity, ...heatCellPatch(withAnnuity, withAnnuity, cell) }
    expect(applied.annuityPurchase.purchaseAge).toBe(68)
    expect(runMonteCarlo(applied).successRate).toBe(runMonteCarlo(cell.plan!).successRate)
  })
})

describe('heatmap colors', () => {
  it('cover every percentage, judged as rounded', () => {
    expect(HEAT_BANDS.at(-1)!.upTo).toBe(100)
    expect(heatBand(0).label).toBe('Under 50%')
    expect(heatBand(0.496).label).toBe('50–69%')
    expect(heatBand(1).label).toBe('95%+')
  })

  it("change at the verdict's lines, so a color never disagrees with the verdict", () => {
    const [atRisk, borderline, strong] = [HEAT_BANDS[1].upTo, HEAT_BANDS[2].upTo, HEAT_BANDS[3].upTo]
    expect(verdictFor(atRisk / 100)).toBe('at-risk')
    expect(verdictFor((atRisk + 1) / 100)).toBe('borderline')
    expect(verdictFor(borderline / 100)).toBe('borderline')
    expect(verdictFor((borderline + 1) / 100)).toBe('strong')
    expect(verdictFor(strong / 100)).toBe('strong')
  })
})
