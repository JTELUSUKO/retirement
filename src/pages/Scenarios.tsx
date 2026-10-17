import { useDeferredValue, useMemo, type ReactNode } from 'react'
import { NumberField } from '../components/NumberField'
import {
  AGE_LIMITS,
  applyScenario,
  CONFIG_2026,
  evaluatePlan,
  type PlanEvaluation,
  type Scenario,
  type ScenarioOverrides,
  type StressTest,
} from '../engine'
import { MAX_SCENARIOS, usePlanStore } from '../store/planStore'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { SCENARIO_PRESETS, stressOptions } from '../utils/scenarioPresets'

const cell = 'px-3 py-2 align-middle'
const select =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900'

export function Scenarios() {
  const { plan, addScenario, updateScenario, removeScenario } = usePlanStore()
  const deferredPlan = useDeferredValue(plan)

  const results = useMemo(
    () => [
      evaluatePlan(deferredPlan),
      ...deferredPlan.scenarios.map((s) => evaluatePlan(applyScenario(deferredPlan, s), s.stress)),
    ],
    [deferredPlan],
  )

  if (plan.annualSpending === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        Fill in your plan on the “My plan” tab first, then come back to compare what-ifs.
      </p>
    )
  }

  const full = plan.scenarios.length >= MAX_SCENARIOS
  const scenarioPlans = plan.scenarios.map((s) => applyScenario(plan, s))

  /** Set an override, or clear it when it matches the base plan. */
  const setOverride = <K extends keyof ScenarioOverrides>(s: Scenario, key: K, value: ScenarioOverrides[K], base: unknown) =>
    updateScenario(s.id, { overrides: { ...s.overrides, [key]: value === base ? undefined : value } })

  const changed = (s: Scenario, key: keyof ScenarioOverrides) => s.overrides[key] !== undefined
  const mark = (on: boolean) => (on ? 'border-l-2 border-l-teal-600 pl-2 dark:border-l-teal-400' : '')

  const bestOf = (values: number[]) => Math.max(...values)
  const successValues = results.map((r) => (r.issues.length ? -1 : r.successRate))
  const typicalValues = results.map((r) => (r.issues.length ? -Infinity : r.leftTypical))
  const poorValues = results.map((r) => (r.issues.length ? -Infinity : r.leftPoor))

  const resultRow = (label: string, render: (r: PlanEvaluation, i: number) => ReactNode) => (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>{label}</th>
      {results.map((r, i) => (
        <td key={i} className={`${cell} text-right tabular-nums`}>
          {r.issues.length ? <span className="text-slate-400">—</span> : render(r, i)}
        </td>
      ))}
    </tr>
  )

  const emphasize = (value: string, isBest: boolean) => (isBest ? <strong>{value}</strong> : value)
  const { earliestClaimAge, latestClaimAge } = CONFIG_2026.socialSecurity

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Each scenario is your plan with a few changes (marked with a bar). Anything you don’t change follows your plan,
          including later edits. Up to {MAX_SCENARIOS} scenarios.
        </p>
        <div className="flex flex-wrap gap-2">
          {SCENARIO_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={full}
              onClick={() => addScenario(p.make(plan))}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              + {p.label}
            </button>
          ))}
        </div>
        {full && <p className="text-xs text-slate-500">Remove a scenario to add another.</p>}
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className={`${cell} w-56`} />
              <th scope="col" className={`${cell} text-right font-medium`}>Your plan</th>
              {plan.scenarios.map((s) => (
                <th key={s.id} scope="col" className={`${cell} min-w-44 text-right`}>
                  <div className="flex items-center gap-1">
                    <input
                      className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right font-medium hover:border-slate-300 focus:border-slate-300 dark:hover:border-slate-700"
                      value={s.name}
                      aria-label="Scenario name"
                      onChange={(e) => updateScenario(s.id, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className="px-1 text-slate-400 hover:text-red-600"
                      aria-label={`Remove ${s.name}`}
                      onClick={() => removeScenario(s.id)}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={`${cell} text-left text-xs font-semibold uppercase tracking-wide text-slate-500`}>
                Changes
              </th>
            </tr>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>Retire at</th>
              <td className={`${cell} text-right tabular-nums`}>{plan.retirementAge}</td>
              {plan.scenarios.map((s, i) => (
                <td key={s.id} className={cell}>
                  <div className={mark(changed(s, 'retirementAge'))}>
                    <NumberField
                      hideLabel
                      label={`${s.name}: retire at`}
                      min={AGE_LIMITS.min}
                      max={AGE_LIMITS.max}
                      value={scenarioPlans[i].retirementAge}
                      onChange={(v) => setOverride(s, 'retirementAge', v, plan.retirementAge)}
                    />
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>
                Yearly spending <span className="text-xs">(excl. healthcare)</span>
              </th>
              <td className={`${cell} text-right tabular-nums`}>{formatUSD(plan.annualSpending)}</td>
              {plan.scenarios.map((s, i) => (
                <td key={s.id} className={cell}>
                  <div className={mark(changed(s, 'annualSpending'))}>
                    <NumberField
                      hideLabel
                      label={`${s.name}: yearly spending`}
                      prefix="$"
                      min={0}
                      step={1000}
                      value={scenarioPlans[i].annualSpending}
                      onChange={(v) => setOverride(s, 'annualSpending', v, plan.annualSpending)}
                    />
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>Claim Social Security at</th>
              <td className={`${cell} text-right tabular-nums`}>{plan.socialSecurityClaimAge}</td>
              {plan.scenarios.map((s, i) => (
                <td key={s.id} className={cell}>
                  <div className={mark(changed(s, 'socialSecurityClaimAge'))}>
                    <NumberField
                      hideLabel
                      label={`${s.name}: claim Social Security at`}
                      min={earliestClaimAge}
                      max={latestClaimAge}
                      value={scenarioPlans[i].socialSecurityClaimAge}
                      onChange={(v) => setOverride(s, 'socialSecurityClaimAge', v, plan.socialSecurityClaimAge)}
                    />
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>
                Annuity ({formatUSDCompact(plan.annuityPurchase.amount)})
              </th>
              <td className={`${cell} text-right`}>{plan.annuityPurchase.enabled ? 'Yes' : 'No'}</td>
              {plan.scenarios.map((s, i) => (
                <td key={s.id} className={cell}>
                  <div className={mark(changed(s, 'annuityEnabled'))}>
                    <select
                      className={select}
                      aria-label={`${s.name}: annuity`}
                      value={scenarioPlans[i].annuityPurchase.enabled ? 'yes' : 'no'}
                      onChange={(e) => setOverride(s, 'annuityEnabled', e.target.value === 'yes', plan.annuityPurchase.enabled)}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>Stress test</th>
              <td className={`${cell} text-right text-slate-500`}>None</td>
              {plan.scenarios.map((s) => (
                <td key={s.id} className={cell}>
                  <div className={mark(s.stress !== 'none')}>
                    <select
                      className={select}
                      aria-label={`${s.name}: stress test`}
                      value={s.stress}
                      onChange={(e) => updateScenario(s.id, { stress: e.target.value as StressTest })}
                    >
                      {stressOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </td>
              ))}
            </tr>

            <tr>
              <th scope="row" className={`${cell} pt-5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500`}>
                Results
              </th>
            </tr>
            {resultRow(`Chance money lasts to ${plan.lifeExpectancy}`, (r, i) => {
              const pct = Math.round(r.successRate * 100)
              const icon = pct >= 85 ? '✓' : pct >= 70 ? '⚠' : '✕'
              return emphasize(`${icon} ${pct}%`, successValues[i] === bestOf(successValues) && results.length > 1)
            })}
            {resultRow('Savings at retirement', (r) => formatUSDCompact(r.savingsAtRetirement))}
            {resultRow('With average returns', (r) =>
              r.depletionAge === null ? `Lasts past ${plan.lifeExpectancy}` : `Runs out at ${r.depletionAge}`,
            )}
            {resultRow(`Left at ${plan.lifeExpectancy}, typical markets`, (r, i) =>
              emphasize(formatUSDCompact(r.leftTypical), typicalValues[i] === bestOf(typicalValues) && results.length > 1),
            )}
            {resultRow(`Left at ${plan.lifeExpectancy}, poor markets (10th)`, (r, i) =>
              emphasize(formatUSDCompact(r.leftPoor), poorValues[i] === bestOf(poorValues) && poorValues[i] > 0 && results.length > 1),
            )}
            {resultRow('Federal tax over retirement', (r) => formatUSDCompact(r.lifetimeTax))}
            {results.some((r) => r.issues.length > 0) && (
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className={`${cell} text-left font-normal text-slate-600 dark:text-slate-400`}>Problems</th>
                {results.map((r, i) => (
                  <td key={i} className={`${cell} text-right text-xs text-red-600 dark:text-red-400`}>
                    {r.issues.join(' ')}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {plan.scenarios.length === 0 && (
        <p className="text-sm text-slate-500">Add a scenario above to see it next to your plan.</p>
      )}
      <p className="text-xs text-slate-500">
        Money amounts are in today’s dollars. Best value in each row is in bold. Stress tests apply to every one of the
        1,000 simulated markets.
      </p>
    </div>
  )
}
