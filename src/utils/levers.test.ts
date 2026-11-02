import { describe, expect, it } from 'vitest'
import { examplePlan } from '../store/planStore'
import { applyScenario, mixReturns } from '../engine'
import { articleFor, leverVariants, patchFor, spendMoreVariant, verdictFor, withArticle } from './levers'
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

  it('tests a balanced mix after retiring only when the plan uses a more cautious preset', () => {
    const withMix = (share: number) => {
      const m = mixReturns(share)
      return { ...examplePlan, assumptions: { ...examplePlan.assumptions, returnPostRetirement: m.mean, volatilityPostRetirement: m.volatility } }
    }
    const mix = leverVariants(withMix(0.4)).find((l) => l.key === 'mix')!
    expect(mix.label).toBe('Invest 60% stocks / 40% bonds after retiring instead of 40% stocks / 60% bonds (bigger ups and downs)')
    expect(mix.plan.assumptions.returnPostRetirement).toBeCloseTo(mixReturns(0.6).mean)
    expect(patchFor(withMix(0.4), mix.patch!)!.assumptions!.volatilityPostRetirement).toBeCloseTo(mixReturns(0.6).volatility)
    // The mix changed since it was tested: the button leaves it alone
    expect(patchFor(withMix(0.8), mix.patch!)).toBeNull()
    // Already balanced or more, or a custom mix (the example plan): not tested
    for (const plan of [withMix(0.6), withMix(1), examplePlan]) expect(leverVariants(plan).map((l) => l.key)).not.toContain('mix')
  })

  it('can be sent to a simulation worker (no functions)', () => {
    const plan = { ...examplePlan, assumptions: { ...examplePlan.assumptions, ...{ returnPostRetirement: mixReturns(0.4).mean, volatilityPostRetirement: mixReturns(0.4).volatility } } }
    for (const lever of [...leverVariants(plan), spendMoreVariant(plan)]) expect(() => structuredClone(lever)).not.toThrow()
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
    const levers = leverVariants(examplePlan).filter((l) => l.change)
    expect(levers.map((l) => l.key)).toEqual(['later', 'spend-less', 'ss70'])
    for (const lever of levers) {
      const change = SCENARIO_PRESETS.find((p) => p.key === lever.key)!.make(examplePlan)
      expect(lever.change).toEqual(change)
      expect(lever.plan).toEqual(applyScenario(examplePlan, { ...lever.change!, id: 'lever', slot: 1 }))
    }
  })

  it('picks the article on its own', () => {
    expect([8, 64, 85].map(articleFor)).toEqual(['an', 'a', 'an'])
  })
})
