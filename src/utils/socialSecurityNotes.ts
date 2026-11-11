import { spouseOffset, TAX_CONFIG, type Plan } from '../engine'

const { fullRetirementAge } = TAX_CONFIG.socialSecurity

export type EarlyStopper = 'you' | 'spouse' | 'both'

/**
 * Who stops work before the full retirement age their ssa.gov estimate assumes they earn until, when you retire at
 * `retirementAge`. Couples retire together, so a younger spouse can stop early when you don't. Null when nobody does.
 */
export function stopsEarningEarly(plan: Plan, retirementAge: number): EarlyStopper | null {
  const you = retirementAge < fullRetirementAge
  const spouse = plan.filingStatus === 'married' && plan.spouseSocialSecurityAtFRA > 0 && retirementAge + spouseOffset(plan) < fullRetirementAge
  return you && spouse ? 'both' : you ? 'you' : spouse ? 'spouse' : null
}

// The one wording of what an ssa.gov estimate assumes, shared by the plan form, the heatmap and the printed summary
const ASSUMES: Record<EarlyStopper, string> = {
  you: `Your ssa.gov estimate assumes you keep earning until ${fullRetirementAge}.`,
  spouse: `Your spouse’s ssa.gov estimate assumes they keep earning until ${fullRetirementAge}.`,
  both: `Your ssa.gov estimates assume you each keep earning until ${fullRetirementAge}.`,
}
export const ssaEstimateAssumes = (who: EarlyStopper = 'you') => ASSUMES[who]

export const SSA_FEWER_YEARS = 'Stopping work sooner means fewer earning years, which can lower the benefit, especially with fewer than 35 years of earnings.'
