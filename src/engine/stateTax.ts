import { NO_INCOME_TAX_STATES, STATE_TAX_2026, type StateTaxRule } from './config/stateTax2026'
import type { FilingStatus } from './types'

export { NO_INCOME_TAX_STATES, STATE_TAX_2026 }

export interface StateTaxInput {
  /** Two-letter code ('' = not chosen) */
  state: string
  status: FilingStatus
  age: number
  /** Ordinary income taxed federally (withdrawals, pensions, annuities, work, rental, …), nominal */
  ordinaryIncome: number
  /** The part of ordinaryIncome that is retirement income (pre-tax withdrawals, pensions, annuities) */
  retirementIncome: number
  /** Federally taxable Social Security, nominal */
  taxableSocialSecurity: number
  /** Extra retirement income the user says is exempt, per person, today's dollars */
  retirementExclusionPerPerson: number
  /** Price level vs. 2026: brackets, deductions and the exclusion are scaled by it */
  priceLevel: number
}

export const stateRule = (state: string): StateTaxRule | null => STATE_TAX_2026[state] ?? null

/**
 * Approximate state income tax for a retired year: federal ordinary income, minus exempt
 * retirement income, plus Social Security in states that tax it, minus the state standard
 * deduction and personal exemptions, through the state's 2026 brackets, minus credits.
 * Not modeled: income-based phase-outs, local/city taxes, state-specific Social Security
 * exemptions (states that tax it are charged on the federally taxable amount).
 */
export function stateIncomeTax(input: StateTaxInput): number {
  const rule = stateRule(input.state)
  if (!rule) return 0
  const people = input.status === 'married' ? 2 : 1
  const p = input.priceLevel

  const fullyExempt = rule.exemptRetirementIncomeFromAge !== null && input.age >= rule.exemptRetirementIncomeFromAge
  const exemptRetirement = fullyExempt
    ? input.retirementIncome
    : Math.min(input.retirementIncome, input.retirementExclusionPerPerson * people * p)

  const income =
    input.ordinaryIncome - exemptRetirement + (rule.taxesSocialSecurity ? input.taxableSocialSecurity : 0)
  const taxable = Math.max(
    income - (rule.standardDeduction[input.status] + rule.exemption[input.status]) * p,
    0,
  )

  let tax = 0
  const brackets = rule.brackets[input.status]
  brackets.forEach(([threshold, rate], i) => {
    const lower = threshold * p
    const upper = i + 1 < brackets.length ? brackets[i + 1][0] * p : Infinity
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * rate
  })
  return Math.max(tax - rule.credit[input.status] * p, 0)
}

/** Short description of how a state treats retirees, for the form. */
export function describeStateRule(state: string): string {
  if (!state) return 'Choose your state to include state income tax.'
  if (NO_INCOME_TAX_STATES[state]) {
    return state === 'WA'
      ? 'No tax on wages or retirement income (Washington’s capital gains tax isn’t modeled).'
      : 'No state income tax.'
  }
  const rule = stateRule(state)
  if (!rule) return ''
  const rates = rule.brackets.single.map(([, r]) => r).filter((r) => r > 0)
  const top = Math.max(...rates)
  const rateText = rates.length === 1 ? `flat ${(top * 100).toFixed(2)}%` : `${(Math.min(...rates) * 100).toFixed(2)}%–${(top * 100).toFixed(2)}%`
  const parts = [`Income tax ${rateText}.`]
  if (rule.exemptRetirementIncomeFromAge !== null) {
    parts.push(
      rule.exemptRetirementIncomeFromAge > 0
        ? `Retirement income (IRA, 401(k), pensions) is exempt from about age ${rule.exemptRetirementIncomeFromAge}.`
        : 'Retirement income (IRA, 401(k), pensions) is exempt.',
    )
  }
  parts.push(rule.taxesSocialSecurity ? 'Taxes some Social Security (exemptions not modeled, so this may overstate).' : 'Social Security isn’t taxed.')
  return parts.join(' ')
}
