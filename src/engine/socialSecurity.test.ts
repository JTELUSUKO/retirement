import { describe, expect, it } from 'vitest'
import { benefitAtClaimAge } from './socialSecurity'

describe('benefitAtClaimAge', () => {
  it('returns the full benefit at 67', () => {
    expect(benefitAtClaimAge(2000, 67)).toBeCloseTo(2000)
  })

  it('reduces the benefit by 30% at 62', () => {
    expect(benefitAtClaimAge(2000, 62)).toBeCloseTo(1400)
  })

  it('increases the benefit by 24% at 70', () => {
    expect(benefitAtClaimAge(2000, 70)).toBeCloseTo(2480)
  })

  it('clamps ages outside 62–70', () => {
    expect(benefitAtClaimAge(2000, 75)).toBeCloseTo(2480)
    expect(benefitAtClaimAge(2000, 55)).toBeCloseTo(1400)
  })
})
