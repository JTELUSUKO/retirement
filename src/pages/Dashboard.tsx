import { useMemo } from 'react'
import { PlanForm } from '../components/PlanForm'
import { ProbabilityChart } from '../components/ProbabilityChart'
import { StatCard } from '../components/StatCard'
import { benefitAtClaimAge, projectPlan, runMonteCarlo } from '../engine'
import { usePlanStore } from '../store/planStore'
import { formatUSD, formatUSDCompact } from '../utils/format'

export function Dashboard() {
  const plan = usePlanStore((s) => s.plan)
  const result = useMemo(() => projectPlan(plan), [plan])
  const mc = useMemo(() => runMonteCarlo(plan), [plan])
  const lasts = result.depletionAge === null
  const success = Math.round(mc.successRate * 100)
  const successTone = success >= 85 ? 'good' : success >= 70 ? 'warn' : 'bad'
  const successNote = { good: '✓ Strong', warn: '⚠ Borderline', bad: '✕ At risk' }[successTone]
  const ssMonthly = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge)

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
      <aside>
        <PlanForm />
      </aside>

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
            detail="Same return every year"
          />
          <StatCard
            label={`Social Security at ${plan.socialSecurityClaimAge}`}
            value={`${formatUSD(ssMonthly)}/mo`}
            detail="Today's dollars"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Range of outcomes by age</h2>
          <p className="text-sm text-slate-500">
            Portfolio balance across {mc.runs.toLocaleString()} simulated markets, in today's dollars
          </p>
          <ProbabilityChart years={mc.years} retirementAge={plan.retirementAge} />
        </div>

        <details className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer font-medium">Year-by-year table (average returns)</summary>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-right text-sm tabular-nums">
              <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="py-1 text-left">Age</th>
                  <th>Contributions</th>
                  <th>Withdrawal</th>
                  <th>Income</th>
                  <th>Balance</th>
                  <th>Balance (today's $)</th>
                </tr>
              </thead>
              <tbody>
                {result.years.map((y) => (
                  <tr key={y.age} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-left">{y.age}</td>
                    <td>{formatUSD(y.contributions)}</td>
                    <td>{formatUSD(y.withdrawal)}</td>
                    <td>{formatUSD(y.income)}</td>
                    <td>{formatUSD(y.balance)}</td>
                    <td>{formatUSD(y.balanceReal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  )
}
