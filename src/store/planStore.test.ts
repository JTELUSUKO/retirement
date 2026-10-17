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
    const { filingStatus: _f, healthcare: _h, incomeStreams: _i, annuityPurchase: _a, ...rest } = defaultPlan
    const v2plan = { ...rest, annualPension: 0 }
    const migrated = migratePlanState({ plan: v2plan }, 2)
    expect(migrated.plan.filingStatus).toBe('single')
    expect(migrated.plan.healthcare).toEqual(defaultPlan.healthcare)
    expect(migrated.plan.annualSpending).toBe(defaultPlan.annualSpending)
    expect(migrated.plan.annuityPurchase).toMatchObject({ enabled: false, purchaseAge: defaultPlan.retirementAge })
  })
})

describe('plan store: v4 → v5 pension migration', () => {
  const { incomeStreams: _i, annuityPurchase: _a, ...rest } = defaultPlan

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
