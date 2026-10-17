import type Anthropic from '@anthropic-ai/sdk'
import {
  applyScenario,
  socialSecurityYearly,
  survivorFromAge,
  evaluatePlan,
  STRESS_LABEL,
  type Plan,
  type PlanEvaluation,
  type Scenario,
  type StressTest,
} from '../engine'

/**
 * Read-only tools Claude can call. They run the app's own engine in the browser, so every
 * number Claude quotes comes from the same calculation the dashboard shows.
 */
export const ASSISTANT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_plan_results',
    description:
      "Run the user's current plan and return its headline results: chance the money lasts (Monte Carlo), savings at " +
      'retirement, the average-returns outcome, savings left at the end in typical and poor markets, lifetime federal and state income tax ' +
      'and healthcare (today’s dollars), and milestone rows every 5 years. Call this before answering questions about ' +
      'how the plan is doing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    eager_input_streaming: true,
  },
  {
    name: 'run_what_if',
    description:
      "Run the user's plan with some changes and compare it with the plan as-is. Only the fields you pass change; " +
      'everything else stays as in the plan. Use this for any "what if" question instead of estimating by hand. ' +
      'You can call it several times (in parallel) to compare options, e.g. retiring at 62, 64 and 66.',
    input_schema: {
      type: 'object',
      properties: {
        retirementAge: { type: 'integer', description: 'Age to stop working (must be ≥ current age).' },
        annualSpending: { type: 'number', description: 'Yearly spending in retirement, today’s dollars, excluding healthcare.' },
        socialSecurityClaimAge: { type: 'integer', description: 'Age to claim Social Security, 62–70.' },
        annuityEnabled: { type: 'boolean', description: 'Turn the plan’s configured annuity purchase on or off.' },
        stress: {
          type: 'string',
          enum: ['none', 'crash', 'high-inflation'],
          description: `Stress test: "crash" = ${STRESS_LABEL.crash}; "high-inflation" = ${STRESS_LABEL['high-inflation']}.`,
        },
      },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
]

export type ToolName = 'get_plan_results' | 'run_what_if'

export interface WhatIfInput {
  retirementAge?: number
  annualSpending?: number
  socialSecurityClaimAge?: number
  annuityEnabled?: boolean
  stress?: StressTest
}

/** Validate a run_what_if input; returns an error message or the typed input. */
export function parseWhatIf(input: unknown): { ok: true; value: WhatIfInput } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, error: 'input must be an object' }
  const allowed = ['retirementAge', 'annualSpending', 'socialSecurityClaimAge', 'annuityEnabled', 'stress']
  const obj = input as Record<string, unknown>
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) return { ok: false, error: `unknown field "${key}"` }
  for (const key of ['retirementAge', 'annualSpending', 'socialSecurityClaimAge']) {
    if (obj[key] !== undefined && (typeof obj[key] !== 'number' || !Number.isFinite(obj[key]))) {
      return { ok: false, error: `"${key}" must be a number` }
    }
  }
  if (obj.annuityEnabled !== undefined && typeof obj.annuityEnabled !== 'boolean') return { ok: false, error: '"annuityEnabled" must be true or false' }
  if (obj.stress !== undefined && !['none', 'crash', 'high-inflation'].includes(obj.stress as string)) {
    return { ok: false, error: '"stress" must be none, crash or high-inflation' }
  }
  return { ok: true, value: obj as WhatIfInput }
}

const round = (n: number) => Math.round(n)

/** Compact, model-friendly summary of an evaluation (today's dollars). */
export function summarize(plan: Plan, e: PlanEvaluation) {
  if (e.issues.length > 0) return { problems: e.issues }
  const det = e.projection!
  return {
    chanceMoneyLastsToPlanAge: `${Math.round(e.successRate * 100)}%`,
    planToAge: plan.lifeExpectancy,
    retirementAge: plan.retirementAge,
    savingsAtRetirement: round(e.savingsAtRetirement),
    averageReturnsOutcome: e.depletionAge === null ? `lasts past ${plan.lifeExpectancy}` : `runs out at ${e.depletionAge}`,
    savingsLeftAtEnd: { typicalMarkets: round(e.leftTypical), poorMarkets10thPercentile: round(e.leftPoor) },
    lifetimeFederalTax: round(e.lifetimeFederalTax),
    lifetimeStateTax: round(e.lifetimeStateTax),
    lifetimeHealthcare: round(e.lifetimeHealthcare),
    socialSecurityMonthlyAtClaimAge: round(socialSecurityYearly(plan, false) / 12),
    ...(survivorFromAge(plan) !== Infinity ? { survivorModeled: `one spouse dies at ${plan.survivor.firstDeathAge}` } : {}),
    milestones: det.years
      .filter((y, i) => i % 5 === 0 || y.age === plan.retirementAge)
      .map((y) => ({
        age: y.age,
        savings: round(y.startBalanceReal),
        spendingInclHealthcare: round(y.spending / y.priceLevel),
        income: round(y.income / y.priceLevel),
        federalTax: round(y.federalTax / y.priceLevel),
        stateTax: round(y.stateTax / y.priceLevel),
        rmd: round(y.rmd / y.priceLevel),
      })),
    note: 'Money amounts are in today’s dollars.',
  }
}

/** Run one tool against the current plan. Returns JSON text and whether it failed. */
export function executeTool(plan: Plan, name: string, input: unknown): { content: string; isError: boolean } {
  if (name === 'get_plan_results') {
    return { content: JSON.stringify(summarize(plan, evaluatePlan(plan))), isError: false }
  }
  if (name === 'run_what_if') {
    const parsed = parseWhatIf(input)
    if (!parsed.ok) return { content: JSON.stringify({ error: parsed.error }), isError: true }
    const { stress = 'none', ...overrides } = parsed.value
    const scenario: Scenario = { id: 'what-if', name: 'What-if', overrides, stress, slot: 1 }
    const changed = applyScenario(plan, scenario)
    return {
      content: JSON.stringify({
        changes: { ...overrides, ...(stress !== 'none' ? { stress: STRESS_LABEL[stress] } : {}) },
        withChanges: summarize(changed, evaluatePlan(changed, stress)),
        currentPlan: summarize(plan, evaluatePlan(plan)),
      }),
      isError: false,
    }
  }
  return { content: JSON.stringify({ error: `unknown tool "${name}"` }), isError: true }
}
