import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react'
import { benefitAtClaimAge, MIX_PRESETS, mixReturns, mixShare, TAX_CONFIG, validatePlan, type MonteCarloResult, type Plan } from '../engine'
import type { SimTask } from '../sim/tasks'
import { useSimulation } from '../sim/useSimulation'
import { MAX_SCENARIOS, usePlanStore } from '../store/planStore'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { endLabel } from '../utils/labels'
import { mixLabel } from '../utils/levers'
import { Icon, type IconName } from './Icons'
import { PRIMARY, SECONDARY } from './styles'
import { SuccessGauge } from './SuccessGauge'

/** What the sliders change. `mix` is the stock share after retiring (null = a custom mix, which has no slider). */
interface Levers {
  retirementAge: number
  annualSpending: number
  socialSecurityClaimAge: number
  mix: number | null
}

const leversOf = (plan: Plan): Levers => ({
  retirementAge: plan.retirementAge,
  annualSpending: plan.annualSpending,
  socialSecurityClaimAge: plan.socialSecurityClaimAge,
  mix: mixShare(plan.assumptions.returnPostRetirement, plan.assumptions.volatilityPostRetirement),
})

const sameLevers = (a: Levers, b: Levers) =>
  a.retirementAge === b.retirementAge &&
  a.annualSpending === b.annualSpending &&
  a.socialSecurityClaimAge === b.socialSecurityClaimAge &&
  a.mix === b.mix

/** Just the levers moved away from `from`, as a plan change (so it can't undo other edits to the plan) */
function leverPatch(plan: Plan, from: Levers, l: Levers): Partial<Plan> {
  const mix = l.mix !== null && l.mix !== from.mix ? mixReturns(l.mix) : null
  return {
    ...(l.retirementAge !== from.retirementAge && { retirementAge: l.retirementAge }),
    ...(l.annualSpending !== from.annualSpending && { annualSpending: l.annualSpending }),
    ...(l.socialSecurityClaimAge !== from.socialSecurityClaimAge && { socialSecurityClaimAge: l.socialSecurityClaimAge }),
    ...(mix && { assumptions: { ...plan.assumptions, returnPostRetirement: mix.mean, volatilityPostRetirement: mix.volatility } }),
  }
}

function Slider({ icon, label, value, display, was, min, max, step, onChange, minLabel, maxLabel }: {
  icon: IconName
  label: string
  value: number
  /** The value as shown (also read out by screen readers) */
  display: string
  /** The plan's value, shown while the slider is moved away from it */
  was: string | null
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  minLabel: ReactNode
  maxLabel: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <span className="flex items-center justify-between gap-2 text-sm">
        <span id={id} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <Icon name={icon} size={15} />
          </span>
          {label}
        </span>
        <span className="text-right tabular-nums">
          <strong className="font-semibold text-slate-900 dark:text-slate-100">{display}</strong>
          {was && <span className="ml-1.5 text-xs text-muted">(was {was})</span>}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={id}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-teal-600 dark:accent-teal-400"
      />
      <span className="flex justify-between text-xs text-muted">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </span>
    </div>
  )
}

/**
 * Sliders for the biggest levers, with a dial that follows them. A sandbox: nothing changes in the plan until Apply.
 * `mc` is the simulation of `resultPlan`, which can lag a moment behind the saved plan the sliders start from.
 */
