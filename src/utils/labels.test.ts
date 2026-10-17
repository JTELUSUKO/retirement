import { describe, expect, it } from 'vitest'
import { basePlan } from '../engine/testFixtures'
import { describeScenario } from './labels'

describe('describeScenario', () => {
  it('lists only what the scenario changes', () => {
    const text = describeScenario(basePlan, {
      id: 'x', name: 'X', overrides: { retirementAge: 63, socialSecurityClaimAge: 70 }, stress: 'crash', slot: 1,
    })
    expect(text).toBe('Retire at 63; Social Security at 70; 30% crash in first retirement year')
  })

  it('describes an early death or both living', () => {
    const d = (age: number) => describeScenario(basePlan, { id: 'x', name: 'X', overrides: { survivorDeathAge: age }, stress: 'none', slot: 1 })
    expect(d(75)).toBe('One spouse dies at 75')
    expect(d(0)).toBe('Both live')
  })

  it('says when nothing changes', () => {
    expect(describeScenario(basePlan, { id: 'x', name: 'X', overrides: {}, stress: 'none', slot: 1 })).toBe('No changes')
  })
})
