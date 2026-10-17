export * from './types'
export { projectPlan, simulatePath } from './projection'
export type { MarketFn, YearMarket } from './projection'
export { runMonteCarlo } from './monteCarlo'
export { validatePlan, AGE_LIMITS } from './validation'
export { BUCKETS, BUCKET_OF, WITHDRAWAL_ORDER } from './accounts'
export { rmdStartAge, requiredMinimumDistribution } from './rmd'
export { federalIncomeTax, taxableSocialSecurity } from './taxes'
export { healthcareCost } from './healthcare'
export { incomeAtAge } from './income'
export { annuityTaxableShare, estimatePayoutRate, payoutRate } from './annuity'
export { benefitAtClaimAge } from './socialSecurity'
export { CONFIG_2026 } from './config/2026'
export {
  applyScenario,
  stressAdjust,
  STRESS_LABEL,
  CRASH_RETURN,
  HIGH_INFLATION_EXTRA,
  HIGH_INFLATION_YEARS,
} from './scenarios'
export type { Scenario, ScenarioOverrides, StressTest, MarketAdjust } from './scenarios'
export { evaluatePlan } from './evaluate'
export type { PlanEvaluation } from './evaluate'
