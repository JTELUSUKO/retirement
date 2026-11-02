import { bracketTop, TAX_CONFIG } from '../engine'
import { extraIncomeTax, incomeToReach, type ExtraIncomeTax, type Household } from './incomeTax'

export type { TaxSnapshot } from './incomeTax'

const T = TAX_CONFIG.federalTax
/** Tax on the growth of money kept in a taxable account, as a share of that growth (simplified long-term rate). */
const TAXABLE_GROWTH_DRAG = 0.15

export interface RothInputs extends Household {
  /** Amount moved from a traditional IRA / 401(k) to a Roth this year */
  conversion: number
  /** Years until the converted money is spent */
  years: number
  /** Expected yearly investment return */
  annualReturn: number
  /** Expected combined federal + state tax rate on withdrawals later */
  futureTaxRate: number
  /** Pay the conversion's tax from other savings, or withhold it from the conversion */
  payTaxFrom: 'savings' | 'conversion'
}

export interface RothResult extends ExtraIncomeTax {
  /** Conversion that fills each bracket from this year's other income (0 if already past it) */
  fillTo: { rate: number; amount: number }[]
  /** After-tax value of the converted money after `years` */
  compare: { convert: number; dontConvert: number; breakEvenRate: number; earlyPenalty: number }
}

export function rothConversion(inputs: RothInputs): RothResult {
  const tax = extraIncomeTax(inputs, inputs.conversion)
  const { extraTax } = tax

  const fillTo = [0.12, 0.22, 0.24].map((rate) => ({
    rate,
    amount: incomeToReach(inputs, bracketTop(rate, inputs.status, 1), tax.before.taxableOrdinary),
  }))

  const growth = (1 + inputs.annualReturn) ** inputs.years
  const taxableGrowth = (1 + inputs.annualReturn * (1 - TAXABLE_GROWTH_DRAG)) ** inputs.years
  const c = inputs.conversion
  let compare: RothResult['compare']
  if (inputs.payTaxFrom === 'savings') {
    // Converting spends `extraTax` of savings now; not converting keeps it growing in a taxable account
    const dontConvert = c * growth * (1 - inputs.futureTaxRate) + extraTax * taxableGrowth
    compare = { convert: c * growth, dontConvert, breakEvenRate: c > 0 ? (extraTax * taxableGrowth) / (c * growth) : 0, earlyPenalty: 0 }
  } else {
    // Tax withheld from the conversion never reaches the Roth; before 59½ it also owes the 10% early-withdrawal penalty
    const earlyPenalty = inputs.age < 59.5 ? T.earlyWithdrawal.penalty * extraTax : 0
    const lost = Math.min(extraTax + earlyPenalty, c)
    compare = {
      convert: (c - lost) * growth,
      dontConvert: c * growth * (1 - inputs.futureTaxRate),
      breakEvenRate: c > 0 ? lost / c : 0,
      earlyPenalty,
    }
  }

  return { ...tax, fillTo, compare }
}
