import { CONFIG_2026 } from './config/2026'
import type { FilingStatus } from './types'

const T = CONFIG_2026.federalTax

/**
 * Taxable part of Social Security (IRS provisional-income test).
 * Provisional income = other income + half of benefits. Up to 85% can be taxable.
 */
export function taxableSocialSecurity(otherIncome: number, benefits: number, status: FilingStatus): number {
  if (benefits <= 0) return 0
  const [base1, base2] = T.socialSecurityThresholds[status]
  const provisional = otherIncome + benefits / 2
  if (provisional <= base1) return 0
  const tier1 = Math.min(benefits / 2, (Math.min(provisional, base2) - base1) / 2)
  const tier2 = provisional > base2 ? 0.85 * (provisional - base2) : 0
  return Math.min(0.85 * benefits, tier1 + tier2)
}

export interface TaxInput {
  /** Pre-tax withdrawals (incl. full RMD) + pension, nominal dollars. */
  ordinaryIncome: number
  /** Long-term capital gains + qualified dividends, nominal (taxed at 0/15/20%) */
  capitalGains?: number
  socialSecurity: number
  age: number
  year: number
  status: FilingStatus
  /** Price level vs. 2026; brackets and indexed deductions are scaled by it. */
  priceLevel: number
  /** Filers aged 65+ (defaults to everyone on the return if `age` ≥ 65) */
  seniors?: number
}

export interface TaxResult {
  /** Total federal tax: ordinary + capital gains + NIIT */
  tax: number
  capitalGainsTax: number
  niit: number
  /** Adjusted gross income (ordinary + gains + taxable Social Security); MAGI for IRMAA */
  agi: number
  /** Taxable income excluding capital gains (what fills the ordinary brackets) */
  taxableOrdinary: number
  taxableIncome: number
}

/**
 * Approximate federal income tax for a retiree: ordinary income + taxable Social Security,
 * minus the standard deduction (plus 65+ additions), through the brackets; long-term capital gains
 * and qualified dividends at 0/15/20% stacked on top; plus the 3.8% net investment income tax.
 * Credits and AMT are not modeled.
 */
export function federalIncomeTax(input: TaxInput): TaxResult {
  const { ordinaryIncome, socialSecurity, age, year, status, priceLevel } = input
  const gains = Math.max(input.capitalGains ?? 0, 0)
  const filers = status === 'married' ? 2 : 1
  const seniors = Math.min(input.seniors ?? (age >= 65 ? filers : 0), filers)
  // Provisional income for Social Security includes capital gains
  const taxableSs = taxableSocialSecurity(ordinaryIncome + gains, socialSecurity, status)
  const grossIncome = ordinaryIncome + gains + taxableSs

  let deduction = T.standardDeduction[status] * priceLevel
  if (seniors > 0) {
    deduction += T.additionalDeduction65[status] * seniors * priceLevel
    if (year <= T.seniorDeduction.lastYear) {
      const { amount, phaseOutStart, phaseOutRate } = T.seniorDeduction
      // Schedule 1-A Part V: each person's $6,000 is reduced by 6% of income over the threshold
      const reduction = Math.max(grossIncome - phaseOutStart[status], 0) * phaseOutRate
      deduction += Math.max(amount - reduction, 0) * seniors
    }
  }

  // Deductions offset ordinary income first; capital gains stack on top of it
  const ordinaryPart = ordinaryIncome + taxableSs
  const taxableOrdinary = Math.max(ordinaryPart - deduction, 0)
  const taxableGains = Math.max(gains - Math.max(deduction - ordinaryPart, 0), 0)

  let ordinaryTax = 0
  let lower = 0
  for (const [upper, rate] of T.brackets[status]) {
    const top = upper * priceLevel
    if (taxableOrdinary <= lower) break
    ordinaryTax += (Math.min(taxableOrdinary, top) - lower) * rate
    lower = top
  }

  const zeroTop = T.capitalGains.zeroRateTop[status] * priceLevel
  const fifteenTop = T.capitalGains.fifteenRateTop[status] * priceLevel
  const atZero = Math.max(0, Math.min(taxableGains, zeroTop - taxableOrdinary))
  const atFifteen = Math.max(0, Math.min(taxableGains - atZero, fifteenTop - Math.max(taxableOrdinary, zeroTop)))
  const atTwenty = taxableGains - atZero - atFifteen
  const capitalGainsTax = 0.15 * atFifteen + 0.2 * atTwenty

  const niit = T.niit.rate * Math.min(gains, Math.max(grossIncome - T.niit.threshold[status], 0))

  return {
    tax: ordinaryTax + capitalGainsTax + niit,
    capitalGainsTax,
    niit,
    taxableIncome: taxableOrdinary + taxableGains,
    agi: grossIncome,
    taxableOrdinary,
  }
}

/** Top of the ordinary bracket taxed at `rate` (taxable income), indexed; Infinity for the top bracket. */
export function bracketTop(rate: number, status: FilingStatus, priceLevel: number): number {
  const bracket = T.brackets[status].find(([, r]) => Math.abs(r - rate) < 1e-9)
  return bracket ? bracket[0] * priceLevel : 0
}
