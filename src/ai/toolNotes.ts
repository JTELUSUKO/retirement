import { formatUSD } from '../utils/format'

/** Plain-language note for a tool call shown under Claude's answer. */
export function describeToolCall(name: string, input: unknown, isError: boolean): string {
  if (isError) return 'A calculation request was invalid; Claude retried.'
  if (name === 'get_plan_results') return 'Checked your plan’s results'
  if (name === 'find_safe_spending' && typeof input === 'object' && input) {
    const t = (input as { targetChance?: unknown }).targetChance
    return `Found safe spending for a ${typeof t === 'number' ? Math.round(t * 100) : '?'}% chance`
  }
  if (name === 'run_what_if' && typeof input === 'object' && input) {
    const i = input as Record<string, unknown>
    const parts: string[] = []
    if (typeof i.retirementAge === 'number') parts.push(`retire at ${i.retirementAge}`)
    if (typeof i.annualSpending === 'number') parts.push(`spend ${formatUSD(i.annualSpending)}/yr`)
    if (typeof i.socialSecurityClaimAge === 'number') parts.push(`Social Security at ${i.socialSecurityClaimAge}`)
    if (typeof i.annuityEnabled === 'boolean') parts.push(i.annuityEnabled ? 'with the annuity' : 'without the annuity')
    if (typeof i.survivorDeathAge === 'number') parts.push(i.survivorDeathAge > 0 ? `one spouse dies at ${i.survivorDeathAge}` : 'both live')
    if (typeof i.guardrails === 'boolean') parts.push(i.guardrails ? 'spending guardrails' : 'fixed spending')
    if (typeof i.rothConversionRate === 'number') {
      parts.push(i.rothConversionRate > 0 ? `Roth conversions to the ${Math.round(i.rothConversionRate * 100)}% bracket` : 'no Roth conversions')
    }
    if (i.stress === 'crash') parts.push('market crash at retirement')
    if (i.stress === 'high-inflation') parts.push('high inflation')
    if (i.stress === 'long-term-care') parts.push('long-term care need')
    return `Ran a what-if: ${parts.join(', ') || 'no changes'}`
  }
  return `Ran ${name}`
}
