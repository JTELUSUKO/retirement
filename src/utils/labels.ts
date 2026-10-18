import type { AccountType, IncomeKind, Plan, Scenario } from '../engine'
import { formatUSD, formatUSDCompact } from './format'
import { applyScenario, planEndAge, spouseOffset, STRESS_LABEL } from '../engine'

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
  if (o.survivorDeathAge !== undefined) {
    parts.push(o.survivorDeathAge > 0 ? `${plan.survivor.whoDies === 'you' ? 'You die' : 'Spouse dies'} at ${o.survivorDeathAge}` : 'Both live')
  }
  if (scenario.stress !== 'none') parts.push(STRESS_LABEL[scenario.stress])
  return parts.join('; ') || 'No changes'
}

/** An age on the plan's timeline (yours), with the spouse's age alongside when it differs: "98 (spouse 95)". */
export const ageLabel = (plan: Plan, yourAge: number): string =>
  spouseOffset(plan) === 0 ? `${yourAge}` : `${yourAge} (spouse ${yourAge + spouseOffset(plan)})`

/** Short form for table cells: "98 / 95". */
export const ageCell = (plan: Plan, yourAge: number): string =>
  spouseOffset(plan) === 0 ? `${yourAge}` : `${yourAge} / ${yourAge + spouseOffset(plan)}`

/** The final age of the plan, labeled. */
export const endLabel = (plan: Plan): string => ageLabel(plan, planEndAge(plan))

/** Short default names for new accounts. */
export const ACCOUNT_SHORT_NAME: Record<AccountType, string> = {
  '401k': '401(k)',
  'traditional-ira': 'Traditional IRA',
  roth: 'Roth IRA',
  hsa: 'HSA',
  taxable: 'Brokerage',
  cash: 'Savings',
}

/** "401(k)", or "401(k) 2" if that name is taken. */
export function defaultAccountName(type: AccountType, takenNames: string[]): string {
  const base = ACCOUNT_SHORT_NAME[type]
  if (!takenNames.includes(base)) return base
  let n = 2
  while (takenNames.includes(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** True if `name` is still an automatic name (so changing the type may rename it). */
export function isAutoAccountName(name: string, type: AccountType): boolean {
  const base = ACCOUNT_SHORT_NAME[type]
  return name === 'New account' || name === base || new RegExp(`^${base.replace(/[()]/g, '\\$&')} \\d+$`).test(name)
}

const pctText = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`

/** One-line summaries shown when a form section is collapsed. */
export function sectionSummaries(plan: Plan): Record<string, string> {
  const total = plan.accounts.reduce((sum, a) => sum + a.balance, 0)
  const incomeTotal = plan.incomeStreams.reduce((sum, s) => sum + s.annualAmount, 0)
  const s = plan.survivor
  const ltc = plan.longTermCare
  const conv = plan.rothConversion
  const a = plan.assumptions
  return {
    you: plan.currentAge
      ? `${plan.filingStatus === 'married' ? 'Married' : 'Single'} · ${plan.currentAge} → retire ${plan.retirementAge || '?'} · plan to ${plan.lifeExpectancy || '?'}${plan.state ? ` · ${plan.state}` : ''}`
      : 'Not filled in yet',
    accounts: plan.accounts.length
      ? `${plan.accounts.length} account${plan.accounts.length === 1 ? '' : 's'} · ${formatUSD(total)}`
      : 'No accounts yet',
    spending: `${plan.annualSpending ? `${formatUSD(plan.annualSpending)}/yr` : 'Spending not set'} · Social Security ${formatUSD(plan.socialSecurityAtFRA)}/mo${plan.spendingRule.type === 'guardrails' ? ' · guardrails' : ''}`,
    survivor: s.enabled ? `${s.whoDies === 'you' ? 'You die' : 'Spouse dies'} at ${s.firstDeathAge}` : 'Not modeled',
    income: plan.incomeStreams.length
      ? `${plan.incomeStreams.length} source${plan.incomeStreams.length === 1 ? '' : 's'} · ${formatUSD(incomeTotal)}/yr`
      : 'None',
    annuity: plan.annuityPurchase.enabled ? `${formatUSDCompact(plan.annuityPurchase.amount)} at ${plan.annuityPurchase.purchaseAge}` : 'None',
    ltc: ltc.enabled ? `${formatUSDCompact(ltc.annualCost)}/yr for ${ltc.years} years from ${ltc.startAge}` : 'Not modeled',
    tax: conv.enabled ? `Roth conversions to the ${Math.round(conv.fillToRate * 100)}% bracket` : 'No Roth conversions',
    healthcare: `${formatUSD(plan.healthcare.preMedicareAnnual)} before Medicare · ${formatUSD(plan.healthcare.medicareAnnual)} on Medicare`,
    assumptions: `Returns ${pctText(a.returnPreRetirement)} / ${pctText(a.returnPostRetirement)} · inflation ${pctText(a.inflation)} · fees ${pctText(a.annualFee, 2)}`,
  }
}

/** Advanced settings that are switched on (so Basic mode can say they still apply). */
export function activeAdvancedSettings(plan: Plan): string[] {
  const active: string[] = []
  if (plan.spendingRule.type === 'guardrails') active.push('guardrails spending')
  if (plan.filingStatus === 'married' && plan.survivor.enabled) active.push('a spouse dying first')
  if (plan.incomeStreams.length) active.push('other income')
  if (plan.annuityPurchase.enabled) active.push('an annuity purchase')
  if (plan.longTermCare.enabled) active.push('long-term care')
  if (plan.rothConversion.enabled) active.push('Roth conversions')
  return active
}
