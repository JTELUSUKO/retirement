import type { IncomeStream } from './types'

export interface YearIncome {
  /** Nominal dollars received this year. */
  amount: number
  /** Part taxed as ordinary income. */
  taxable: number
  /** Taxable part that counts as retirement income for state exclusions (pensions, annuities). */
  taxableRetirement: number
}

/** Income from all streams paid at `age`, given the price level (1 = today). After a death, survivor shares apply. */
export function incomeAtAge(streams: IncomeStream[], age: number, priceLevel: number, widowed = false): YearIncome {
  let amount = 0
  let taxable = 0
  let taxableRetirement = 0
  for (const s of streams) {
    if (age < s.startAge || (s.endAge !== null && age > s.endAge)) continue
    const paid = s.annualAmount * (s.inflationAdjusted ? priceLevel : 1) * (widowed ? s.survivorShare : 1)
    amount += paid
    taxable += paid * s.taxableShare
    if (s.kind === 'pension' || s.kind === 'annuity') taxableRetirement += paid * s.taxableShare
  }
  return { amount, taxable, taxableRetirement }
}
