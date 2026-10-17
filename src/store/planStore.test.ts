import { beforeEach, describe, expect, it } from 'vitest'
import { defaultPlan, usePlanStore } from './planStore'

const state = () => usePlanStore.getState()

describe('plan store: clear, load example, undo', () => {
  beforeEach(() => usePlanStore.setState({ plan: defaultPlan, undo: null }))

  it('clear removes accounts and amounts but keeps ages and assumptions', () => {
    state().clear()
    const { plan } = state()
    expect(plan.accounts).toEqual([])
    expect([plan.annualSpending, plan.socialSecurityAtFRA, plan.annualPension]).toEqual([0, 0, 0])
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
