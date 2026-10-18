import { applyScenario, planEndAge, type Plan } from '../engine'
import { formatUSD } from './format'

export interface Lever {
  key: string
  /** e.g. "Retire at 67 instead of 65" */
  label: string
  /** The plan with this change */
  plan: Plan
  /** Scenario preset that reproduces it on the Compare page, if any */
  preset?: string
}

// Same rounding as the Compare page presets, so a lever and its scenario match
const round1000 = (n: number) => Math.round(n / 1000) * 1000
const withOverrides = (plan: Plan, overrides: Parameters<typeof applyScenario>[1]['overrides']) =>
  applyScenario(plan, { id: 'lever', name: 'lever', overrides, stress: 'none', slot: 1 })

/** Common, actionable changes to test against the plan ("what would help most"). */
export function leverVariants(plan: Plan): Lever[] {
  const levers: Lever[] = []
  const r = plan.retirementAge
  if (r + 2 < planEndAge(plan)) {
    levers.push({ key: 'later', label: `Retire at ${r + 2} instead of ${r}`, plan: withOverrides(plan, { retirementAge: r + 2 }), preset: 'later' })
  }
  const less = round1000(plan.annualSpending * 0.9)
  if (less > 0 && less < plan.annualSpending) {
    levers.push({
      key: 'spend-less',
      label: `Spend ${formatUSD(less)} a year instead of ${formatUSD(plan.annualSpending)}`,
      plan: withOverrides(plan, { annualSpending: less }),
      preset: 'spend-less',
    })
  }
  if (plan.socialSecurityAtFRA > 0 && plan.socialSecurityClaimAge < 70) {
    levers.push({
      key: 'ss70',
      label: `Claim Social Security at 70 instead of ${plan.socialSecurityClaimAge}`,
      plan: withOverrides(plan, { socialSecurityClaimAge: 70 }),
      preset: 'ss70',
    })
  }
  if (plan.spendingRule.type === 'fixed') {
    levers.push({
      key: 'guardrails',
      label: 'Be willing to trim spending after bad markets (guardrails)',
      plan: { ...plan, spendingRule: { ...plan.spendingRule, type: 'guardrails' } },
    })
  }
  return levers
}

/** "Spend 10% more" check for plans that already look strong. */
export function spendMoreVariant(plan: Plan): Lever {
  const more = round1000(plan.annualSpending * 1.1)
  return {
    key: 'spend-more',
    label: `Spend ${formatUSD(more)} a year instead of ${formatUSD(plan.annualSpending)}`,
    plan: withOverrides(plan, { annualSpending: more }),
  }
}

export type Verdict = 'strong' | 'borderline' | 'at-risk'
/** Judged on the rounded percentage shown, so "85%" is never called borderline. */
export function verdictFor(successRate: number): Verdict {
  const pct = Math.round(successRate * 100)
  return pct >= 85 ? 'strong' : pct >= 70 ? 'borderline' : 'at-risk'
}

/** "a 64%" / "an 85%" / "an 8%" / "an 11%" */
export const withArticle = (pct: number) => `${/^(8|11|18)/.test(String(pct)) && ![1, 180].includes(pct) ? 'an' : 'a'} ${pct}%`
