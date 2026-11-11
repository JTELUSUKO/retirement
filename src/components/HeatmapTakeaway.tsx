import type { Plan } from '../engine'
import { heatPct, type HeatCell } from '../utils/heatmap'
import { STRONG_PCT, VERDICT_WORD, verdictFor } from '../utils/levers'

const STRONG = `strong (${STRONG_PCT}%+)`

/** The takeaway above the chart: the plan's own result and the closest combination that reaches strong */
export function HeatmapTakeaway({ plan, updating, planRate, closest, closestRate, onShow }: {
  plan: Plan
  /** A new batch of simulations is still running */
  updating: boolean
  planRate: number | undefined
  closest: HeatCell | null
  closestRate: number | undefined
  onShow: (key: string) => void
}) {
  // Judged like the headline, so the two can't disagree
  const planVerdict = planRate === undefined ? null : verdictFor(planRate)
  return (
    // Stays up while recalculating, so the grid and Undo below it don't jump
    <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
      <p>
        <strong className="font-semibold">
          Your plan (retire {plan.retirementAge}, claim {plan.socialSecurityClaimAge}):{' '}
          {updating || planRate === undefined || planVerdict === null ? 'calculating…' : `${heatPct(planRate)}%, ${VERDICT_WORD[planVerdict]}.`}
        </strong>
      </p>
      {updating ? (
        <p className="mt-0.5">Looking for the closest combination that reaches {STRONG}…</p>
      ) : closest && closestRate !== undefined ? (
        <p className="mt-0.5">
          Closest combination that reaches {STRONG}: retire {closest.retirementAge}, claim {closest.claimAge} ({heatPct(closestRate)}%).{' '}
          <button type="button" onClick={() => onShow(closest.key)} className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300">
            Show me
          </button>
        </p>
      ) : (
        planVerdict !== 'strong' && <p className="mt-0.5">No combination here reaches {STRONG}. Spending less may help more; see “What would help most” above.</p>
      )}
    </div>
  )
}
