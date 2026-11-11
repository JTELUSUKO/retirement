import { describe, expect, it } from 'vitest'
import { projectPlan, type Plan } from '../engine'
import { examplePlan, newBigExpense } from '../store/planStore'
import { assumesRothContributions, mayUseRothEarly, watchOuts } from './watchOuts'

const check = (plan: Plan) => watchOuts(plan, projectPlan(plan))
const keys = (plan: Plan) => check(plan).map((w) => w.key)
const pretaxOnly = (balance: number) => [{ ...examplePlan.accounts[0], balance, annualContribution: 0, employerMatch: 0 }]

describe('Roth money before 59½', () => {
  const roth = [{ ...examplePlan.accounts[0], type: 'roth' as const }]
  const early = { ...examplePlan, currentAge: 45, retirementAge: 55, accounts: roth }

  it('applies when retiring before 59 with a Roth account or conversions', () => {
    expect(mayUseRothEarly(early)).toBe(true)
    const conversions = { ...examplePlan.rothConversion, enabled: true }
    expect(mayUseRothEarly({ ...early, accounts: pretaxOnly(450_000), rothConversion: conversions })).toBe(true)
  })

  it('leaves out retiring at 59 or later, being 59 already, and plans with no Roth money', () => {
    expect(mayUseRothEarly({ ...early, retirementAge: 59 })).toBe(false)
    expect(mayUseRothEarly({ ...early, currentAge: 60 })).toBe(false)
    expect(mayUseRothEarly({ ...early, accounts: pretaxOnly(450_000) })).toBe(false)
  })

  it('only leans on a guess while a Roth account has no contributions entered', () => {
    expect(assumesRothContributions(early)).toBe(true)
    expect(assumesRothContributions({ ...early, accounts: [{ ...roth[0], costBasis: 200_000 }] })).toBe(false)
    expect(assumesRothContributions({ ...early, retirementAge: 59 })).toBe(false)
  })
})

describe('watch-outs', () => {
  it('finds the Roth conversion window in the example plan: low brackets before RMDs', () => {
    const [w] = check(examplePlan)
    expect(w.key).toBe('roth-window')
    expect(w.text).toMatch(/^At ages 65–\d+ your federal tax bracket is 12% or lower, below the 22% when RMDs start at \d+/)
  })

  it('flags a big expense before retiring that reaches retirement accounts, not one that cash covers', () => {
    // College when you're 58-61, retiring at 65, with only pre-tax savings: taxes and the 10% penalty
    const college = { ...newBigExpense('college', examplePlan), childAgeNow: 15 }
    const plan = { ...examplePlan, accounts: pretaxOnly(450_000), bigExpenses: [college] }
    const w = check(plan).find((x) => x.key === 'big-expense-early')!
    expect(w.age).toBe(58)
    expect(w.text).toMatch(/^Big expenses at ages 58–61 take about \$[\d,]+ out of retirement accounts before you retire, costing about \$[\d,]+ in taxes and penalties/)
    // A small cost the example plan's emergency fund covers: nothing to flag
    const small = { ...newBigExpense('other', examplePlan), annualAmount: 5_000 }
    expect(keys({ ...examplePlan, bigExpenses: [small] })).not.toContain('big-expense-early')
  })

  it('leaves the window out once Roth conversions are on', () => {
    expect(keys({ ...examplePlan, rothConversion: { ...examplePlan.rothConversion, enabled: true } })).not.toContain('roth-window')
  })

  it('flags the early-withdrawal penalty when only pre-tax money covers early retirement', () => {
    const plan = { ...examplePlan, currentAge: 50, retirementAge: 52, accounts: pretaxOnly(1_500_000) }
    const penalty = check(plan).find((w) => w.key === 'penalty')!
    expect(penalty.age).toBe(52)
    expect(penalty.text).toMatch(/at ages 52–(58|59), about \$[\d,]+ in today’s dollars/)
  })

  it('flags Medicare surcharges and the RMD bracket jump for a large pre-tax balance', () => {
    const plan = { ...examplePlan, currentAge: 70, retirementAge: 70 /* born before 1960: RMDs at 73 */, socialSecurityClaimAge: 70, annualSpending: 40_000, accounts: pretaxOnly(4_000_000) }
    const found = check(plan)
    expect(found.map((w) => w.key)).toEqual(expect.arrayContaining(['irmaa', 'rmd-bracket']))
    expect(found.find((w) => w.key === 'rmd-bracket')!.text).toMatch(/start at 73 and move you from the \d+% to the \d+% federal tax bracket/)
    // Sorted by age
    expect(found.map((w) => w.age)).toEqual([...found.map((w) => w.age)].sort((a, b) => a - b))
  })

  it('doesn’t blame RMDs for a bracket rise from a pension starting the same year', () => {
    const pension = { id: 'p', name: 'Pension', kind: 'pension' as const, annualAmount: 60_000, startAge: 73, endAge: null, inflationAdjusted: true, taxableShare: 1, survivorShare: 0 }
    const plan = { ...examplePlan, currentAge: 70, retirementAge: 70, socialSecurityClaimAge: 70, annualSpending: 40_000, accounts: pretaxOnly(4_000_000), incomeStreams: [pension] }
    expect(keys(plan)).not.toContain('rmd-bracket')
  })

  it('stays quiet without pre-tax savings', () => {
    const plan = { ...examplePlan, accounts: [{ ...examplePlan.accounts[1], balance: 900_000 }] }
    expect(check(plan)).toEqual([])
  })
})
