import { describe, expect, it } from 'vitest'
import { rmdCalculator, type RmdInputs } from './rmd'

const base: RmdInputs = {
  status: 'single',
  state: '',
  otherIncome: 20_000,
  socialSecurity: 30_000,
  birthYear: 1952, // 74 in 2026
  balance: 500_000,
  annualReturn: 0.05,
}

describe('RMD calculator', () => {
  it('divides last year-end balance by the Uniform Lifetime Table divisor', () => {
    const r = rmdCalculator(base)
    expect(r.age).toBe(74)
    expect(r.divisor).toBe(25.5)
    expect(r.rmd).toBeCloseTo(500_000 / 25.5, 2)
    expect(r.deadline).toBe('December 31, 2026')
    expect(r.firstYearGrace).toBe(false)
  })

  it('start age 73 for 1951–1959, 75 for 1960 or later', () => {
    expect(rmdCalculator({ ...base, birthYear: 1953 })).toMatchObject({ age: 73, startAge: 73, firstYear: 2026, firstYearGrace: true, deadline: 'April 1, 2027' })
    const young = rmdCalculator({ ...base, birthYear: 1962 })
    expect(young).toMatchObject({ age: 64, startAge: 75, firstYear: 2037, rmd: 0, divisor: null, tax: null })
  })

  it('projects future RMDs, withdrawing each one before growth', () => {
    const r = rmdCalculator(base)
    expect(r.schedule[0]).toMatchObject({ year: 2026, age: 74, startBalance: 500_000, divisor: 25.5 })
    const next = (500_000 - 500_000 / 25.5) * 1.05
    expect(r.schedule[1].startBalance).toBeCloseTo(next, 2)
    expect(r.schedule[1].rmd).toBeCloseTo(next / 24.6, 2)
    expect(r.schedule).toHaveLength(25)
  })

  it('projects to the first RMD year when it is still ahead', () => {
    const r = rmdCalculator({ ...base, birthYear: 1962 })
    expect(r.schedule[0].year).toBe(2037)
    expect(r.schedule[0].startBalance).toBeCloseTo(500_000 * 1.05 ** 11, 0)
  })

  it('stops at the end of the table', () => {
    const r = rmdCalculator({ ...base, birthYear: 1920 }) // 106 in 2026
    expect(r.schedule.at(-1)!.age).toBe(110)
  })

  it('estimates the tax on the RMD', () => {
    const r = rmdCalculator(base)
    expect(r.tax!.extraTax).toBeGreaterThan(0)
    expect(r.tax!.irmaa.applies).toBe(true)
  })
})
