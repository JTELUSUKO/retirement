import { describe, expect, it } from 'vitest'
import { basePlan } from './testFixtures'
import { validatePlan } from './validation'

const fields = (plan: typeof basePlan) => validatePlan(plan).map((i) => i.field)

describe('validatePlan', () => {
  it('accepts a sensible plan', () => {
    expect(validatePlan(basePlan)).toEqual([])
  })

  it('rejects retiring before today', () => {
    expect(fields({ ...basePlan, retirementAge: 55 })).toContain('retirementAge')
  })

  it('rejects a planning age at or before retirement', () => {
    expect(fields({ ...basePlan, lifeExpectancy: 60 })).toContain('lifeExpectancy')
  })

  it('rejects an unrealistic current age (e.g. a cleared field)', () => {
    expect(fields({ ...basePlan, currentAge: 0 })).toContain('currentAge')
  })

  it('rejects Social Security claim ages outside 62–70', () => {
    expect(fields({ ...basePlan, socialSecurityClaimAge: 72 })).toContain('socialSecurityClaimAge')
  })

  it('rejects negative amounts', () => {
    expect(fields({ ...basePlan, annualSpending: -1 })).toContain('accounts')
  })
})
