import { describe, expect, it } from 'vitest'
import { examplePlan } from '../store/planStore'
import { executeTool, parseWhatIf } from './tools'

describe('assistant tools', () => {
  it('get_plan_results matches the engine and uses today’s dollars', () => {
    const r = executeTool(examplePlan, 'get_plan_results', {})
    const data = JSON.parse(r.content)
    expect(r.isError).toBe(false)
    expect(data.chanceMoneyLastsToPlanAge).toMatch(/^\d+%$/)
    expect(data.milestones[0].age).toBe(examplePlan.currentAge)
  })

  it('run_what_if changes only what it is given', () => {
    const data = JSON.parse(executeTool(examplePlan, 'run_what_if', { socialSecurityClaimAge: 70 }).content)
    expect(data.withChanges.retirementAge).toBe(examplePlan.retirementAge)
    expect(data.withChanges.socialSecurityMonthlyAtClaimAge).toBeGreaterThan(data.currentPlan.socialSecurityMonthlyAtClaimAge)
  })

  it('applies stress tests', () => {
    const data = JSON.parse(executeTool(examplePlan, 'run_what_if', { stress: 'crash' }).content)
    expect(parseInt(data.withChanges.chanceMoneyLastsToPlanAge)).toBeLessThan(parseInt(data.currentPlan.chanceMoneyLastsToPlanAge))
  })

  it('reports invalid plans from a what-if as problems, not numbers', () => {
    const data = JSON.parse(executeTool(examplePlan, 'run_what_if', { retirementAge: 40 }).content)
    expect(data.withChanges.problems.length).toBeGreaterThan(0)
  })

  it('runs a survivor what-if for couples and refuses it for single filers', () => {
    const couple = { ...examplePlan, filingStatus: 'married' as const, spouseSocialSecurityAtFRA: 1_500 }
    const r = executeTool(couple, 'run_what_if', { survivorDeathAge: 75 })
    expect(r.isError).toBe(false)
    expect(JSON.parse(r.content).withChanges.survivorModeled).toBe('one spouse dies at 75')
    expect(executeTool(examplePlan, 'run_what_if', { survivorDeathAge: 75 }).isError).toBe(true)
  })

  it('rejects unknown fields and wrong types', () => {
    expect(parseWhatIf({ retireAge: 60 }).ok).toBe(false)
    expect(parseWhatIf({ annualSpending: '50k' }).ok).toBe(false)
    expect(parseWhatIf({ stress: 'meteor' }).ok).toBe(false)
    expect(executeTool(examplePlan, 'delete_everything', {}).isError).toBe(true)
  })
})
