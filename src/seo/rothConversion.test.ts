import { describe, expect, it } from 'vitest'
import { rothConversion, type RothInputs } from './rothConversion'

const base: RothInputs = {
  status: 'single',
  state: '',
  age: 60,
  otherIncome: 40_000,
  socialSecurity: 0,
  conversion: 20_000,
  years: 15,
  annualReturn: 0.06,
  futureTaxRate: 0.22,
  payTaxFrom: 'savings',
}

describe('Roth conversion calculator', () => {
  it('taxes the conversion at the 2026 brackets', () => {
    // Single, $40k other income: taxable $23,900 → $43,900 (12% bracket, top $50,400) → 12% of $20,000
    const r = rothConversion(base)
    expect(r.extraFederal).toBeCloseTo(2_400, 0)
    expect(r.extraState).toBe(0)
    expect(r.effectiveRate).toBeCloseTo(0.12, 3)
    expect(r.topBracket).toBe(0.12)
    expect(r.roomInBracket).toBe(6_500)
  })

  it('finds the conversion that fills each bracket', () => {
    const r = rothConversion(base)
    // 12% bracket tops out at $50,400 taxable = $66,500 income; other income is $40,000
    expect(r.fillTo.find((f) => f.rate === 0.12)!.amount).toBe(26_500)
    expect(r.fillTo.find((f) => f.rate === 0.22)!.amount).toBe(105_700 + 16_100 - 40_000)
    expect(rothConversion({ ...base, otherIncome: 200_000 }).fillTo[0].amount).toBe(0)
  })

  it('converting exactly to the top of a bracket stays in that bracket with no room left', () => {
    const r = rothConversion({ ...base, conversion: 26_500 })
    expect(r.topBracket).toBe(0.12)
    expect(r.roomInBracket).toBe(0)
    // Same with Social Security in the mix, using the calculator's own "fill" amount
    const withSs = { ...base, age: 67, otherIncome: 20_000, socialSecurity: 30_000 }
    for (const { rate, amount } of rothConversion(withSs).fillTo) {
      const filled = rothConversion({ ...withSs, conversion: amount })
      expect(filled.topBracket).toBe(rate)
      expect(filled.roomInBracket).toBe(0)
    }
  })

  it('crosses brackets: part at 12%, part at 22%', () => {
    const r = rothConversion({ ...base, conversion: 36_500 })
    expect(r.extraFederal).toBeCloseTo(26_500 * 0.12 + 10_000 * 0.22, 0)
    expect(r.topBracket).toBe(0.22)
  })

  it('includes extra Social Security becoming taxable (the "tax torpedo")', () => {
    const r = rothConversion({ ...base, age: 67, otherIncome: 20_000, socialSecurity: 30_000, conversion: 10_000 })
    // More than 12%: each converted dollar also makes up to 85¢ of Social Security taxable
    expect(r.effectiveRate).toBeGreaterThan(0.12)
  })

  it('adds state tax', () => {
    const r = rothConversion({ ...base, state: 'NC' })
    expect(r.extraState).toBeCloseTo(20_000 * 0.0399, 0)
  })

  it('warns about Medicare surcharges from 63, two years ahead', () => {
    const big = { ...base, otherIncome: 90_000, conversion: 50_000 }
    expect(rothConversion({ ...big, age: 62 }).irmaa.applies).toBe(false)
    const r = rothConversion({ ...big, age: 63 })
    expect(r.irmaa.applies).toBe(true)
    expect(r.irmaa.extraYearly).toBeGreaterThan(0)
    expect(rothConversion({ ...base, age: 66 }).irmaa.extraYearly).toBe(0)
  })

  it('break-even: converting wins when the future tax rate is above the rate paid now', () => {
    const withheld = rothConversion({ ...base, payTaxFrom: 'conversion' })
    expect(withheld.compare.earlyPenalty).toBe(0)
    expect(withheld.compare.breakEvenRate).toBeCloseTo(0.12, 3)
    expect(withheld.compare.convert).toBeGreaterThan(withheld.compare.dontConvert) // 12% now vs 22% later
    expect(rothConversion({ ...base, payTaxFrom: 'conversion', futureTaxRate: 0.1 }).compare.convert)
      .toBeLessThan(rothConversion({ ...base, payTaxFrom: 'conversion', futureTaxRate: 0.1 }).compare.dontConvert)
    // Paying from savings keeps more in the Roth, so the break-even rate is lower than the rate paid now
    expect(rothConversion(base).compare.breakEvenRate).toBeLessThan(0.12)
  })

  it('charges the early-withdrawal penalty on tax withheld before 59½', () => {
    const r = rothConversion({ ...base, age: 50, payTaxFrom: 'conversion' })
    expect(r.compare.earlyPenalty).toBeCloseTo(240, 0)
    expect(r.compare.breakEvenRate).toBeCloseTo(0.132, 3)
  })

  it('handles no conversion', () => {
    const r = rothConversion({ ...base, conversion: 0 })
    expect(r.extraTax).toBe(0)
    expect(r.effectiveRate).toBe(0)
    expect(r.compare.breakEvenRate).toBe(0)
  })
})
