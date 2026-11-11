import { applyScenario, spouseOffset, TAX_CONFIG, validatePlan, type Plan } from '../engine'
import { stopsEarningEarly } from './socialSecurityNotes'
import { BORDERLINE_PCT, STRONG_PCT, VERDICT_WORD, verdictFor } from './levers'

export interface HeatCell {
  key: string
  retirementAge: number
  claimAge: number
  /** The plan with these two ages; null when the combination isn't valid (an annuity bought before retiring, say) */
  plan: Plan | null
}

export interface HeatGrid {
  retireAges: number[]
  /** Highest first: the table's top row, so claiming age goes up the chart */
  claimAges: number[]
  cells: HeatCell[]
}

/** Each column adds a full row of simulations, so a long way from retiring only shows the years around the plan */
const MAX_RETIRE_COLUMNS = 16
const LAST_RETIRE_AGE = 70
const YEARS_BEFORE_PLAN = 5

export const heatKey = (retirementAge: number, claimAge: number) => `${retirementAge}:${claimAge}`

/** Retirement ages to show, always including the plan's (a valid plan: currentAge <= retirementAge < lifeExpectancy) */
function retireAgesFor(plan: Plan): number[] {
  let last = Math.max(Math.min(LAST_RETIRE_AGE, plan.lifeExpectancy - 1), plan.retirementAge)
  let first = Math.max(plan.currentAge, last - MAX_RETIRE_COLUMNS + 1)
  if (plan.retirementAge < first) {
    first = Math.max(plan.currentAge, plan.retirementAge - YEARS_BEFORE_PLAN)
    last = Math.min(first + MAX_RETIRE_COLUMNS - 1, plan.lifeExpectancy - 1)
  }
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

/** Claiming ages to show: those still ahead of you, plus the plan's own */
function claimAgesFor(plan: Plan): number[] {
  const { earliestClaimAge, latestClaimAge } = TAX_CONFIG.socialSecurity
  const ages: number[] = []
  for (let age = latestClaimAge; age >= earliestClaimAge; age--) {
    if (age >= plan.currentAge || age === plan.socialSecurityClaimAge) ages.push(age)
  }
  return ages
}

/** Every retirement and claiming age to test, each built like a Compare scenario */
export function heatmapGrid(plan: Plan): HeatGrid {
  const retireAges = retireAgesFor(plan)
  const claimAges = claimAgesFor(plan)
  const cells = claimAges.flatMap((claimAge) =>
    retireAges.map((retirementAge): HeatCell => {
      const tested = applyScenario(plan, {
        id: 'heatmap',
        name: 'Heatmap',
        slot: 1,
        stress: 'none',
        overrides: { retirementAge, socialSecurityClaimAge: claimAge },
      })
      return { key: heatKey(retirementAge, claimAge), retirementAge, claimAge, plan: validatePlan(tested).length === 0 ? tested : null }
    }),
  )
  return { retireAges, claimAges, cells }
}

const hasSpouseBenefit = (plan: Plan) => plan.filingStatus === 'married' && plan.spouseSocialSecurityAtFRA > 0

/**
 * Whether a benefit (yours or your spouse's) would start while you're still working at these ages, which is when
 * the earnings limit and the plan's pay come into it
 */
export function claimsWhileWorking(plan: Plan, retirementAge: number, claimAge: number): boolean {
  // In your age, as the engine times it; never if there's no spouse's benefit
  const spouseClaim = hasSpouseBenefit(plan) ? plan.spouseClaimAge - spouseOffset(plan) : Infinity
  // Retiring now leaves no working years
  return plan.currentAge < retirementAge && Math.min(claimAge, spouseClaim) < retirementAge
}

/** Whether one of those benefits would start before full retirement age, so the earnings limit could withhold it */
export function earningsLimitApplies(plan: Plan, retirementAge: number, claimAge: number): boolean {
  const { fullRetirementAge } = TAX_CONFIG.socialSecurity
  const yours = claimAge < Math.min(retirementAge, fullRetirementAge)
  const spouses = hasSpouseBenefit(plan) && plan.spouseClaimAge < fullRetirementAge && plan.spouseClaimAge - spouseOffset(plan) < retirementAge
  return plan.currentAge < retirementAge && (yours || spouses)
}

/** Whether any tested cell has someone stopping work before full retirement age (see stopsEarningEarly) */
export const showsRetiringEarly = (grid: HeatGrid, plan: Plan) => grid.cells.some((c) => c.plan && stopsEarningEarly(plan, c.retirementAge) !== null)

/** Whether any tested cell starts a benefit while still working */
export const showsClaimingWhileWorking = (grid: HeatGrid, plan: Plan) =>
  grid.cells.some((c) => c.plan && claimsWhileWorking(plan, c.retirementAge, c.claimAge))

/** A cell's change to the latest plan: only the ages it moved from `base`, so it can't undo other edits */
export function heatCellPatch(latest: Plan, base: Plan, cell: HeatCell): Partial<Plan> {
  const purchaseAge = cell.plan?.annuityPurchase.purchaseAge ?? base.annuityPurchase.purchaseAge
  return {
    ...(cell.retirementAge !== base.retirementAge && { retirementAge: cell.retirementAge }),
    ...(cell.claimAge !== base.socialSecurityClaimAge && { socialSecurityClaimAge: cell.claimAge }),
    // An annuity bought at retirement moves with it, as it did in the cell's simulation
    ...(purchaseAge !== base.annuityPurchase.purchaseAge && { annuityPurchase: { ...latest.annuityPurchase, purchaseAge } }),
  }
}

/** Undoes `patch`: what each field it changed held in `before`, so anything else in the plan stays as it is */
export function heatUndoPatch(patch: Partial<Plan>, before: Plan): Partial<Plan> {
  return Object.fromEntries(Object.keys(patch).map((field) => [field, before[field as keyof Plan]]))
}

/**
 * Color bands, lowest first, in the app's verdict language (the two verdict lines come from levers.ts). Teal and
 * orange rather than green and red, which many colorblind readers can't tell apart; the middle band is neutral.
 */
export const HEAT_BANDS = [
  { upTo: 49, label: 'Under 50%', className: 'bg-orange-500 text-slate-900 dark:bg-orange-700 dark:text-white' },
  { upTo: BORDERLINE_PCT - 1, label: `50–${BORDERLINE_PCT - 1}%`, className: 'bg-orange-300 text-slate-900 dark:bg-orange-900 dark:text-white' },
  { upTo: STRONG_PCT - 1, label: `${BORDERLINE_PCT}–${STRONG_PCT - 1}%`, className: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' },
  { upTo: 94, label: `${STRONG_PCT}–94%`, className: 'bg-teal-300 text-slate-900 dark:bg-teal-700 dark:text-white' },
  { upTo: 100, label: '95%+', className: 'bg-teal-700 text-white dark:bg-teal-300 dark:text-slate-900' },
]

/** The band for a success rate, judged on the rounded percentage shown */
export const heatBand = (rate: number) => HEAT_BANDS.find((b) => Math.round(rate * 100) <= b.upTo)!

/** The percentage shown */
export const heatPct = (rate: number) => Math.round(rate * 100)

/**
 * The one rule for small differences: each number comes from 1,000 simulated markets and can be a few points off, so
 * a cell within this many points of the plan is called about the same, never a gain or a loss.
 */
export const HEAT_NOISE_POINTS = 3

/** The combination closest to the plan's ages that reaches strong, the higher chance on a tie; null if none does */
export function nearestStrong(grid: HeatGrid, values: Record<string, number>, plan: Plan): HeatCell | null {
  let best: { cell: HeatCell; distance: number; pct: number } | null = null
  for (const cell of grid.cells) {
    const rate = values[cell.key]
    if (!cell.plan || rate === undefined) continue
    const pct = heatPct(rate)
    if (verdictFor(pct / 100) !== 'strong') continue
    const distance = Math.abs(cell.retirementAge - plan.retirementAge) + Math.abs(cell.claimAge - plan.socialSecurityClaimAge)
    if (!best || distance < best.distance || (distance === best.distance && pct > best.pct)) best = { cell, distance, pct }
  }
  return best?.cell ?? null
}

export interface HeatCheer {
  emoji: string
  text: string
}

/** A gain smaller than this, inside the same verdict, isn't worth a message */
const CHEER_MIN_POINTS = 5

/**
 * A word of encouragement for a better result, given the percentages shown. It praises the outcome, never the choice:
 * the planner can say a combination scores higher, not that it's right for someone. A gain within the noise gets none,
 * even one that crosses a verdict line.
 */
export function heatCheer(cellPct: number, planPct: number): HeatCheer | null {
  const points = cellPct - planPct
  if (points < HEAT_NOISE_POINTS) return null
  const from = verdictFor(planPct / 100)
  const to = verdictFor(cellPct / 100)
  if (from !== to) {
    return to === 'strong'
      ? { emoji: '🎉', text: `Great result! This moves your plan from ${VERDICT_WORD[from]} to strong.` }
      : { emoji: '👍', text: `Nice step forward. This moves your plan from ${VERDICT_WORD[from]} to ${VERDICT_WORD[to]}.` }
  }
  if (points < CHEER_MIN_POINTS) return null
  if (to === 'strong') return { emoji: '🌟', text: 'Even stronger. This adds to your cushion.' }
  return { emoji: '📈', text: `A good gain, though still ${VERDICT_WORD[to]}.` }
}

/** A cell against the plan, in points of the percentages shown; `same` when the difference is within the noise */
export function heatDelta(rate: number, planRate: number): { points: number; same: boolean } {
  const points = heatPct(rate) - heatPct(planRate)
  return { points, same: Math.abs(points) < HEAT_NOISE_POINTS }
}
