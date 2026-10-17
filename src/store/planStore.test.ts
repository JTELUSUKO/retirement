import { beforeEach, describe, expect, it } from 'vitest'
import { blankPlan, examplePlan, migratePlanState, usePlanStore } from './planStore'

const state = () => usePlanStore.getState()

describe('plan store: clear, load example, undo', () => {
  beforeEach(() => usePlanStore.setState({ plan: examplePlan, undo: null }))

  it('clear resets to a blank plan but keeps the visitor’s assumptions and healthcare estimates', () => {
    state().updateAssumptions({ inflation: 0.03 })
    state().clear()
    const { plan } = state()
    expect(plan.accounts).toEqual([])
    expect([plan.currentAge, plan.retirementAge, plan.lifeExpectancy, plan.annualSpending, plan.socialSecurityAtFRA]).toEqual([0, 0, 0, 0, 0])
    expect(plan.assumptions.inflation).toBe(0.03)
    expect(plan.healthcare).toEqual(examplePlan.healthcare)
  })

  it('new visitors start with a blank plan', () => {
    expect(blankPlan.accounts).toEqual([])
    expect(blankPlan.currentAge).toBe(0)
    expect(blankPlan.annualSpending).toBe(0)
  })

  it('undo restores the plan from before clear', () => {
    state().update({ annualSpending: 12_345 })
    const before = state().plan
    state().clear()
    state().undoLast()
    expect(state().plan).toEqual(before)
    expect(state().undo).toBeNull()
  })

  it('undo restores the plan from before loading the example', () => {
    state().clear()
    state().update({ annualSpending: 50_000 })
    const mine = state().plan
    state().loadExample()
    expect(state().plan).toEqual(examplePlan)
    state().undoLast()
    expect(state().plan).toEqual(mine)
  })

  it('editing after clear drops the undo point', () => {
    state().clear()
    state().update({ currentAge: 50 })
    expect(state().undo).toBeNull()
  })
})

describe('plan store: migrations', () => {
  it('upgrades a v2 plan (no filing status, no healthcare)', () => {
    const { filingStatus: _f, healthcare: _h, incomeStreams: _i, annuityPurchase: _a, scenarios: _s, state: _st, stateRetirementExclusion: _se, spouseSocialSecurityAtFRA: _ss, survivor: _sv, spouseCurrentAge: _sa, spouseClaimAge: _sc, rothConversion: _rc, ...rest } = examplePlan
    const v2plan = { ...rest, annualPension: 0 }
    const migrated = migratePlanState({ plan: v2plan }, 2)
    expect(migrated.plan.filingStatus).toBe('single')
    expect(migrated.plan.healthcare).toEqual(examplePlan.healthcare)
    expect(migrated.plan.annualSpending).toBe(examplePlan.annualSpending)
    expect(migrated.plan.annuityPurchase).toMatchObject({ enabled: false, purchaseAge: examplePlan.retirementAge })
  })
})

describe('plan store: v4 → v5 pension migration', () => {
  const { incomeStreams: _i, annuityPurchase: _a, scenarios: _s, ...rest } = examplePlan

  it('turns a pension into an inflation-adjusted, fully taxable income stream for life', () => {
    const { plan } = migratePlanState({ plan: { ...rest, annualPension: 24_000 } }, 4)
    expect(plan.incomeStreams).toEqual([
      expect.objectContaining({ kind: 'pension', annualAmount: 24_000, startAge: rest.retirementAge, endAge: null, inflationAdjusted: true, taxableShare: 1 }),
    ])
    expect(plan).not.toHaveProperty('annualPension')
  })

  it('adds no stream when there was no pension', () => {
    expect(migratePlanState({ plan: { ...rest, annualPension: 0 } }, 4).plan.incomeStreams).toEqual([])
  })
})

