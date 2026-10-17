import type { AccountType, IncomeKind, Plan, Scenario } from '../engine'
import { applyScenario, STRESS_LABEL } from '../engine'
import { formatUSD } from './format'

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  '401k': '401(k) / 403(b)',
  'traditional-ira': 'Traditional IRA',
  roth: 'Roth IRA / Roth 401(k)',
  hsa: 'HSA',
  taxable: 'Taxable brokerage',
  cash: 'Cash / savings',
}

export const INCOME_KIND_LABEL: Record<IncomeKind, string> = {
  annuity: 'Annuity',
  pension: 'Pension',
  work: 'Part-time work',
  rental: 'Rental income',
  other: 'Other',
}

/** Plain-language list of what a scenario changes, e.g. "Retire at 63; 30% crash in first retirement year". */
export function describeScenario(plan: Plan, scenario: Scenario): string {
  const p = applyScenario(plan, scenario)
  const o = scenario.overrides
  const parts: string[] = []
  if (o.retirementAge !== undefined) parts.push(`Retire at ${p.retirementAge}`)
  if (o.annualSpending !== undefined) parts.push(`Spend ${formatUSD(p.annualSpending)}/yr`)
  if (o.socialSecurityClaimAge !== undefined) parts.push(`Social Security at ${p.socialSecurityClaimAge}`)
  if (o.annuityEnabled !== undefined) parts.push(o.annuityEnabled ? 'With the annuity' : 'Without the annuity')
  if (o.survivorDeathAge !== undefined) parts.push(o.survivorDeathAge > 0 ? `One spouse dies at ${o.survivorDeathAge}` : 'Both live')
  if (scenario.stress !== 'none') parts.push(STRESS_LABEL[scenario.stress])
  return parts.join('; ') || 'No changes'
}
