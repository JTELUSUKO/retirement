import { describe, expect, it } from 'vitest'
import { FOUR_PERCENT_DEFAULTS, fourPercent, GRID_RATES, GRID_YEARS, savingsNeeded, successGrid } from './fourPercent'
import { moneyLast } from './moneyLast'

describe('4% rule', () => {
  it('withdraws the rate in the first year', () => {
    expect(fourPercent(FOUR_PERCENT_DEFAULTS).firstYear).toBe(40_000)
    expect(savingsNeeded(40_000, 0.04)).toBe(1_000_000)
  })

  it('agrees with the "how long will my money last" page for the same plan', () => {
    const four = fourPercent(FOUR_PERCENT_DEFAULTS)
    const last = moneyLast({ savings: 1_000_000, spending: 40_000, age: 65, planToAge: 95, stockShare: 0.6, inflation: 0.025 })
    expect(four.chanceLasts).toBe(last.simulated.chanceLasts)
  })

  it('the 9-in-10 rate lasts in at least 90% of markets, and a bit more does not', () => {
    const r = fourPercent(FOUR_PERCENT_DEFAULTS)
    expect(fourPercent({ ...FOUR_PERCENT_DEFAULTS, rate: r.rateFor90 }).chanceLasts).toBeGreaterThanOrEqual(0.9)
    expect(fourPercent({ ...FOUR_PERCENT_DEFAULTS, rate: r.rateFor90 + 0.001 }).chanceLasts).toBeLessThan(0.9)
  })

  it('the table gets worse with higher rates and longer retirements', () => {
    const grid = successGrid(0.6, 0.025)
    expect(grid).toHaveLength(GRID_RATES.length)
    for (let i = 0; i < GRID_RATES.length; i++) {
      for (let j = 0; j < GRID_YEARS.length; j++) {
        if (i > 0) expect(grid[i][j]).toBeLessThanOrEqual(grid[i - 1][j])
        if (j > 0) expect(grid[i][j]).toBeLessThanOrEqual(grid[i][j - 1])
      }
    }
    // The 4%, 30-year cell is the headline number
    expect(grid[GRID_RATES.indexOf(0.04)][GRID_YEARS.indexOf(30)]).toBe(fourPercent(FOUR_PERCENT_DEFAULTS).chanceLasts)
  })
})
