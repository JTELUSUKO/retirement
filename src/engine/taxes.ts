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
  socialSecurity: number
  age: number
  year: number
  status: FilingStatus
  /** Price level vs. 2026; brackets and indexed deductions are scaled by it. */
  priceLevel: number
}

export interface TaxResult {
  tax: number
  taxableIncome: number
}

/**
 * Approximate federal income tax for a retiree: ordinary income + taxable Social Security,
 * minus the standard deduction (plus 65+ additions). Capital gains, state tax and credits
 * are not modeled.
 */
export function federalIncomeTax(input: TaxInput): TaxResult {
  const { ordinaryIncome, socialSecurity, age, year, status, priceLevel } = input
  const people = status === 'married' ? 2 : 1
  const grossIncome = ordinaryIncome + taxableSocialSecurity(ordinaryIncome, socialSecurity, status)

  let deduction = T.standardDeduction[status] * priceLevel
  if (age >= 65) {
    deduction += T.additionalDeduction65[status] * people * priceLevel
    if (year <= T.seniorDeduction.lastYear) {
      const { amount, phaseOutStart, phaseOutRate } = T.seniorDeduction
      const reduction = Math.max(grossIncome - phaseOutStart[status], 0) * phaseOutRate
      deduction += Math.max(amount * people - reduction, 0)
    }
  }

  const taxableIncome = Math.max(grossIncome - deduction, 0)
  let tax = 0
  let lower = 0
  for (const [upper, rate] of T.brackets[status]) {
    const top = upper * priceLevel
    if (taxableIncome <= lower) break
    tax += (Math.min(taxableIncome, top) - lower) * rate
    lower = top
  }
  return { tax, taxableIncome }
}
