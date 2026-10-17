import type { MarketFn, YearMarket } from './projection'
import type { Plan } from './types'

/** Changes a scenario makes to the base plan; anything left undefined follows the base plan. */
export interface ScenarioOverrides {
  retirementAge?: number
  annualSpending?: number
  socialSecurityClaimAge?: number
  annuityEnabled?: boolean
}

export type StressTest = 'none' | 'crash' | 'high-inflation'

export interface Scenario {
  id: string
  name: string
  overrides: ScenarioOverrides
  stress: StressTest
}

/** Return in the first year of retirement under the crash stress test. */
export const CRASH_RETURN = -0.3
/** Extra inflation, and for how many years from retirement, under the high-inflation test. */
export const HIGH_INFLATION_EXTRA = 0.03
export const HIGH_INFLATION_YEARS = 10

export const STRESS_LABEL: Record<StressTest, string> = {
  none: 'None',
  crash: `${Math.abs(CRASH_RETURN * 100)}% crash in first retirement year`,
  'high-inflation': `Inflation +${HIGH_INFLATION_EXTRA * 100} pts for ${HIGH_INFLATION_YEARS} years from retirement`,
}

/** Adjusts each year's market conditions (used for stress tests). */
export type MarketAdjust = (t: number, retired: boolean, market: YearMarket) => YearMarket

/** The base plan with a scenario's overrides applied. */
export function applyScenario(plan: Plan, scenario: Scenario): Plan {
  const o = scenario.overrides
  const retirementAge = o.retirementAge ?? plan.retirementAge
  return {
    ...plan,
    retirementAge,
    annualSpending: o.annualSpending ?? plan.annualSpending,
    socialSecurityClaimAge: o.socialSecurityClaimAge ?? plan.socialSecurityClaimAge,
    annuityPurchase: {
      ...plan.annuityPurchase,
      enabled: o.annuityEnabled ?? plan.annuityPurchase.enabled,
      // Keep the purchase at retirement if the base plan bought it then
      purchaseAge:
        plan.annuityPurchase.purchaseAge === plan.retirementAge ? retirementAge : plan.annuityPurchase.purchaseAge,
    },
  }
}

/** Market adjustment for a stress test, given the (scenario) plan. Undefined = no change. */
export function stressAdjust(plan: Plan, stress: StressTest): MarketAdjust | undefined {
  const firstRetiredT = plan.retirementAge - plan.currentAge
  if (stress === 'crash') {
    return (t, _retired, m) => (t === firstRetiredT ? { ...m, return: CRASH_RETURN } : m)
  }
  if (stress === 'high-inflation') {
    return (t, _retired, m) =>
      t >= firstRetiredT && t < firstRetiredT + HIGH_INFLATION_YEARS ? { ...m, inflation: m.inflation + HIGH_INFLATION_EXTRA } : m
  }
  return undefined
}

/** Wrap a market function with an optional adjustment. */
export const withAdjust = (market: MarketFn, adjust?: MarketAdjust): MarketFn =>
  adjust ? (t, retired) => adjust(t, retired, market(t, retired)) : market
