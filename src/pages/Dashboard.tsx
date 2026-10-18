import { memo, useMemo } from 'react'
import { AnnuityComparison } from '../components/AnnuityComparison'
import { RothConversionComparison } from '../components/RothConversionComparison'
import { SafeSpendingPanel } from '../components/SafeSpendingPanel'
import { SurvivorComparison } from '../components/SurvivorComparison'
import { BucketChart } from '../components/BucketChart'
import { GettingStarted } from '../components/GettingStarted'
import { PlanForm } from '../components/PlanForm'
import { ProbabilityChart } from '../components/ProbabilityChart'
import { StatCard } from '../components/StatCard'
import { YearTable } from '../components/YearTable'
import { projectPlan, householdSocialSecurityMonthly, type MonteCarloResult, planEndAge, spouseOffset, survivorFromAge, validatePlan, missingEssentials, type Plan } from '../engine'
import { usePlanStore } from '../store/planStore'
import type { SimTask } from '../sim/tasks'
import { useSimulations } from '../sim/useSimulation'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { endLabel } from '../utils/labels'

const Results = memo(function Results({ plan }: { plan: Plan }) {
  const result = useMemo(() => projectPlan(plan), [plan])
  // Simulations run in background workers: the plan, plus "without" versions for the comparison panels
  const tasks = useMemo(() => {
    const mc = (p: Plan): SimTask => ({ kind: 'monteCarlo', plan: p })
    return [
      mc(plan),
      plan.annuityPurchase.enabled ? mc({ ...plan, annuityPurchase: { ...plan.annuityPurchase, enabled: false } }) : null,
      plan.rothConversion.enabled ? mc({ ...plan, rothConversion: { ...plan.rothConversion, enabled: false } }) : null,
      survivorFromAge(plan) !== Infinity ? mc({ ...plan, survivor: { ...plan.survivor, enabled: false } }) : null,
    ]
  }, [plan])
  const sims = useSimulations(tasks)
  const [mcResult, withoutAnnuityResult, noConversionsResult, bothLiveResult] = (sims.data ?? []) as (MonteCarloResult | null)[]
  const noConversionsProjection = useMemo(
    () => (plan.rothConversion.enabled ? projectPlan({ ...plan, rothConversion: { ...plan.rothConversion, enabled: false } }) : null),
    [plan],
  )
  if (!mcResult) {
    return (
      <section className="h-fit rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        {sims.error ? `✕ The simulation failed: ${sims.error}` : 'Running 1,000 simulated markets…'}
      </section>
    )
  }
  const mc = mcResult
  // Comparison results only when the plan still has that feature on (results may lag a moment behind edits)
  const withoutAnnuity = plan.annuityPurchase.enabled ? withoutAnnuityResult : null
  const noConversions =
    plan.rothConversion.enabled && noConversionsResult && noConversionsProjection
      ? { mc: noConversionsResult, projection: noConversionsProjection }
      : null
  const bothLive = survivorFromAge(plan) !== Infinity ? bothLiveResult : null
  // Household benefit while both are alive
  const ssMonthly = householdSocialSecurityMonthly(plan)
  const lasts = result.depletionAge === null
  const success = Math.round(mc.successRate * 100)
  const successTone = success >= 85 ? 'good' : success >= 70 ? 'warn' : 'bad'
  const successNote = { good: '✓ Strong', warn: '⚠ Borderline', bad: '✕ At risk' }[successTone]
  const rmdAge = result.rmdStartAge
  const retiredYears = result.years.filter((y) => y.age >= plan.retirementAge)
  const lifetimeTaxReal = retiredYears.reduce((sum, y) => sum + y.tax / y.priceLevel, 0)
  const lifetimeStateTaxReal = retiredYears.reduce((sum, y) => sum + y.stateTax / y.priceLevel, 0)
  const lifetimeIrmaaReal = retiredYears.reduce((sum, y) => sum + y.irmaa / y.priceLevel, 0)
  const lifetimeLtcReal = retiredYears.reduce((sum, y) => sum + y.longTermCare / y.priceLevel, 0)
  const lifetimeHealthReal = retiredYears.reduce((sum, y) => sum + y.healthcare / y.priceLevel, 0)
  const avgTaxRate =
    retiredYears.reduce((sum, y) => sum + y.tax, 0) /
    Math.max(retiredYears.reduce((sum, y) => sum + y.withdrawal + y.income, 0), 1)

  return (
    <section className="min-w-0 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Savings at ${plan.retirementAge}`}
          value={formatUSDCompact(result.balanceAtRetirementReal)}
          detail={`${formatUSDCompact(result.balanceAtRetirement)} in future dollars`}
        />
        <StatCard
          label={`Chance money lasts to ${endLabel(plan)}`}
          value={`${success}%`}
          detail={sims.pending ? 'Updating…' : `${successNote} · ${mc.runs.toLocaleString()} simulated markets`}
          tone={successTone}
        />
        <StatCard
          label="With typical returns"
          value={lasts ? `Lasts past ${planEndAge(plan)}` : `Runs out at ${result.depletionAge}`}
          detail={`${spouseOffset(plan) !== 0 ? `Your age (spouse ${(lasts ? planEndAge(plan) : result.depletionAge!) + spouseOffset(plan)}) · ` : ''}Median return every year`}
        />
        <StatCard
          label={plan.filingStatus === 'married' ? 'Social Security, both claimed' : `Social Security at ${plan.socialSecurityClaimAge}`}
          value={`${formatUSD(ssMonthly)}/mo`}
          detail={plan.filingStatus === 'married' ? "Both of you, today's dollars" : "Today's dollars"}
        />
      </div>

      {mc.guardrails && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Guardrails: spending gets cut at some point in{' '}
          <strong className="tabular-nums">{Math.round(mc.guardrails.cutChance * 100)}%</strong> of simulated markets. In
          poor markets (10th percentile) it bottoms out at{' '}
          <strong className="tabular-nums">{Math.round(mc.guardrails.lowestP10 * 100)}%</strong> of your plan (
          {formatUSD(plan.annualSpending * mc.guardrails.lowestP10)}/yr in today’s dollars).
        </p>
      )}

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Income tax over retirement (typical returns):{' '}
        <strong className="tabular-nums">{formatUSDCompact(lifetimeTaxReal)}</strong> in today's dollars (
        {formatUSDCompact(lifetimeTaxReal - lifetimeStateTaxReal)} federal,{' '}
        {plan.state ? `${formatUSDCompact(lifetimeStateTaxReal)} state` : 'no state chosen'}), about{' '}
        {(avgTaxRate * 100).toFixed(1)}% of your income and withdrawals, including capital gains on brokerage sales and any early-withdrawal penalty. Local taxes aren't included.
        <br />
        Healthcare over retirement: <strong className="tabular-nums">{formatUSDCompact(lifetimeHealthReal)}</strong> in
        today's dollars, including medical costs rising faster than inflation
        {lifetimeIrmaaReal > 0 ? `, ${formatUSDCompact(lifetimeIrmaaReal)} of Medicare income surcharges (IRMAA)` : ''}
        {lifetimeLtcReal > 0 ? `, and ${formatUSDCompact(lifetimeLtcReal)} of long-term care` : ''}.
      </p>

      <SafeSpendingPanel plan={plan} />

      {withoutAnnuity && <AnnuityComparison plan={plan} withAnnuity={mc} withoutAnnuity={withoutAnnuity} />}
      {bothLive && <SurvivorComparison plan={plan} withDeath={mc} bothLive={bothLive} />}
      {noConversions && (
        <RothConversionComparison
          plan={plan}
          withConversions={mc}
          without={noConversions.mc}
          withProjection={result}
          withoutProjection={noConversions.projection}
        />
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Range of outcomes by age</h2>
        <p className="text-sm text-slate-500">
          Balance at the start of each age across {mc.runs.toLocaleString()} simulated markets and inflation paths, in
          today's dollars
        </p>
        <ProbabilityChart years={mc.years} retirementAge={plan.retirementAge} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Savings by account type</h2>
        <p className="text-sm text-slate-500">
          With typical returns, in today's dollars. Healthcare is paid from your HSA first; other spending and income tax come from cash → taxable → pre-tax → Roth → HSA. Required minimum distributions (RMDs) start at{' '}
          {rmdAge}; any you don't spend are reinvested in taxable.
        </p>
        <BucketChart years={result.years} retirementAge={plan.retirementAge} rmdStartAge={rmdAge} />
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer font-medium">Year-by-year table</summary>
        <YearTable averageYears={result.years} simulatedYears={mc.years} plan={plan} />
      </details>
    </section>
  )
})

export function Dashboard() {
  const plan = usePlanStore((s) => s.plan)
  const issues = validatePlan(plan)

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
      <aside>
        <PlanForm />
      </aside>

      {missingEssentials(plan).length > 0 ? (
        <GettingStarted plan={plan} />
      ) : issues.length > 0 ? (
        <section
          role="alert"
          className="h-fit rounded-lg border border-l-4 border-slate-200 border-l-red-600 bg-white p-4 dark:border-slate-800 dark:border-l-red-500 dark:bg-slate-900"
        >
          <h2 className="font-medium">✕ Fix these inputs to see your results</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
            {issues.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        </section>
      ) : (
        <Results plan={plan} />
      )}
    </div>
  )
}