describe('plan store: scenarios', () => {
  beforeEach(() => usePlanStore.setState({ plan: examplePlan, undo: null }))
  const add = () => state().addScenario({ name: 'Retire at 63', overrides: { retirementAge: 63 }, stress: 'none' })

  it('adds up to three scenarios', () => {
    for (let i = 0; i < 5; i++) add()
    expect(state().plan.scenarios).toHaveLength(3)
    expect(new Set(state().plan.scenarios.map((s) => s.id)).size).toBe(3)
  })

  it('updates and removes a scenario', () => {
    add()
    const id = state().plan.scenarios[0].id
    state().updateScenario(id, { stress: 'crash' })
    expect(state().plan.scenarios[0].stress).toBe('crash')
    state().removeScenario(id)
    expect(state().plan.scenarios).toEqual([])
  })

  it('keeps each scenario’s color slot when another is removed, and reuses the free slot', () => {
    add(); add(); add()
    expect(state().plan.scenarios.map((s) => s.slot)).toEqual([1, 2, 3])
    state().removeScenario(state().plan.scenarios[0].id)
    expect(state().plan.scenarios.map((s) => s.slot)).toEqual([2, 3])
    add()
    expect(state().plan.scenarios.map((s) => s.slot)).toEqual([2, 3, 1])
  })

  it('upgrades a v12 plan with Roth conversions off', () => {
    const { rothConversion: _r, ...v12 } = examplePlan
    expect(migratePlanState({ plan: v12 }, 12).plan.rothConversion.enabled).toBe(false)
  })

  it('upgrades a v11 plan: brokerage cost basis unknown', () => {
    const v11 = { ...examplePlan, accounts: examplePlan.accounts.map(({ costBasis: _c, ...a }) => a) }
    const { plan } = migratePlanState({ plan: v11 }, 11)
    expect(plan.accounts.every((a) => a.costBasis === null)).toBe(true)
  })

  it('upgrades a v10 couple: spouse gets your age and claiming age, and you are the one who dies', () => {
    const { spouseCurrentAge: _a, spouseClaimAge: _c, ...rest } = examplePlan
    const v10 = { ...rest, filingStatus: 'married', currentAge: 58, socialSecurityClaimAge: 68, survivor: { enabled: true, firstDeathAge: 80, spendingShare: 0.75 } }
    const { plan } = migratePlanState({ plan: v10 }, 10)
    expect(plan.spouseCurrentAge).toBe(58)
    expect(plan.spouseClaimAge).toBe(68)
    expect(plan.survivor.whoDies).toBe('you')
  })

  it('upgrades a v9 plan: no survivor modeling, full survivor share on existing income', () => {
    const { spouseSocialSecurityAtFRA: _s, survivor: _v, spouseCurrentAge: _a, spouseClaimAge: _c, ...v9 } = examplePlan
    const pension = { id: 'p', name: 'Pension', kind: 'pension', annualAmount: 1, startAge: 65, endAge: null, inflationAdjusted: true, taxableShare: 1 }
    const { plan } = migratePlanState({ plan: { ...v9, incomeStreams: [pension] } }, 9)
    expect(plan.survivor.enabled).toBe(false)
    expect(plan.spouseSocialSecurityAtFRA).toBe(0)
    expect(plan.incomeStreams[0].survivorShare).toBe(1)
  })

  it('upgrades a v8 plan with no state chosen', () => {
    const { state: _s, stateRetirementExclusion: _e, ...v8 } = examplePlan
    const { plan } = migratePlanState({ plan: v8 }, 8)
    expect(plan.state).toBe('')
    expect(plan.stateRetirementExclusion).toBe(0)
  })

  it('gives v7 scenarios slots by position', () => {
    const v7 = { ...examplePlan, scenarios: [{ id: 'a', name: 'A', overrides: {}, stress: 'none' }] }
    expect(migratePlanState({ plan: v7 }, 7).plan.scenarios[0].slot).toBe(1)
  })

  it('upgrades a v6 plan with no scenarios', () => {
    const { scenarios: _s, ...v6 } = examplePlan
    expect(migratePlanState({ plan: v6 }, 6).plan.scenarios).toEqual([])
  })
})
