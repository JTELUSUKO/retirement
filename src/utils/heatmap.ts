import { applyScenario, spouseOffset, TAX_CONFIG, validatePlan, type Plan } from '../engine'
import { VERDICT_WORD, verdictFor } from './levers'

export interface HeatCell {
  key: string
  retirementAge: number
  claimAge: number
  /** The plan with these two ages; null when the combination isn't valid (an annuity bought before retiring, say) */
  plan: Plan | null
  /** Benefits (yours or your spouse's) that start before you retire aren't counted until then, so this cell understates the chance */
  claimsBeforeRetiring: boolean
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
  // In your age, as the engine times it; never if there's no spouse's benefit
  const spouseClaim =
    plan.filingStatus === 'married' && plan.spouseSocialSecurityAtFRA > 0 ? plan.spouseClaimAge - spouseOffset(plan) : Infinity
  const cells = claimAges.flatMap((claimAge) =>
    retireAges.map((retirementAge): HeatCell => {
      const tested = applyScenario(plan, {
        id: 'heatmap',
        name: 'Heatmap',
        slot: 1,
        stress: 'none',
        overrides: { retirementAge, socialSecurityClaimAge: claimAge },
      })
      return {
        key: heatKey(retirementAge, claimAge),
        retirementAge,
        claimAge,
        plan: validatePlan(tested).length === 0 ? tested : null,
        // Retiring now leaves no working years for a benefit to be missed in
        claimsBeforeRetiring: plan.currentAge < retirementAge && Math.min(claimAge, spouseClaim) < retirementAge,
      }
    }),
  )
  return { retireAges, claimAges, cells }
}

/** Whether any tested cell stops work before the full retirement age the ssa.gov estimate assumes you earn until */
export const showsRetiringEarly = (grid: HeatGrid) =>
  grid.cells.some((c) => c.plan && c.retirementAge < TAX_CONFIG.socialSecurity.fullRetirementAge)

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
 * Color bands, lowest first, in the app's verdict language: under 70% is at risk, 85% and up is strong. Teal and
 * orange rather than green and red, which many colorblind readers can't tell apart; the middle band is neutral.
 */
export const HEAT_BANDS = [
  { upTo: 49, label: 'Under 50%', className: 'bg-orange-500 text-slate-900 dark:bg-orange-700 dark:text-white' },
  { upTo: 69, label: '50–69%', className: 'bg-orange-300 text-slate-900 dark:bg-orange-900 dark:text-white' },
  { upTo: 84, label: '70–84%', className: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' },
  { upTo: 94, label: '85–94%', className: 'bg-teal-300 text-slate-900 dark:bg-teal-700 dark:text-white' },
  { upTo: 100, label: '95%+', className: 'bg-teal-700 text-white dark:bg-teal-300 dark:text-slate-900' },
]

/** The band for a success rate, judged on the rounded percentage shown */
export const heatBand = (rate: number) => HEAT_BANDS.find((b) => Math.round(rate * 100) <= b.upTo)!

/** A cell whose number is only a floor (`claimsBeforeRetiring`): no verdict color, because the true chance may be higher */
export const HEAT_FLOOR = 'border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'

/** The combination closest to the plan's ages that reaches strong, the higher chance on a tie; null if none does */
export function nearestStrong(grid: HeatGrid, values: Record<string, number>, plan: Plan): HeatCell | null {
  let best: { cell: HeatCell; distance: number; pct: number } | null = null
  for (const cell of grid.cells) {
    const rate = values[cell.key]
    if (!cell.plan || rate === undefined) continue
    const pct = heatPct(rate, isHeatFloor(cell, rate))
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
 * the planner can say a combination scores higher, not that it's right for someone.
 */
export function heatCheer(cellPct: number, planPct: number, cellIsFloor = false): HeatCheer | null {
  if (cellPct <= planPct) return null
  const from = verdictFor(planPct / 100)
  const to = verdictFor(cellPct / 100)
  if (from !== to) {
    // A floor at strong is strong for certain; a lower floor might really be better than its verdict
    return to === 'strong'
      ? { emoji: '🎉', text: `Great result! This moves your plan from ${VERDICT_WORD[from]} to strong.` }
      : { emoji: '👍', text: `Nice step forward. This moves your plan from ${VERDICT_WORD[from]} to ${cellIsFloor ? 'at least ' : ''}${VERDICT_WORD[to]}.` }
  }
  const points = cellPct - planPct
  if (points < CHEER_MIN_POINTS) return null
  if (to === 'strong') return { emoji: '🌟', text: 'Even stronger. This adds to your cushion.' }
  return { emoji: '📈', text: cellIsFloor ? `A good gain of at least ${points} points.` : `A good gain, though still ${VERDICT_WORD[to]}.` }
}

/** Whether a cell's result is only a floor: at 100% every run already succeeds, so there's nothing left to be understated */
export const isHeatFloor = (cell: Pick<HeatCell, 'claimsBeforeRetiring'>, rate: number) => cell.claimsBeforeRetiring && rate < 1

/** The percentage shown: a floor rounds down, so "at least" stays true */
export const heatPct = (rate: number, isFloor: boolean) => (isFloor ? Math.floor(rate * 100 + 1e-9) : Math.round(rate * 100))

/**
 * A cell against the plan, in points, as far as the numbers can say. A floor above the plan is at least that much better;
 * a firm cell below a floor plan is at least that much worse. Anything else can't be told apart.
 */
export function heatDelta(rate: number, cellIsFloor: boolean, planRate: number, planIsFloor: boolean): { points: number; atLeast: boolean } | null {
  const points = heatPct(rate, cellIsFloor) - heatPct(planRate, planIsFloor)
  if (cellIsFloor && planIsFloor) return null
  if (cellIsFloor) return points > 0 ? { points, atLeast: true } : null
  if (planIsFloor) return points < 0 ? { points, atLeast: true } : null
  return { points, atLeast: false }
}
