import type { IncomeStream } from './types'

export interface YearIncome {
  /** Nominal dollars received this year. */
  amount: number
  /** Part taxed as ordinary income. */
  taxable: number
}

/** Income from all streams paid at `age`, given the price level (1 = today). */
export function incomeAtAge(streams: IncomeStream[], age: number, priceLevel: number): YearIncome {
  let amount = 0
  let taxable = 0
  for (const s of streams) {
    if (age < s.startAge || (s.endAge !== null && age > s.endAge)) continue
    const paid = s.annualAmount * (s.inflationAdjusted ? priceLevel : 1)
    amount += paid
    taxable += paid * s.taxableShare
  }
  return { amount, taxable }
}
