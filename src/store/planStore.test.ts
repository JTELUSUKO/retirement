import { beforeEach, describe, expect, it } from 'vitest'
import { defaultPlan, migratePlanState, usePlanStore } from './planStore'

const state = () => usePlanStore.getState()

describe('plan store: clear, load example, undo', () => {
  beforeEach(() => usePlanStore.setState({ plan: defaultPlan, undo: null }))

  it('clear removes accounts and amounts but keeps ages and assumptions', () => {
    state().clear()
    const { plan } = state()
    expect(plan.accounts).toEqual([])
    expect([plan.annualSpending, plan.socialSecurityAtFRA]).toEqual([0, 0])
    expect(plan.incomeStreams).toEqual([])
    expect(plan.currentAge).toBe(defaultPlan.currentAge)
    expect(plan.assumptions).toEqual(defaultPlan.assumptions)
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
    expect(state().plan).toEqual(defaultPlan)
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
    const { filingStatus: _f, healthcare: _h, incomeStreams: _i, annuityPurchase: _a, scenarios: _s, ...rest } = defaultPlan
    const v2plan = { ...rest, annualPension: 0 }
    const migrated = migratePlanState({ plan: v2plan }, 2)
    expect(migrated.plan.filingStatus).toBe('single')
    expect(migrated.plan.healthcare).toEqual(defaultPlan.healthcare)
    expect(migrated.plan.annualSpending).toBe(defaultPlan.annualSpending)
    expect(migrated.plan.annuityPurchase).toMatchObject({ enabled: false, purchaseAge: defaultPlan.retirementAge })
  })
})

describe('plan store: v4 → v5 pension migration', () => {
  const { incomeStreams: _i, annuityPurchase: _a, scenarios: _s, ...rest } = defaultPlan

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
  beforeEach(() => usePlanStore.setState({ plan: defaultPlan, undo: null }))
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

  it('upgrades a v6 plan with no scenarios', () => {
    const { scenarios: _s, ...v6 } = defaultPlan
    expect(migratePlanState({ plan: v6 }, 6).plan.scenarios).toEqual([])
  })
})
