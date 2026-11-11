import { describe, expect, it } from 'vitest'
import { projectPlan, runMonteCarlo, TAX_CONFIG } from '../engine'
import { basePlan } from '../engine/testFixtures'
import type { Plan } from '../engine'
import { claimsWhileWorking, HEAT_BANDS, heatBand, heatCellPatch, heatCheer, heatDelta, heatKey, heatmapGrid, heatUndoPatch, nearestStrong, showsClaimingWhileWorking, showsRetiringEarly } from './heatmap'
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

  it('notices a claim while still working, not one at or after retiring', () => {
    expect(claimsWhileWorking(plan, 67, 62)).toBe(true)
    expect(claimsWhileWorking(plan, 67, 67)).toBe(false)
    expect(claimsWhileWorking(plan, 62, 67)).toBe(false)
    expect(showsClaimingWhileWorking(heatmapGrid(plan), plan)).toBe(true)
  })

  it("notices a spouse's benefit that starts while you still work, by your age at the time", () => {
    // Your spouse is 5 years older: claiming at 65 is your age 60
    const couple: Plan = { ...plan, filingStatus: 'married', spouseCurrentAge: 60, spouseClaimAge: 65, spouseSocialSecurityAtFRA: 1500 }
    expect(claimsWhileWorking(couple, 67, 67)).toBe(true)
    expect(claimsWhileWorking(couple, 60, 67)).toBe(false)
    expect(claimsWhileWorking({ ...couple, spouseSocialSecurityAtFRA: 0 }, 67, 67)).toBe(false)
  })

  it('notices nothing when retiring now, with no working years left', () => {
    const now = { ...plan, currentAge: 66, retirementAge: 66, socialSecurityClaimAge: 62 }
    expect(claimsWhileWorking(now, 66, 62)).toBe(false)
  })

  it('a cell that claims while working counts the benefits paid before retiring', () => {
    const paid: Plan = { ...plan, currentAge: 62, retirementAge: 66, annualPay: 20_000 }
    const withPay = projectPlan(cellOf(paid, 66, 62).plan!).balanceAtRetirement
    const withheld = projectPlan(cellOf({ ...paid, annualPay: 0 }, 66, 62).plan!).balanceAtRetirement
    expect(withPay).toBeGreaterThan(withheld + 4 * 12 * 1_000)
  })

  it('notices retiring before full retirement age, only in cells that can be tested', () => {
    expect(showsRetiringEarly(heatmapGrid(plan), plan)).toBe(true)
    const at66 = { ...plan, currentAge: 66, retirementAge: 66 }
    expect(showsRetiringEarly(heatmapGrid(at66), at66)).toBe(true)
    const at67 = { ...plan, currentAge: 67, retirementAge: 67 }
    expect(showsRetiringEarly(heatmapGrid(at67), at67)).toBe(false)
    const grid = heatmapGrid(plan)
    const ruledOut = { ...grid, cells: grid.cells.map((c) => (c.retirementAge < 67 ? { ...c, plan: null } : c)) }
    expect(showsRetiringEarly(ruledOut, plan)).toBe(false)
  })

  it('notices a younger spouse who stops work before full retirement age when you do not', () => {
    // You're 67 and retire now or later; your spouse is 62 with a benefit of their own
    const couple: Plan = { ...plan, currentAge: 67, retirementAge: 68, filingStatus: 'married', spouseCurrentAge: 62, spouseSocialSecurityAtFRA: 1500 }
    expect(showsRetiringEarly(heatmapGrid(couple), couple)).toBe(true)
    const noBenefit = { ...couple, spouseSocialSecurityAtFRA: 0 }
    expect(showsRetiringEarly(heatmapGrid(noBenefit), noBenefit)).toBe(false)
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

describe('undoing a cell', () => {
  it('restores everything the cell changed, including an annuity bought at retirement', () => {
    const start = { ...plan, annuityPurchase: { ...plan.annuityPurchase, enabled: true, amount: 100_000, purchaseAge: 65 } }
    const patch = heatCellPatch(start, start, cellOf(start, 68, 70))
    const applied = { ...start, ...patch }
    expect(applied.annuityPurchase.purchaseAge).toBe(68)
    expect({ ...applied, ...heatUndoPatch(patch, start) }).toEqual(start)
  })

  it('touches only what the cell changed', () => {
    const base = { ...plan, annuityPurchase: { ...plan.annuityPurchase, purchaseAge: 0 } }
    const patch = heatCellPatch(base, base, cellOf(base, 65, 70))
    expect(heatUndoPatch(patch, base)).toEqual({ socialSecurityClaimAge: 67 })
  })
})

describe('a cell against the plan', () => {
  it('compares the percentages shown, either way', () => {
    expect(heatDelta(0.8, 0.7)).toEqual({ points: 10, same: false })
    expect(heatDelta(0.6, 0.7)).toEqual({ points: -10, same: false })
  })

  it('calls a difference within the noise about the same, in either direction', () => {
    expect(heatDelta(0.72, 0.7).same).toBe(true)
    expect(heatDelta(0.68, 0.7).same).toBe(true)
    expect(heatDelta(0.7, 0.7)).toEqual({ points: 0, same: true })
    expect(heatDelta(0.73, 0.7).same).toBe(false)
  })
})

describe('closest combination that reaches strong', () => {
  const grid = heatmapGrid(plan)
  const key = heatKey

  it('takes the fewest years of change, and the higher chance on a tie', () => {
    const values = { [key(70, 70)]: 0.99, [key(67, 67)]: 0.86, [key(65, 69)]: 0.9, [key(66, 67)]: 0.5 }
    const cell = nearestStrong(grid, values, plan)!
    expect([cell.retirementAge, cell.claimAge]).toEqual([65, 69])
  })

  it('judges a cell on the rounded percentage shown, like the headline', () => {
    expect(nearestStrong(grid, { [key(66, 62)]: 0.844 }, plan)).toBeNull()
    const cell = nearestStrong(grid, { [key(66, 62)]: 0.845 }, plan)!
    expect([cell.retirementAge, cell.claimAge]).toEqual([66, 62])
  })

  it('is null when nothing reaches strong', () => {
    expect(nearestStrong(grid, { [key(65, 67)]: 0.6 }, plan)).toBeNull()
    expect(nearestStrong(grid, {}, plan)).toBeNull()
  })
})

describe('encouragement', () => {
  it('celebrates reaching a better verdict', () => {
    expect(heatCheer(86, 64)).toEqual({ emoji: '🎉', text: 'Great result! This moves your plan from at risk to strong.' })
    expect(heatCheer(87, 84)!.text).toBe('Great result! This moves your plan from borderline to strong.')
    expect(heatCheer(81, 64)).toEqual({ emoji: '👍', text: 'Nice step forward. This moves your plan from at risk to borderline.' })
  })

  it('stays honest about a gain that leaves the verdict where it was', () => {
    expect(heatCheer(95, 90)!.text).toBe('Even stronger. This adds to your cushion.')
    expect(heatCheer(69, 60)!.text).toBe('A good gain, though still at risk.')
    expect(heatCheer(80, 72)!.text).toBe('A good gain, though still borderline.')
  })

  it('says nothing for a loss, no change, or a tiny gain, even a strong one', () => {
    expect(heatCheer(60, 64)).toBeNull()
    expect(heatCheer(64, 64)).toBeNull()
    expect(heatCheer(68, 64)).toBeNull()
    expect(heatCheer(86, 85)).toBeNull()
  })

  it('says nothing for a gain within the noise, even one that crosses a verdict line', () => {
    expect(heatCheer(85, 84)).toBeNull()
    expect(heatCheer(71, 69)).toBeNull()
  })

  it('never calls the choice itself right', () => {
    for (const [cell, plan] of [[86, 64], [81, 64], [95, 90], [69, 60]]) {
      expect(heatCheer(cell, plan)!.text).not.toMatch(/choice|choose|chose|should|right/i)
    }
  })
})

describe('heatmap colors', () => {
  it('cover every percentage, judged as rounded', () => {
    expect(HEAT_BANDS.at(-1)!.upTo).toBe(100)
    expect(heatBand(0).label).toBe('Under 50%')
    expect(heatBand(0.496).label).toBe('50–69%')
    expect(heatBand(0.845).label).toBe('85–94%')
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
