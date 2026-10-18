import { useId, useState } from 'react'
import type { Plan } from '../engine'
import { runSimulation } from '../sim/pool'
import { usePlanStore } from '../store/planStore'
import { formatUSD } from '../utils/format'

const TARGETS = [0.8, 0.85, 0.9, 0.95]

/** "How much can I safely spend?" — searches for the spending that meets a target chance of success. */
export function SafeSpendingPanel({ plan }: { plan: Plan }) {
  const update = usePlanStore((s) => s.update)
  const [target, setTarget] = useState(0.9)
  const [state, setState] = useState<{ status: 'idle' | 'running' } | { status: 'done'; spending: number; target: number; forPlan: Plan }>({ status: 'idle' })
  const stale = state.status === 'done' && state.forPlan !== plan

  const group = useId()

  // Runs in a background worker (about 14 simulations), so the page stays responsive
  const run = async () => {
    setState({ status: 'running' })
    const spending = await runSimulation({ kind: 'safeSpending', plan, target }, group)
    setState({ status: 'done', spending, target, forPlan: plan })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-medium">How much can I safely spend?</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-400">For a</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          value={target}
          aria-label="Target chance of success"
          onChange={(e) => setTarget(Number(e.target.value))}
        >
          {TARGETS.map((t) => (
            <option key={t} value={t}>{Math.round(t * 100)}%</option>
          ))}
        </select>
        <span className="text-slate-600 dark:text-slate-400">chance the money lasts</span>
        <button
          type="button"
          disabled={state.status === 'running'}
          onClick={() => void run()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {state.status === 'running' ? 'Calculating…' : 'Calculate'}
        </button>
      </div>
      {state.status === 'done' && (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            You could spend up to <strong className="tabular-nums">{formatUSD(state.spending)}/yr</strong> (today’s dollars,
            excluding healthcare) for a {Math.round(state.target * 100)}% chance. Your plan spends{' '}
            {formatUSD(state.forPlan.annualSpending)}/yr
            {state.spending >= state.forPlan.annualSpending
              ? `, ${formatUSD(state.spending - state.forPlan.annualSpending)} less than that.`
              : `, ${formatUSD(state.forPlan.annualSpending - state.spending)} more than that.`}
          </p>
          {stale ? (
            <p className="text-xs text-slate-500">Your plan changed since this was calculated. Calculate again.</p>
          ) : (
            state.spending !== state.forPlan.annualSpending && (
              <button
                type="button"
                onClick={() => update({ annualSpending: state.spending })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Use {formatUSD(state.spending)}/yr in my plan
              </button>
            )
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Searches the same 1,000 simulated markets, keeping everything else in your plan the same
        {plan.spendingRule.type === 'guardrails' ? ' (including your guardrails)' : ''}.
      </p>
    </div>
  )
}