export function WhatIfPanel({ resultPlan, mc }: { resultPlan: Plan; mc: MonteCarloResult }) {
  const plan = usePlanStore((s) => s.plan)
  const update = usePlanStore((s) => s.update)
  const addScenario = usePlanStore((s) => s.addScenario)
  const full = plan.scenarios.length >= MAX_SCENARIOS
  const base = useMemo(() => leversOf(plan), [plan])
  // Slider values belong to the plan they were moved from; a form edit to any of these starts them over
  const [draft, setDraft] = useState<{ from: Levers; levers: Levers } | null>(null)
  const levers = draft && sameLevers(draft.from, base) ? draft.levers : base
  const set = (patch: Partial<Levers>) => setDraft({ from: base, levers: { ...levers, ...patch } })
  const changed = !sameLevers(levers, base)

  // Dragging stays smooth: the simulation follows at lower priority, and the pool drops runs it falls behind on
  const deferred = useDeferredValue(levers)
  const preview = useMemo(() => ({ ...plan, ...leverPatch(plan, base, deferred) }), [plan, base, deferred])
  const issues = useMemo(() => validatePlan(preview), [preview])
  const invalid = changed && issues.length > 0
  const task = useMemo<Extract<SimTask, { kind: 'monteCarlo' }> | null>(
    () => (!sameLevers(deferred, base) && issues.length === 0 ? { kind: 'monteCarlo', plan: preview } : null),
    [deferred, base, preview, issues],
  )
  const sim = useSimulation(task)
  // While the main results catch up with a form edit, the dial shows them (as updating) rather than an old preview
  const baselineReady = resultPlan === plan
  const previewRate = changed && !invalid && sim.data ? sim.data.successRate : mc.successRate
  const pending = !baselineReady || (changed && !invalid && (sim.pending || levers !== deferred || !sim.data))
  const delta = Math.round(previewRate * 100) - Math.round(mc.successRate * 100)

  const { earliestClaimAge, latestClaimAge } = TAX_CONFIG.socialSecurity
  // Spending moves in whole steps from the plan's own amount, so the plan's value is always on the slider
  const spendStep = plan.annualSpending >= 20000 ? 1000 : 100
  const spendSteps = Math.max(1, Math.floor((plan.annualSpending * 0.5) / spendStep))
  // Never down to $0 or below
  const spendMin = plan.annualSpending - Math.min(spendSteps, Math.ceil(plan.annualSpending / spendStep) - 1) * spendStep
  const spendMax = plan.annualSpending + spendSteps * spendStep
  // Wide enough to hold the plan's value even when it's out of range (validation already flags that)
  const retireMin = Math.min(plan.currentAge, plan.retirementAge)
  const retireMax = Math.max(plan.currentAge, plan.lifeExpectancy - 1, plan.retirementAge)

  const apply = () => {
    const latest = usePlanStore.getState().plan
    update(leverPatch(latest, base, levers))
    setDraft(null)
  }
  const compare = () => {
    const parts = [
      levers.retirementAge !== base.retirementAge && `retire ${levers.retirementAge}`,
      levers.annualSpending !== base.annualSpending && `${formatUSDCompact(levers.annualSpending)}/yr`,
      levers.socialSecurityClaimAge !== base.socialSecurityClaimAge && `SS at ${levers.socialSecurityClaimAge}`,
    ].filter(Boolean)
    addScenario({
      name: `What-if: ${parts.join(', ')}`,
      overrides: {
        ...(levers.retirementAge !== base.retirementAge && { retirementAge: levers.retirementAge }),
        ...(levers.annualSpending !== base.annualSpending && { annualSpending: levers.annualSpending }),
        ...(levers.socialSecurityClaimAge !== base.socialSecurityClaimAge && { socialSecurityClaimAge: levers.socialSecurityClaimAge }),
      },
      stress: 'none',
    })
    window.location.hash = '#compare'
  }
  // The Compare page can't change the investment mix
  const mixChanged = levers.mix !== base.mix

  return (
    <section
      aria-labelledby="what-if-heading"
      className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-teal-50/70 p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="what-if-heading" className="flex items-center gap-2 font-medium">
            <Icon name="sliders" size={18} className="text-teal-700 dark:text-teal-300" />
            Play with your plan
          </h2>
          <p className="mt-0.5 text-sm text-muted">Drag the sliders to see how your chances change. Nothing is saved until you apply it.</p>
        </div>
        {changed && (
          <button type="button" onClick={() => setDraft(null)} className={`${SECONDARY} inline-flex items-center gap-1.5 px-2.5 py-1 text-xs`}>
            <Icon name="undo" size={13} />
            Reset sliders
          </button>
        )}
      </div>

      <div className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="text-center">
          <SuccessGauge
            rate={previewRate}
            baseline={changed ? mc.successRate : undefined}
            label={`Chance money lasts to ${endLabel(plan)}`}
            pending={pending}
          />
          <p className="mt-1 text-xs text-muted">Chance your money lasts to {endLabel(plan)}</p>
          <p aria-live="polite" className="mt-2 h-5 text-sm font-medium tabular-nums">
            {changed && !pending && !invalid && (
              <span className={delta > 0 ? 'text-teal-700 dark:text-teal-300' : delta < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted'}>
                {delta > 0 ? `▲ ${delta} points` : delta < 0 ? `▼ ${-delta} points` : 'No change'} vs your plan
              </span>
            )}
          </p>
        </div>

        <div className="space-y-5">
          <Slider
            icon="calendar"
            label="Retire at"
            value={levers.retirementAge}
            display={`age ${levers.retirementAge}`}
            was={levers.retirementAge !== base.retirementAge ? String(base.retirementAge) : null}
            min={retireMin}
            max={retireMax}
            step={1}
            onChange={(retirementAge) => set({ retirementAge })}
            minLabel={retireMin}
            maxLabel={retireMax}
          />
          <Slider
            icon="banknote"
            label="Yearly spending"
            value={levers.annualSpending}
            display={`${formatUSD(levers.annualSpending)} (${formatUSD(Math.round(levers.annualSpending / 12))}/mo)`}
            was={levers.annualSpending !== base.annualSpending ? formatUSDCompact(base.annualSpending) : null}
            min={spendMin}
            max={spendMax}
            step={spendStep}
            onChange={(annualSpending) => set({ annualSpending })}
            minLabel={formatUSDCompact(spendMin)}
            maxLabel={formatUSDCompact(spendMax)}
          />
          {plan.socialSecurityAtFRA > 0 && (
            <Slider
              icon="landmark"
              label="Claim Social Security at"
              value={levers.socialSecurityClaimAge}
              display={`${levers.socialSecurityClaimAge} · ${formatUSD(Math.round(benefitAtClaimAge(plan.socialSecurityAtFRA, levers.socialSecurityClaimAge)))}/mo`}
              was={levers.socialSecurityClaimAge !== base.socialSecurityClaimAge ? String(base.socialSecurityClaimAge) : null}
              min={earliestClaimAge}
              max={latestClaimAge}
              step={1}
              onChange={(socialSecurityClaimAge) => set({ socialSecurityClaimAge })}
              minLabel={earliestClaimAge}
              maxLabel={latestClaimAge}
            />
          )}
          {levers.mix !== null && (
            <Slider
              icon="pie"
              label="Investment mix after retiring"
              value={levers.mix}
              display={mixLabel(levers.mix)}
              was={base.mix !== null && levers.mix !== base.mix ? `${Math.round(base.mix * 100)}% stocks` : null}
              min={Math.min(...MIX_PRESETS)}
              max={Math.max(...MIX_PRESETS)}
              step={0.2}
              onChange={(mix) => set({ mix: Math.round(mix * 10) / 10 })}
              minLabel="Cautious"
              maxLabel="All stocks"
            />
          )}
        </div>
      </div>

      {changed && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          {issues.length > 0 ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              ✕ {issues[0].message}
            </p>
          ) : (
            <>
              <button type="button" onClick={apply} className={`${PRIMARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}>
                <Icon name="check" size={15} />
                Apply to my plan
              </button>
              <button
                type="button"
                onClick={compare}
                disabled={full || mixChanged}
                title={
                  mixChanged
                    ? 'Compare can’t change the investment mix; apply it instead'
                    : full
                      ? `Compare holds up to ${MAX_SCENARIOS} scenarios; remove one first`
                      : undefined
                }
                className={`${SECONDARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}
              >
                <Icon name="columns" size={15} />
                Compare side by side
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
