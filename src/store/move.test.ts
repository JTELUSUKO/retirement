import { describe, expect, it } from 'vitest'
import { movedUrl, NEW_HOME, planFromMove } from './move'
import { examplePlan, PLAN_VERSION } from './planStore'

const saved = (plan: unknown, version = PLAN_VERSION) => JSON.stringify({ state: { plan }, version })

describe('moving to willitlast.app', () => {
  it('carries the saved plan to the new address and reads it back', () => {
    const url = movedUrl(saved(examplePlan), '#plan')
    expect(url.startsWith(`${NEW_HOME}#moved=`)).toBe(true)
    expect(url.split('#moved=')[1]).toMatch(/^[A-Za-z0-9_-]+$/)
    const result = planFromMove(new URL(url).hash)
    expect(result).toEqual({ ok: true, plan: examplePlan })
  })

  it('keeps non-English text intact', () => {
    const plan = { ...examplePlan, accounts: [{ ...examplePlan.accounts[0], name: 'Épargne — 401(k) ✓' }] }
    const result = planFromMove(new URL(movedUrl(saved(plan), '')).hash)
    expect(result?.ok && result.plan.accounts[0].name).toBe('Épargne — 401(k) ✓')
  })

  it('upgrades a plan saved by an older version', () => {
    const result = planFromMove(new URL(movedUrl(saved(examplePlan, PLAN_VERSION - 1), '')).hash)
    expect(result?.ok).toBe(true)
  })

  it('moves without a plan when nothing is saved or the save is unreadable', () => {
    expect(movedUrl(null, '#terms')).toBe(`${NEW_HOME}#terms`)
    expect(movedUrl('not json', '')).toBe(NEW_HOME)
    expect(movedUrl(JSON.stringify({ state: {}, version: 1 }), '')).toBe(NEW_HOME)
  })

  it('ignores ordinary page links and rejects damaged data', () => {
    expect(planFromMove('#terms')).toBeNull()
    expect(planFromMove('')).toBeNull()
    expect(planFromMove('#moved=%%%')?.ok).toBe(false)
    expect(planFromMove('#moved=' + 'A'.repeat(3_000_000))?.ok).toBe(false)
    expect(planFromMove('#moved=' + btoa('{"app":"other"}'))?.ok).toBe(false)
  })
})
