import { describe, expect, it } from 'vitest'
import { breakEvenAge, claimingAge, collected, CLAIMING_DEFAULTS } from './claimingAge'

describe('Social Security claiming age', () => {
  it('pays 70% at 62, 100% at 67 and 124% at 70', () => {
    const { options } = claimingAge(CLAIMING_DEFAULTS)
    expect(options.map((o) => o.age)).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70])
    expect(options[0].shareOfFull).toBeCloseTo(0.7, 6)
    expect(options[5].shareOfFull).toBeCloseTo(1, 6)
    expect(options[8].shareOfFull).toBeCloseTo(1.24, 6)
  })

  it('finds the break-even ages by simple totals (no return)', () => {
    // 0.70 (x - 62) = 1.00 (x - 67), 1.00 (x - 67) = 1.24 (x - 70), 0.70 (x - 62) = 1.24 (x - 70)
    const { breakEven } = claimingAge(CLAIMING_DEFAULTS)
    expect(breakEven.from62to67).toBeCloseTo(23.6 / 0.3, 3)
    expect(breakEven.from67to70).toBeCloseTo(19.8 / 0.24, 3)
    expect(breakEven.from62to70).toBeCloseTo(43.4 / 0.54, 3)
  })

  it('adds up lifetime totals and picks the best age for the plan age', () => {
    const r = claimingAge(CLAIMING_DEFAULTS)
    expect(r.options[5].lifetime).toBeCloseTo(2000 * 12 * (90 - 67), 6)
    // Living to 90 is past every break-even, so waiting to 70 collects the most
    expect(r.best.age).toBe(70)
    // Dying at 75 is before every break-even, so 62 collects the most
    expect(claimingAge({ ...CLAIMING_DEFAULTS, planToAge: 75 }).best.age).toBe(62)
  })

  it('a return on the earlier money pushes the break-even later', () => {
    const plain = breakEvenAge(2000, 62, 70, 0)!
    const withReturn = breakEvenAge(2000, 62, 70, 0.03)!
    expect(withReturn).toBeGreaterThan(plain + 1)
    // Discounted totals are smaller than plain ones, and the same with no return
    expect(collected(2000, 62, 90, 0.03)).toBeLessThan(collected(2000, 62, 90, 0))
    expect(collected(2000, 62, 90, 0)).toBe(2000 * 12 * 28)
  })

  it('no benefit, or a break-even past 110, reads as never', () => {
    expect(breakEvenAge(0, 62, 70, 0)).toBeNull()
    expect(breakEvenAge(2000, 62, 70, 0.2)).toBeNull()
  })
})
