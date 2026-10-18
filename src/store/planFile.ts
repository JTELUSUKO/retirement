import { NO_INCOME_TAX_STATES, STATE_TAX_2026, type Plan } from '../engine'
import { PLAN_VERSION, migratePlanState } from './planStore'

const APP_ID = 'retirement-planner'
export const MAX_FILE_BYTES = 1_000_000

const ACCOUNT_TYPES = ['401k', 'traditional-ira', 'roth', 'hsa', 'taxable', 'cash']
const INCOME_KINDS = ['pension', 'annuity', 'work', 'rental', 'other']

export interface PlanFile {
  app: typeof APP_ID
  version: number
  exportedAt: string
  plan: Plan
}

/** JSON text for a backup file. */
export function serializePlan(plan: Plan, now = new Date()): string {
  const file: PlanFile = { app: APP_ID, version: PLAN_VERSION, exportedAt: now.toISOString(), plan }
  return JSON.stringify(file, null, 2)
}

export const backupFileName = (now = new Date()) => `retirement-plan-${now.toISOString().slice(0, 10)}.json`

export type ParseResult = { ok: true; plan: Plan } | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Returns the first problem with the plan's shape, or null if it looks complete. */
function shapeProblem(plan: unknown): string | null {
  if (!isObj(plan)) return 'the plan is missing'
  for (const key of ['currentAge', 'retirementAge', 'lifeExpectancy', 'annualSpending', 'socialSecurityAtFRA', 'spouseSocialSecurityAtFRA', 'spouseCurrentAge', 'spouseClaimAge', 'socialSecurityClaimAge']) {
    if (!isNum(plan[key])) return `“${key}” must be a number`
  }
  if (plan.filingStatus !== 'single' && plan.filingStatus !== 'married') return '“filingStatus” must be single or married'
  if (typeof plan.state !== 'string' || (plan.state !== '' && !STATE_TAX_2026[plan.state] && !NO_INCOME_TAX_STATES[plan.state])) {
    return '“state” must be a US state code'
  }
  if (!isNum(plan.stateRetirementExclusion)) return '“stateRetirementExclusion” must be a number'

  for (const [group, keys] of [
    ['assumptions', ['returnPreRetirement', 'returnPostRetirement', 'volatilityPreRetirement', 'volatilityPostRetirement', 'inflation', 'annualFee']],
    ['healthcare', ['preMedicareAnnual', 'medicareAnnual', 'excessInflation']],
  ] as const) {
    const obj = plan[group]
    if (!isObj(obj)) return `“${group}” is missing`
    for (const key of keys) if (!isNum(obj[key])) return `“${group}.${key}” must be a number`
  }

  if (!Array.isArray(plan.accounts)) return '“accounts” must be a list'
  for (const [i, a] of plan.accounts.entries()) {
    if (!isObj(a) || typeof a.id !== 'string' || typeof a.name !== 'string') return `account ${i + 1} is incomplete`
    if (!ACCOUNT_TYPES.includes(a.type as string)) return `account “${a.name}” has an unknown type`
    for (const key of ['balance', 'annualContribution', 'employerMatch']) {
      if (!isNum(a[key])) return `account “${a.name}”: “${key}” must be a number`
    }
    if (a.costBasis !== null && !isNum(a.costBasis)) return `account “${a.name}”: cost basis must be a number or empty`
  }

  const survivor = plan.survivor
  if (
    !isObj(survivor) ||
    typeof survivor.enabled !== 'boolean' ||
    (survivor.whoDies !== 'you' && survivor.whoDies !== 'spouse') ||
    !isNum(survivor.firstDeathAge) ||
    !isNum(survivor.spendingShare)
  ) {
    return 'the survivor settings are incomplete'
  }

  const conv = plan.rothConversion
  if (
    !isObj(conv) ||
    typeof conv.enabled !== 'boolean' ||
    typeof conv.stayUnderIrmaa !== 'boolean' ||
    !isNum(conv.fillToRate) ||
    !isNum(conv.fromAge) ||
    !isNum(conv.toAge)
  ) {
    return 'the Roth conversion settings are incomplete'
  }

  const annuity = plan.annuityPurchase
  if (!isObj(annuity)) return '“annuityPurchase” is missing'
  if (typeof annuity.enabled !== 'boolean' || typeof annuity.inflationAdjusted !== 'boolean') return 'the annuity settings are incomplete'
  if (!isNum(annuity.amount) || !isNum(annuity.purchaseAge)) return 'the annuity settings are incomplete'
  if (annuity.payoutRate !== null && !isNum(annuity.payoutRate)) return 'the annuity payout rate must be a number or empty'
  if (annuity.fundedFrom !== 'pretax' && annuity.fundedFrom !== 'aftertax') return 'the annuity funding source is invalid'

  if (!Array.isArray(plan.scenarios)) return '“scenarios” must be a list'
  for (const [i, sc] of plan.scenarios.entries()) {
    if (!isObj(sc) || typeof sc.id !== 'string' || typeof sc.name !== 'string' || !isObj(sc.overrides)) {
      return `scenario ${i + 1} is incomplete`
    }
    if (!['none', 'crash', 'high-inflation'].includes(sc.stress as string)) return `scenario “${sc.name}” has an unknown stress test`
    if (![1, 2, 3].includes(sc.slot as number)) return `scenario “${sc.name}” has an invalid color slot`
    for (const key of ['retirementAge', 'annualSpending', 'socialSecurityClaimAge', 'survivorDeathAge']) {
      if (sc.overrides[key] !== undefined && !isNum(sc.overrides[key])) return `scenario “${sc.name}”: “${key}” must be a number`
    }
    if (sc.overrides.annuityEnabled !== undefined && typeof sc.overrides.annuityEnabled !== 'boolean') {
      return `scenario “${sc.name}”: “annuityEnabled” must be true or false`
    }
  }

  if (!Array.isArray(plan.incomeStreams)) return '“incomeStreams” must be a list'
  for (const [i, s] of plan.incomeStreams.entries()) {
    if (!isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string') return `income ${i + 1} is incomplete`
    if (!INCOME_KINDS.includes(s.kind as string)) return `income “${s.name}” has an unknown type`
    if (!isNum(s.annualAmount) || !isNum(s.startAge) || !isNum(s.taxableShare) || !isNum(s.survivorShare)) {
      return `income “${s.name}” is incomplete`
    }
    if (s.endAge !== null && !isNum(s.endAge)) return `income “${s.name}”: end age must be a number or empty`
    if (typeof s.inflationAdjusted !== 'boolean') return `income “${s.name}”: “inflationAdjusted” must be true or false`
  }
  return null
}

/** Parse and check a backup file; older versions are upgraded. Never throws. */
export function parsePlanFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file isn’t valid JSON.' }
  }
  if (!isObj(data) || data.app !== APP_ID || !isNum(data.version)) {
    return { ok: false, error: 'This doesn’t look like a Retirement Planner backup file.' }
  }
  if (data.version > PLAN_VERSION) {
    return { ok: false, error: 'This file was made by a newer version of the app. Reload the page and try again.' }
  }
  try {
    const plan: unknown = migratePlanState(structuredClone({ plan: data.plan }), data.version).plan
    const problem = shapeProblem(plan)
    return problem ? { ok: false, error: `The file is damaged or incomplete: ${problem}.` } : { ok: true, plan: plan as Plan }
  } catch {
    return { ok: false, error: 'The file is damaged or incomplete.' }
  }
}
