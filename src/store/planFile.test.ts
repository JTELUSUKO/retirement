import { describe, expect, it } from 'vitest'
import { backupFileName, parsePlanFile, serializePlan } from './planFile'
import { examplePlan, PLAN_VERSION } from './planStore'

const fileWith = (fields: Record<string, unknown>) =>
  JSON.stringify({ app: 'retirement-planner', version: PLAN_VERSION, exportedAt: '2026-10-17T00:00:00Z', plan: examplePlan, ...fields })

const expectError = (text: string, match: RegExp) => {
  const result = parsePlanFile(text)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toMatch(match)
}

describe('plan backup files', () => {
  it('round-trips a plan through export and import', () => {
    const result = parsePlanFile(serializePlan(examplePlan))
    expect(result).toEqual({ ok: true, plan: examplePlan })
  })

  it('names the file with the date', () => {
    expect(backupFileName(new Date('2026-10-17T12:00:00Z'))).toBe('retirement-plan-2026-10-17.json')
  })

  it('upgrades a file from an older version', () => {
    const { filingStatus: _f, healthcare: _h, incomeStreams: _i, annuityPurchase: _a, scenarios: _s, ...rest } = examplePlan
    const result = parsePlanFile(fileWith({ version: 2, plan: { ...rest, annualPension: 18_000 } }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.filingStatus).toBe('single')
      expect(result.plan.incomeStreams[0]).toMatchObject({ kind: 'pension', annualAmount: 18_000 })
    }
  })

  it('rejects text that is not JSON', () => {
    expectError('not json {', /valid JSON/)
  })

  it('rejects JSON from something else', () => {
    expectError(JSON.stringify({ hello: 'world' }), /doesn’t look like/)
  })

  it('rejects files from a newer app version', () => {
    expectError(fileWith({ version: PLAN_VERSION + 1 }), /newer version/)
  })

  it('rejects missing or mistyped fields with a specific message', () => {
    expectError(fileWith({ plan: { ...examplePlan, currentAge: '55' } }), /currentAge/)
    expectError(fileWith({ plan: { ...examplePlan, accounts: [{ ...examplePlan.accounts[0], type: 'crypto' }] } }), /unknown type/)
    expectError(fileWith({ plan: { ...examplePlan, healthcare: undefined } }), /healthcare/)
  })

  it('rejects a scenario with an unknown stress test', () => {
    expectError(fileWith({ plan: { ...examplePlan, scenarios: [{ id: 'a', name: 'X', overrides: {}, stress: 'meteor', slot: 1 }] } }), /stress test/)
  })

  it('rejects a file with no plan at all', () => {
    expectError(fileWith({ plan: undefined }), /damaged or incomplete/)
  })
})
