import { applyScenario, mixReturns, mixShare, planEndAge, type Plan, type Scenario } from '../engine'
import { formatUSD } from './format'
import { roundSpending, SCENARIO_PRESETS } from './scenarioPresets'

export interface Lever {
  key: string
  /** e.g. "Retire at 67 instead of 65" */
  label: string
  /** The plan with this change */
  plan: Plan
  /** The Compare-page scenario this lever tested, so "Compare" adds exactly that change (even if the plan moved on) */
  change?: Change
  /** Otherwise: the change to make to the latest plan, with its button text and tooltip (plain data: levers go to the workers) */
  patch?: LeverPatch & { button: string; title: string }
}

type LeverPatch =
  | { kind: 'guardrails' }
  | { kind: 'mix'; fromShare: number; returnPostRetirement: number; volatilityPostRetirement: number }

/**
 * The plan change a lever's button makes, applied to the latest plan; null when the latest plan no longer has what
 * was tested (a mix changed since, which the button must not overwrite).
 */
export function patchFor(latest: Plan, patch: LeverPatch): Partial<Plan> | null {
  if (patch.kind === 'mix' && mixShare(latest.assumptions.returnPostRetirement, latest.assumptions.volatilityPostRetirement) !== patch.fromShare) return null
  return patch.kind === 'guardrails'
    ? { spendingRule: { ...latest.spendingRule, type: 'guardrails' } }
    : { assumptions: { ...latest.assumptions, returnPostRetirement: patch.returnPostRetirement, volatilityPostRetirement: patch.volatilityPostRetirement } }
}

type Change = Omit<Scenario, 'id' | 'slot'>

const apply = (plan: Plan, change: Change) => applyScenario(plan, { ...change, id: 'lever', slot: 1 })

const presetChange = (plan: Plan, key: string) => SCENARIO_PRESETS.find((p) => p.key === key)!.make(plan)

/** A lever built from a Compare-page change, so "Compare" adds exactly the change that was tested. */
const fromChange = (plan: Plan, key: string, change: Change, label: string): Lever => ({ key, label, plan: apply(plan, change), change })

/** Common, actionable changes to test against the plan ("what would help most"). */
export function leverVariants(plan: Plan): Lever[] {
  const levers: Lever[] = []
  const r = plan.retirementAge
  if (r + 2 < planEndAge(plan)) {
    const later = presetChange(plan, 'later')
    levers.push(fromChange(plan, 'later', later, `Retire at ${later.overrides.retirementAge} instead of ${r}`))
  }
  const spendLess = presetChange(plan, 'spend-less')
  const less = spendLess.overrides.annualSpending!
  if (less > 0 && less < plan.annualSpending) {
    levers.push(fromChange(plan, 'spend-less', spendLess, `Spend ${formatUSD(less)} a year instead of ${formatUSD(plan.annualSpending)}`))
  }
  if (plan.socialSecurityAtFRA > 0 && plan.socialSecurityClaimAge < 70) {
    levers.push(fromChange(plan, 'ss70', presetChange(plan, 'ss70'), `Claim Social Security at 70 instead of ${plan.socialSecurityClaimAge}`))
  }
  if (plan.spendingRule.type === 'fixed') {
    levers.push({
      key: 'guardrails',
      label: 'Be willing to trim spending after bad markets (guardrails)',
      plan: { ...plan, spendingRule: { ...plan.spendingRule, type: 'guardrails' } },
      patch: {
        kind: 'guardrails',
        button: 'Turn on',
        title: 'Switch the spending rule to guardrails (change it back under Advanced → Spending rule)',
      },
    })
  }
  // A cautious mix after retiring: test a balanced one (more stocks means bigger ups and downs along the way)
  const share = mixShare(plan.assumptions.returnPostRetirement, plan.assumptions.volatilityPostRetirement)
  if (share !== null && share < BALANCED) {
    const m = mixReturns(BALANCED)
    const mix = { returnPostRetirement: m.mean, volatilityPostRetirement: m.volatility }
    levers.push({
      key: 'mix',
      label: `Invest ${mixLabel(BALANCED)} after retiring instead of ${mixLabel(share)} (bigger ups and downs)`,
      plan: { ...plan, assumptions: { ...plan.assumptions, ...mix } },
      patch: {
        kind: 'mix',
        fromShare: share,
        ...mix,
        button: 'Use',
        title: 'Change the mix after retiring (change it back under Assumptions)',
      },
    })
  }
  return levers
}

/** Stock share of the balanced mix tested against more cautious ones */
const BALANCED = 0.6
const mixLabel = (share: number) => `${Math.round(share * 100)}% stocks / ${Math.round((1 - share) * 100)}% bonds`

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
