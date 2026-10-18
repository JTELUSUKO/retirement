import { useMemo } from 'react'
import type { MonteCarloResult, Plan } from '../engine'
import type { SimTask } from '../sim/tasks'
import { useSimulations } from '../sim/useSimulation'
import { usePlanStore } from '../store/planStore'
import { endLabel } from '../utils/labels'
import { leverVariants, spendMoreVariant, verdictFor, withArticle, type Lever } from '../utils/levers'
import { SCENARIO_PRESETS } from '../utils/scenarioPresets'
import { InfoTip } from './InfoTip'

/** Smallest gain (in percentage points) worth listing */
const MIN_GAIN = 2

const pct = (rate: number) => Math.round(rate * 100)

/** Plain-language verdict plus the changes that would help most, each tested with its own simulation. */
export function VerdictPanel({ plan, mc }: { plan: Plan; mc: MonteCarloResult }) {
  const scenarios = usePlanStore((s) => s.plan.scenarios)
  const addScenario = usePlanStore((s) => s.addScenario)
  const update = usePlanStore((s) => s.update)
  const success = pct(mc.successRate)
  const verdict = verdictFor(mc.successRate)

  const levers = useMemo<Lever[]>(
    () => (verdict === 'strong' ? [...leverVariants(plan), spendMoreVariant(plan)] : leverVariants(plan)),
    [plan, verdict],
  )
  const tasks = useMemo(() => levers.map((l): SimTask => ({ kind: 'monteCarlo', plan: l.plan })), [levers])
  const sims = useSimulations(tasks)
  const results = (sims.data && sims.data.length === levers.length ? sims.data : null) as (MonteCarloResult | null)[] | null

  const rows = results
    ? levers.map((lever, i) => ({ lever, rate: pct(results[i]!.successRate) })).filter((r) => r.lever.key !== 'spend-more')
    : []
  const helpful = rows.filter((r) => r.rate - success >= MIN_GAIN).sort((a, b) => b.rate - a.rate)
  const spendMore = results && verdict === 'strong' ? pct(results[levers.length - 1]!.successRate) : null

  const headline = {
    strong: `Your plan looks strong: ${withArticle(success)} chance your money lasts to ${endLabel(plan)}.`,
    borderline: `Your plan looks borderline: ${withArticle(success)} chance your money lasts to ${endLabel(plan)}.`,
    'at-risk': `Your plan is at risk: only a ${success}% chance your money lasts to ${endLabel(plan)}.`,
  }[verdict]
  const tone = { strong: 'border-l-teal-600', borderline: 'border-l-amber-500', 'at-risk': 'border-l-red-600' }[verdict]
  const full = scenarios.length >= 3

  return (
    <section aria-labelledby="verdict-heading" className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${tone}`}>
      <h2 id="verdict-heading" className="font-medium">
        {headline}
      </h2>
      {verdict !== 'strong' && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Many planners aim for 85% or more.</p>
      )}

      <h3 className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
        {verdict === 'strong' ? 'What would make it even safer' : 'What would help most'}
        <InfoTip label="What would help most">
          Each change is tested on its own against the same 1,000 simulated markets, with everything else in your plan
          the same. Changes that add less than {MIN_GAIN} points aren’t listed. Combining several usually helps more.
        </InfoTip>
      </h3>
      {!results ? (
        <p className="mt-1 text-sm text-slate-500">{sims.error ? `✕ ${sims.error}` : 'Testing a few changes…'}</p>
      ) : helpful.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          None of the usual changes (retiring later, spending less, claiming Social Security later, guardrails) adds more
          than {MIN_GAIN} points on its own.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {helpful.map(({ lever, rate }) => {
            const preset = SCENARIO_PRESETS.find((p) => p.key === lever.preset)
            return (
              <li key={lever.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <span>
                  {lever.label}:{' '}
                  <span className="tabular-nums text-slate-600 dark:text-slate-400">
                    {success}% → <strong className="text-slate-900 dark:text-slate-100">{rate}%</strong> (+{rate - success} points)
                  </span>
                </span>
                {preset ? (
                  <button
                    type="button"
                    disabled={full}
                    title={full ? 'Compare holds up to 3 scenarios; remove one first' : undefined}
                    onClick={() => {
                      addScenario(preset.make(plan))
                      window.location.hash = '#compare'
                    }}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Compare
                  </button>
                ) : (
                  <button
                    type="button"
                    title="Switch the spending rule to guardrails (change it back under Advanced → Spending rule)"
                    onClick={() => update({ spendingRule: { ...plan.spendingRule, type: 'guardrails' } })}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Turn on
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {spendMore !== null && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Room to spend more? {spendMoreVariant(plan).label.replace('Spend', 'Spending')} would give {withArticle(spendMore).split(' ')[0]}{' '}
          <strong className="tabular-nums text-slate-900 dark:text-slate-100">{spendMore}%</strong> chance.
        </p>
      )}
      {sims.pending && results && <p className="mt-2 text-xs text-slate-500">Updating…</p>}
    </section>
  )
}
