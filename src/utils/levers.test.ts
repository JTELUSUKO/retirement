import { describe, expect, it } from 'vitest'
import { examplePlan } from '../store/planStore'
import { applyScenario } from '../engine'
import { articleFor, leverVariants, spendMoreVariant, verdictFor, withArticle } from './levers'
import { SCENARIO_PRESETS } from './scenarioPresets'

describe('levers', () => {
  it('offers retire later, spend less, claim at 70 and guardrails for the example plan', () => {
    const levers = leverVariants(examplePlan)
    expect(levers.map((l) => l.key)).toEqual(['later', 'spend-less', 'ss70', 'guardrails'])
    expect(levers[0].plan.retirementAge).toBe(examplePlan.retirementAge + 2)
    expect(levers[1].plan.annualSpending).toBe(54_000)
    expect(levers[2].plan.socialSecurityClaimAge).toBe(70)
    expect(levers[3].plan.spendingRule.type).toBe('guardrails')
  })

  it('skips levers that don’t apply', () => {
    const plan = { ...examplePlan, socialSecurityClaimAge: 70, spendingRule: { ...examplePlan.spendingRule, type: 'guardrails' as const } }
    expect(leverVariants(plan).map((l) => l.key)).toEqual(['later', 'spend-less'])
  })

  it('checks spending 10% more for strong plans', () => {
    expect(spendMoreVariant(examplePlan).plan.annualSpending).toBe(66_000)
  })

  it('labels the verdict like the dashboard does', () => {
    expect([verdictFor(0.9), verdictFor(0.75), verdictFor(0.5)]).toEqual(['strong', 'borderline', 'at-risk'])
    expect(verdictFor(0.849)).toBe('strong') // shown as 85%
  })

  it('uses "an" before percentages that start with a vowel sound', () => {
    expect([64, 85, 8, 11, 18, 100, 1].map(withArticle)).toEqual(['a 64%', 'an 85%', 'an 8%', 'an 11%', 'an 18%', 'a 100%', 'a 1%'])
  })
})

describe('levers match the Compare presets', () => {
  it('tests exactly the change that Compare adds', () => {
    for (const lever of leverVariants(examplePlan).filter((l) => l.preset)) {
      const change = SCENARIO_PRESETS.find((p) => p.key === lever.preset)!.make(examplePlan)
      expect(lever.plan).toEqual(applyScenario(examplePlan, { ...change, id: 'lever', slot: 1 }))
    }
  })

  it('picks the article on its own', () => {
    expect([8, 64, 85].map(articleFor)).toEqual(['an', 'a', 'an'])
  })
})
