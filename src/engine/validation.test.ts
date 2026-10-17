import { describe, expect, it } from 'vitest'
import { basePlan } from './testFixtures'
import { missingEssentials, validatePlan } from './validation'

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

  it('rejects an unrealistic current age', () => {
    expect(fields({ ...basePlan, currentAge: 12 })).toContain('currentAge')
  })

  it('asks for blank ages without confusing comparisons', () => {
    const issues = validatePlan({ ...basePlan, currentAge: 0, retirementAge: 0 })
    expect(issues.map((i) => i.message)).toEqual(['Enter your age.', 'Enter the age you plan to retire.'])
  })

  it('lists missing essentials for a blank plan', () => {
    expect(missingEssentials({ ...basePlan, currentAge: 0, lifeExpectancy: 0, annualSpending: 0 })).toHaveLength(3)
    expect(missingEssentials(basePlan)).toEqual([])
  })

  it('rejects Social Security claim ages outside 62–70', () => {
    expect(fields({ ...basePlan, socialSecurityClaimAge: 72 })).toContain('socialSecurityClaimAge')
  })

  it('rejects negative amounts', () => {
    expect(fields({ ...basePlan, annualSpending: -1 })).toContain('accounts')
  })
})
