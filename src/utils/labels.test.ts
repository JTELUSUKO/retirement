import { describe, expect, it } from 'vitest'
import { basePlan } from '../engine/testFixtures'
import { ageCell, ageLabel, describeScenario, endLabel } from './labels'

describe('describeScenario', () => {
  it('lists only what the scenario changes', () => {
    const text = describeScenario(basePlan, {
      id: 'x', name: 'X', overrides: { retirementAge: 63, socialSecurityClaimAge: 70 }, stress: 'crash', slot: 1,
    })
    expect(text).toBe('Retire at 63; Social Security at 70; 30% crash in first retirement year')
  })

  it('describes an early death or both living', () => {
    const d = (age: number) => describeScenario(basePlan, { id: 'x', name: 'X', overrides: { survivorDeathAge: age }, stress: 'none', slot: 1 })
    expect(d(75)).toBe('You die at 75')
    expect(d(0)).toBe('Both live')
  })

  it('says when nothing changes', () => {
    expect(describeScenario(basePlan, { id: 'x', name: 'X', overrides: {}, stress: 'none', slot: 1 })).toBe('No changes')
  })
})

describe('age labels for couples', () => {
  const couple = { ...basePlan, filingStatus: 'married' as const, currentAge: 60, spouseCurrentAge: 55, lifeExpectancy: 95 }
  it('shows the spouse’s age when it differs and ends when the younger reaches the plan-to age', () => {
    expect(endLabel(couple)).toBe('100 (spouse 95)')
    expect(ageCell(couple, 70)).toBe('70 / 65')
  })
  it('stays simple for singles and same-age couples', () => {
    expect(endLabel(basePlan)).toBe(`${basePlan.lifeExpectancy}`)
    expect(ageLabel({ ...couple, spouseCurrentAge: 60 }, 70)).toBe('70')
  })
})

import { activeAdvancedSettings, defaultAccountName, isAutoAccountName, sectionSummaries } from './labels'

describe('account names', () => {
  it('names new accounts after their type, numbering repeats', () => {
    expect(defaultAccountName('401k', [])).toBe('401(k)')
    expect(defaultAccountName('401k', ['401(k)', '401(k) 2'])).toBe('401(k) 3')
    expect(defaultAccountName('taxable', ['401(k)'])).toBe('Brokerage')
  })
  it('recognizes automatic names but not ones the user typed', () => {
    expect(isAutoAccountName('401(k) 2', '401k')).toBe(true)
    expect(isAutoAccountName('New account', 'cash')).toBe(true)
    expect(isAutoAccountName('My old job 401k', '401k')).toBe(false)
  })
})

describe('section summaries', () => {
  it('summarize collapsed sections and list advanced settings in effect', () => {
    const plan = { ...basePlan, annuityPurchase: { ...basePlan.annuityPurchase, enabled: true, amount: 150_000, purchaseAge: 65 } }
    const s = sectionSummaries(plan)
    expect(s.accounts).toBe('1 account · $100,000')
    expect(s.annuity).toBe('$150K at 65')
    expect(activeAdvancedSettings(plan)).toEqual(['an annuity purchase'])
  })
})
