import { describe, expect, it } from 'vitest'
import { medianReturn, mixReturns } from '../engine'
import { moneyLast, type MoneyLastInputs } from './moneyLast'

const base: MoneyLastInputs = { savings: 1_000_000, spending: 50_000, age: 65, planToAge: 95, stockShare: 0.6, inflation: 0.025 }

describe('how long will my money last', () => {
  it('matches the annuity formula for the spending that lasts exactly to the plan age', () => {
    const r = moneyLast(base)
    const { mean, volatility } = mixReturns(0.6)
    const real = (1 + medianReturn(mean, volatility)) / 1.025 - 1
    const n = 30
    // Level withdrawals at the start of each year that use up the savings in n years
    const annuityDue = (base.savings * real) / ((1 + real) * (1 - (1 + real) ** -n))
    expect(Math.abs(r.spendingThatLasts.typical - annuityDue)).toBeLessThan(1)
    expect(r.horizon).toBe(30)
  })

  it('lasts that long when spending exactly that amount', () => {
    const typical = moneyLast(base).spendingThatLasts.typical
    const r = moneyLast({ ...base, spending: typical })
    expect(r.typical.years).toBeGreaterThanOrEqual(29.99)
    expect(r.typical.years).toBeLessThan(30.1)
  })

  it('spending more makes the money run out sooner and less often last', () => {
    const low = moneyLast(base)
    const high = moneyLast({ ...base, spending: 80_000 })
    expect(high.typical.years).toBeLessThan(low.typical.years)
    expect(high.simulated.chanceLasts).toBeLessThan(low.simulated.chanceLasts)
    expect(high.typical.runOutAge).toBeCloseTo(65 + high.typical.years, 6)
  })

  it('the 9-in-10 spending lasts in at least 90% of simulated markets, and a dollar more does not', () => {
    const { ninetyPercent } = moneyLast(base).spendingThatLasts
    expect(moneyLast({ ...base, spending: ninetyPercent }).simulated.chanceLasts).toBeGreaterThanOrEqual(0.9)
    expect(moneyLast({ ...base, spending: ninetyPercent + 50 }).simulated.chanceLasts).toBeLessThan(0.9)
    expect(ninetyPercent).toBeLessThan(moneyLast(base).spendingThatLasts.typical)
  })

  it('treats spending below what the savings earn as lasting indefinitely', () => {
    const r = moneyLast({ ...base, spending: 10_000 })
    expect(r.typical.years).toBe(Infinity)
    expect(r.typical.runOutAge).toBeNull()
    expect(r.typical.schedule).toHaveLength(30)
  })

  it('reports the withdrawal rate and a year-by-year path in today’s dollars', () => {
    const r = moneyLast(base)
    expect(r.withdrawalRate).toBe(0.05)
    expect(r.typical.schedule[0]).toMatchObject({ age: 65, start: 1_000_000, withdrawal: 50_000 })
    expect(r.typical.schedule[1].start).toBeCloseTo(r.typical.schedule[0].end, 6)
    const last = r.typical.schedule.at(-1)!
    expect(last.withdrawal).toBeLessThanOrEqual(50_000)
  })

  it('gives the same answer every time (fixed seed)', () => {
    expect(moneyLast(base).simulated).toEqual(moneyLast(base).simulated)
  })

  it('handles no spending', () => {
    const r = moneyLast({ ...base, spending: 0 })
    expect(r.typical.years).toBe(Infinity)
    expect(r.simulated.chanceLasts).toBe(1)
  })
})
