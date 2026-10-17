import { memo, useDeferredValue, useMemo } from 'react'
import { BucketChart } from '../components/BucketChart'
import { PlanForm } from '../components/PlanForm'
import { ProbabilityChart } from '../components/ProbabilityChart'
import { StatCard } from '../components/StatCard'
import { YearTable } from '../components/YearTable'
import { benefitAtClaimAge, projectPlan, runMonteCarlo, validatePlan, type Plan } from '../engine'
import { usePlanStore } from '../store/planStore'
import { formatUSD, formatUSDCompact } from '../utils/format'

const Results = memo(function Results({ plan }: { plan: Plan }) {
  const result = useMemo(() => projectPlan(plan), [plan])
  const mc = useMemo(() => runMonteCarlo(plan), [plan])
  const lasts = result.depletionAge === null
  const success = Math.round(mc.successRate * 100)
  const successTone = success >= 85 ? 'good' : success >= 70 ? 'warn' : 'bad'
  const successNote = { good: '✓ Strong', warn: '⚠ Borderline', bad: '✕ At risk' }[successTone]
  const ssMonthly = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge)
  const rmdAge = result.rmdStartAge
  const retiredYears = result.years.filter((y) => y.age >= plan.retirementAge)
  const lifetimeTaxReal = retiredYears.reduce((sum, y) => sum + y.tax / y.priceLevel, 0)
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
          label={`Chance money lasts to ${plan.lifeExpectancy}`}
          value={`${success}%`}
          detail={`${successNote} · ${mc.runs.toLocaleString()} simulated markets`}
          tone={successTone}
        />
        <StatCard
          label="With average returns"
          value={lasts ? `Lasts past ${plan.lifeExpectancy}` : `Runs out at ${result.depletionAge}`}
          detail="Same return and inflation every year"
        />
        <StatCard
          label={`Social Security at ${plan.socialSecurityClaimAge}`}
          value={`${formatUSD(ssMonthly)}/mo`}
          detail="Today's dollars"
        />
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Federal income tax over retirement (average returns):{' '}
        <strong className="tabular-nums">{formatUSDCompact(lifetimeTaxReal)}</strong> in today's dollars, about{' '}
        {(avgTaxRate * 100).toFixed(1)}% of your income and withdrawals. State tax and capital gains aren't included.
      </p>

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
          With average returns, in today's dollars. Spending and federal income tax come from cash → taxable → pre-tax →
          Roth → HSA. Required minimum distributions (RMDs) start at {rmdAge}; any you don't spend are reinvested in
          taxable.
        </p>
        <BucketChart years={result.years} retirementAge={plan.retirementAge} rmdStartAge={rmdAge} />
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer font-medium">Year-by-year table</summary>
        <YearTable averageYears={result.years} simulatedYears={mc.years} />
      </details>
    </section>
  )
})

export function Dashboard() {
  const plan = usePlanStore((s) => s.plan)
  // Inputs update immediately; the (slower) simulation catches up right after.
  const deferredPlan = useDeferredValue(plan)
  const issues = validatePlan(plan)

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
      <aside>
        <PlanForm />
      </aside>

      {issues.length > 0 ? (
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
      ) : plan.annualSpending === 0 ? (
        <section className="h-fit rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">Add your numbers to see results</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Add each account with its balance and what you contribute each year.</li>
            <li>Enter how much you expect to spend per year in retirement, in today's dollars.</li>
            <li>Add your Social Security estimate from ssa.gov and any pension.</li>
          </ol>
        </section>
      ) : (
        <Results plan={deferredPlan} />
      )}
    </div>
  )
}
