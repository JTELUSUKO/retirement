import { describe, expect, it } from 'vitest'
import { runMonteCarlo } from './monteCarlo'
import { projectPlan } from './projection'
import { applyScenario, CRASH_RETURN, stressAdjust, type Scenario } from './scenarios'
import { basePlan } from './testFixtures'
import type { Plan } from './types'

const scenario = (extra: Partial<Scenario>): Scenario => ({ id: 's', name: 'S', overrides: {}, stress: 'none', slot: 1, ...extra })

// Working from 55, retiring at 60, $500k growing at 5%, inflation 2%
const plan: Plan = {
  ...basePlan,
  currentAge: 55,
  retirementAge: 60,
  lifeExpectancy: 90,
  annualSpending: 30_000,
  accounts: [{ ...basePlan.accounts[0], type: 'roth', balance: 500_000 }],
  assumptions: { ...basePlan.assumptions, returnPreRetirement: 0.05, returnPostRetirement: 0.05, inflation: 0.02 },
}

describe('applyScenario', () => {
  it('changes only the overridden fields', () => {
    const p = applyScenario(plan, scenario({ overrides: { retirementAge: 62, annualSpending: 25_000 } }))
    expect(p).toMatchObject({ retirementAge: 62, annualSpending: 25_000, socialSecurityClaimAge: plan.socialSecurityClaimAge })
    expect(p.accounts).toBe(plan.accounts)
  })

  it('moves an annuity bought at retirement along with the retirement age', () => {
    const base = { ...plan, annuityPurchase: { ...plan.annuityPurchase, purchaseAge: 60 } }
    const p = applyScenario(base, scenario({ overrides: { retirementAge: 63, annuityEnabled: true } }))
    expect(p.annuityPurchase).toMatchObject({ enabled: true, purchaseAge: 63 })
  })

  it('follows later changes to the base plan for fields it does not override', () => {
    const s = scenario({ overrides: { retirementAge: 62 } })
    expect(applyScenario({ ...plan, annualSpending: 99_000 }, s).annualSpending).toBe(99_000)
  })
})

describe('stress tests', () => {
  it('crash: the first retirement year returns −30%', () => {
    const years = projectPlan(plan, 2026, stressAdjust(plan, 'crash')).years
    const atRetirement = years.find((y) => y.age === 60)!
    const before = years.find((y) => y.age === 59)!
    // (start − withdrawal) × (1 − 30%)
    expect(atRetirement.balance).toBeCloseTo((atRetirement.startBalance - atRetirement.withdrawal) * (1 + CRASH_RETURN))
    expect(before.balance).toBeCloseTo(before.startBalance * 1.05)
  })

  it('high inflation: +3 points for 10 years from retirement, then back to normal', () => {
    const years = projectPlan(plan, 2026, stressAdjust(plan, 'high-inflation')).years
    const ratio = (age: number) => years.find((y) => y.age === age + 1)!.priceLevel / years.find((y) => y.age === age)!.priceLevel
    expect(ratio(59)).toBeCloseTo(1.02)
    expect(ratio(60)).toBeCloseTo(1.05)
    expect(ratio(69)).toBeCloseTo(1.05)
    expect(ratio(70)).toBeCloseTo(1.02)
  })

  it('stress tests lower the Monte Carlo success rate', () => {
    const tight = { ...plan, annualSpending: 33_000 }
    const base = runMonteCarlo(tight).successRate
    expect(runMonteCarlo(tight, { adjust: stressAdjust(tight, 'crash') }).successRate).toBeLessThan(base)
    expect(runMonteCarlo(tight, { adjust: stressAdjust(tight, 'high-inflation') }).successRate).toBeLessThan(base)
  })

  it('no stress test means no adjustment', () => {
    expect(stressAdjust(plan, 'none')).toBeUndefined()
  })
})
