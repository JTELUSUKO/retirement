import { applyScenario, planEndAge, type Plan, type Scenario } from '../engine'
import { formatUSD } from './format'
import { roundSpending, SCENARIO_PRESETS } from './scenarioPresets'

export interface Lever {
  key: string
  /** e.g. "Retire at 67 instead of 65" */
  label: string
  /** The plan with this change */
  plan: Plan
  /** Compare-page preset that makes the same change (the lever's plan is built from it) */
  preset?: string
}

const apply = (plan: Plan, change: Omit<Scenario, 'id' | 'slot'>) => applyScenario(plan, { ...change, id: 'lever', slot: 1 })

/** A lever built from a Compare-page preset, so "Compare" adds exactly the change that was tested. */
function fromPreset(plan: Plan, key: string, label: (change: Omit<Scenario, 'id' | 'slot'>) => string): Lever {
  const change = SCENARIO_PRESETS.find((p) => p.key === key)!.make(plan)
  return { key, label: label(change), plan: apply(plan, change), preset: key }
}

/** Common, actionable changes to test against the plan ("what would help most"). */
export function leverVariants(plan: Plan): Lever[] {
  const levers: Lever[] = []
  const r = plan.retirementAge
  if (r + 2 < planEndAge(plan)) {
    levers.push(fromPreset(plan, 'later', (c) => `Retire at ${c.overrides.retirementAge} instead of ${r}`))
  }
  const less = SCENARIO_PRESETS.find((p) => p.key === 'spend-less')!.make(plan).overrides.annualSpending!
  if (less > 0 && less < plan.annualSpending) {
    levers.push(fromPreset(plan, 'spend-less', () => `Spend ${formatUSD(less)} a year instead of ${formatUSD(plan.annualSpending)}`))
  }
  if (plan.socialSecurityAtFRA > 0 && plan.socialSecurityClaimAge < 70) {
    levers.push(fromPreset(plan, 'ss70', () => `Claim Social Security at 70 instead of ${plan.socialSecurityClaimAge}`))
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
  const more = roundSpending(plan.annualSpending * 1.1)
  return {
    key: 'spend-more',
    label: `Spending ${formatUSD(more)} a year instead of ${formatUSD(plan.annualSpending)}`,
    plan: apply(plan, { name: 'Spend more', overrides: { annualSpending: more }, stress: 'none' }),
  }
}

export type Verdict = 'strong' | 'borderline' | 'at-risk'
/** Judged on the rounded percentage shown, so "85%" is never called borderline. */
export function verdictFor(successRate: number): Verdict {
  const pct = Math.round(successRate * 100)
  return pct >= 85 ? 'strong' : pct >= 70 ? 'borderline' : 'at-risk'
}

/** "a" or "an" before a spoken percentage: an 8%, an 11%, an 18%, an 80–89%, but a 1%, a 100% */
export const articleFor = (pct: number) => (/^(8|11|18)/.test(String(pct)) && ![1, 180].includes(pct) ? 'an' : 'a')

/** "a 64%" / "an 85%" */
export const withArticle = (pct: number) => `${articleFor(pct)} ${pct}%`
