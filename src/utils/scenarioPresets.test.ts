import { describe, expect, it } from 'vitest'
import { examplePlan } from '../store/planStore'
import { SCENARIO_PRESETS } from './scenarioPresets'

const preset = SCENARIO_PRESETS.find((p) => p.key === 'early-death')!

describe('early-death preset', () => {
  it('is offered only to married couples', () => {
    expect(preset.when!(examplePlan)).toBe(false)
    expect(preset.when!({ ...examplePlan, filingStatus: 'married' })).toBe(true)
  })

  it('picks ten years into retirement, kept inside the plan', () => {
    expect(preset.make({ ...examplePlan, retirementAge: 65 }).overrides.survivorDeathAge).toBe(75)
    expect(preset.make({ ...examplePlan, retirementAge: 65, lifeExpectancy: 72 }).overrides.survivorDeathAge).toBe(71)
  })
})
