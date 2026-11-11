import { TAX_CONFIG, type Plan } from '../engine'
import { MAX_SCENARIOS } from '../store/planStore'
import { claimsWhileWorking, earningsLimitApplies, heatPct, type HeatCell, type HeatCheer } from '../utils/heatmap'
import { endLabel } from '../utils/labels'
import { stopsEarningEarly } from '../utils/socialSecurityNotes'
import { Icon } from './Icons'
import { PRIMARY, SECONDARY } from './styles'

const { fullRetirementAge } = TAX_CONFIG.socialSecurity

export const TRADE_OFFS = 'Every option has trade-offs, like more working years or a smaller benefit, and only you can weigh them. This is an estimate, not advice.'

/** The emoji is decoration; the words carry the message */
export function CheerText({ cheer }: { cheer: HeatCheer }) {
  return (
    <>
      <span aria-hidden="true">{cheer.emoji}</span> {cheer.text}
    </>
  )
}

/** The selected square against the plan, with the buttons that act on it */
export function HeatmapSelection({ plan, selected, rate, delta, cheer, compareFull, onApply, onCompare }: {
  plan: Plan
  selected: HeatCell
  /** Undefined while its number may still be the old plan's */
  rate: number | undefined
  /** Against the plan's own square; null until both numbers are in */
  delta: { points: number; same: boolean } | null
  cheer: HeatCheer | null
  /** Compare has no room for another scenario */
  compareFull: boolean
  onApply: (cell: HeatCell) => void
  onCompare: (cell: HeatCell) => void
}) {
  const isPlan = selected.retirementAge === plan.retirementAge && selected.claimAge === plan.socialSecurityClaimAge
  const early = stopsEarningEarly(plan, selected.retirementAge)
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
      <p>
        <strong className="font-semibold">
          Retire at {selected.retirementAge}, claim Social Security at {selected.claimAge}:
        </strong>{' '}
        {rate === undefined ? 'calculating…' : <span className="tabular-nums">{heatPct(rate)}% chance your money lasts to {endLabel(plan)}</span>}
        {!isPlan && delta !== null && (
          <span className={`ml-1 font-medium tabular-nums ${delta.same ? 'text-muted' : delta.points > 0 ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-400'}`}>
            {delta.same ? 'About the same as your plan' : `${delta.points > 0 ? '▲' : '▼'} ${Math.abs(delta.points)} points vs your plan`}
          </span>
        )}
        {isPlan && <span className="ml-1 text-muted">This is your plan.</span>}
      </p>
      {cheer && (
        <div className="mt-1.5">
          <p className="font-medium text-teal-700 dark:text-teal-300">
            <CheerText cheer={cheer} />
          </p>
          <p className="text-xs text-muted">{TRADE_OFFS}</p>
        </div>
      )}
      {claimsWhileWorking(plan, selected.retirementAge, selected.claimAge) && (
        <p className="mt-1 text-xs text-muted">
          Benefits would start while you’re still working, so{' '}
          {earningsLimitApplies(plan, selected.retirementAge, selected.claimAge) ? 'the earnings limit can hold some back' : 'they’re taxed on top of pay'}. See the note
          below.
        </p>
      )}
      {early && (
        <p className="mt-1 text-xs text-muted">
          {early === 'spouse' ? `Your spouse would stop work before ${fullRetirementAge}, which` : `Retiring before ${fullRetirementAge}`} can lower{' '}
          {early === 'spouse' ? 'their' : 'your'} Social Security, so this could be optimistic. See the note below.
        </p>
      )}
      {!isPlan && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => onApply(selected)} className={`${PRIMARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}>
            <Icon name="check" size={15} />
            Apply to my plan
          </button>
          <button
            type="button"
            onClick={() => onCompare(selected)}
            disabled={compareFull}
            title={compareFull ? `Compare holds up to ${MAX_SCENARIOS} scenarios; remove one first` : undefined}
            className={`${SECONDARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}
          >
            <Icon name="columns" size={15} />
            Compare side by side
          </button>
        </div>
      )}
    </div>
  )
}
