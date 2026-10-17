import type { AnnuityPurchase, FilingStatus } from './types'

/**
 * Typical single-life immediate annuity payout rates (yearly payment ÷ premium) for
 * level payments, by purchase age. Rough 2026 market averages; real quotes vary by
 * insurer, sex, health and interest rates, so the UI lets you enter your own quote.
 */
const SINGLE_LIFE_RATES: [age: number, rate: number][] = [
  [50, 0.052], [55, 0.056], [60, 0.062], [65, 0.069], [70, 0.079], [75, 0.093], [80, 0.112], [85, 0.138],
]
/** Joint-and-survivor payouts are lower because payments last until the second death. */
export const JOINT_FACTOR = 0.88
/** Payments that rise with inflation start much lower. */
export const INFLATION_ADJUSTED_FACTOR = 0.72

/**
 * IRS Table V (single life expectancy for annuity exclusion ratios), selected ages.
 * Joint lives are approximated as 25% longer.
 */
const IRS_LIFE_EXPECTANCY: [age: number, years: number][] = [
  [50, 33.1], [55, 28.6], [60, 24.2], [65, 20.0], [70, 16.0], [75, 12.5], [80, 9.5], [85, 6.9],
]
const JOINT_LIFE_FACTOR = 1.25

function interpolate(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    if (x <= x1) {
      const [x0, y0] = table[i - 1]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return table[table.length - 1][1]
}

/** Estimated payout rate for an annuity bought at `age`. */
export function estimatePayoutRate(age: number, status: FilingStatus, inflationAdjusted: boolean): number {
  return (
    interpolate(SINGLE_LIFE_RATES, age) *
    (status === 'married' ? JOINT_FACTOR : 1) *
    (inflationAdjusted ? INFLATION_ADJUSTED_FACTOR : 1)
  )
}

/** The payout rate used: your quote if entered, otherwise the estimate. */
export function payoutRate(purchase: AnnuityPurchase, status: FilingStatus): number {
  return purchase.payoutRate ?? estimatePayoutRate(purchase.purchaseAge, status, purchase.inflationAdjusted)
}

/**
 * Share of each payment taxed as income.
 * Bought with pre-tax money (IRA rollover): all of it.
 * Bought with after-tax money: only the earnings part (IRS exclusion ratio:
 * premium ÷ expected total payments is a tax-free return of principal).
 */
export function annuityTaxableShare(
  fundedFrom: AnnuityPurchase['fundedFrom'],
  age: number,
  status: FilingStatus,
  premium: number,
  yearlyPayment: number,
): number {
  if (fundedFrom === 'pretax') return 1
  const years = interpolate(IRS_LIFE_EXPECTANCY, age) * (status === 'married' ? JOINT_LIFE_FACTOR : 1)
  const expectedReturn = yearlyPayment * years
  return expectedReturn > 0 ? Math.min(Math.max(1 - premium / expectedReturn, 0), 1) : 1
}
