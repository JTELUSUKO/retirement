import { useMemo, useState, type ReactNode } from 'react'
import { GettingStarted } from '../components/GettingStarted'
import { ProbabilityChart } from '../components/ProbabilityChart'
import {
  applyScenario,
  benefitAtClaimAge,
  evaluatePlan,
  missingEssentials,
  payoutRate,
  STRESS_LABEL,
  type Plan,
  type YearResult,
} from '../engine'
import { usePlanStore } from '../store/planStore'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { ACCOUNT_TYPE_LABEL, describeScenario, INCOME_KIND_LABEL } from '../utils/labels'

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`
const th = 'border-b border-slate-300 py-1 pr-3 text-left font-medium'
const td = 'border-b border-slate-100 py-1 pr-3'
const num = 'text-right tabular-nums'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="border-b-2 border-slate-900 pb-1 text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-600">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Every 5th year, plus retirement and the final year. */
function milestoneYears(plan: Plan, years: YearResult[]): YearResult[] {
  return years.filter(
    (y, i) => i % 5 === 0 || y.age === plan.retirementAge || i === years.length - 1,
  )
}

export function Summary() {
  const plan = usePlanStore((s) => s.plan)
  const base = useMemo(() => evaluatePlan(plan), [plan])
  const scenarios = useMemo(
    () => plan.scenarios.map((s) => ({ scenario: s, result: evaluatePlan(applyScenario(plan, s), s.stress) })),
    [plan],
  )
  // Captured once when the page opens
  const [today] = useState(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))

  const toolbar = (
    <div className="mb-4 flex gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
      >
        Print / Save as PDF
      </button>
      <a href="#plan" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
        Back to plan
      </a>
    </div>
  )

  if (missingEssentials(plan).length > 0) {
    return (
      <div>
        {toolbar}
        <GettingStarted plan={plan} onPlanTab={false} />
      </div>
    )
  }
  if (base.issues.length > 0) {
    return (
      <div>
        {toolbar}
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Complete your plan on the “My plan” tab first{base.issues.length > 0 ? `: ${base.issues.join(' ')}` : '.'}
        </p>
      </div>
    )
  }

  const det = base.projection!
  const mc = base.monteCarlo!
  const success = Math.round(base.successRate * 100)
  const verdict = success >= 85 ? '✓ Strong' : success >= 70 ? '⚠ Borderline' : '✕ At risk'
  const ssMonthly = benefitAtClaimAge(plan.socialSecurityAtFRA, plan.socialSecurityClaimAge)
  const a = plan.annuityPurchase
  const people = plan.filingStatus === 'married' ? 2 : 1

  return (
    <div>
      {toolbar}
      <article className="paper mx-auto max-w-[800px] space-y-6 rounded-lg bg-white p-8 text-slate-900 shadow-sm ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-end justify-between border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-xl font-semibold">Retirement plan summary</h1>
            <p className="text-sm text-slate-600">Prepared {today}</p>
          </div>
          <p className="max-w-64 text-right text-xs text-slate-500">
            An educational planning aid, not financial, tax or investment advice.
          </p>
        </header>

        <Section title="Key results">
          <div className="grid grid-cols-4 gap-3 text-sm">
            {[
              [`Chance money lasts to ${plan.lifeExpectancy}`, `${success}%`, `${verdict} · ${mc.runs.toLocaleString()} simulations`],
              [`Savings at ${plan.retirementAge}`, formatUSDCompact(base.savingsAtRetirement), "Today's dollars"],
              ['With average returns', base.depletionAge === null ? `Lasts past ${plan.lifeExpectancy}` : `Runs out at ${base.depletionAge}`, 'Same return every year'],
              [`Social Security at ${plan.socialSecurityClaimAge}`, `${formatUSD(ssMonthly)}/mo`, "Today's dollars"],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-600">{label}</div>
                <div className="mt-1 text-lg font-semibold">{value}</div>
                <div className="text-xs text-slate-500">{note}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-700">
            Over retirement (average returns, today's dollars): federal income tax {formatUSDCompact(base.lifetimeTax)},
            healthcare {formatUSDCompact(base.lifetimeHealthcare)}. Savings left at {plan.lifeExpectancy}:{' '}
            {formatUSDCompact(base.leftTypical)} in typical markets, {formatUSDCompact(base.leftPoor)} in poor markets.
          </p>
        </Section>

        <Section title="Range of outcomes">
          <p className="text-xs text-slate-600">Savings at the start of each age across {mc.runs.toLocaleString()} simulated markets, in today's dollars.</p>
          <ProbabilityChart years={mc.years} retirementAge={plan.retirementAge} />
        </Section>

        {scenarios.length > 0 && (
          <Section title="Scenarios">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Scenario</th>
                  <th className={th}>Changes</th>
                  <th className={`${th} ${num}`}>Chance lasts</th>
                  <th className={`${th} ${num}`}>Left, typical</th>
                  <th className={`${th} ${num}`}>Left, poor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${td} font-medium`}>Your plan</td>
                  <td className={`${td} text-slate-600`}>—</td>
                  <td className={`${td} ${num}`}>{success}%</td>
                  <td className={`${td} ${num}`}>{formatUSDCompact(base.leftTypical)}</td>
                  <td className={`${td} ${num}`}>{formatUSDCompact(base.leftPoor)}</td>
                </tr>
                {scenarios.map(({ scenario, result }) => (
                  <tr key={scenario.id}>
                    <td className={`${td} font-medium`}>{scenario.name}</td>
                    <td className={`${td} text-slate-600`}>{describeScenario(plan, scenario)}</td>
                    {result.issues.length > 0 ? (
                      <td colSpan={3} className={`${td} text-right text-red-700`}>{result.issues.join(' ')}</td>
                    ) : (
                      <>
                        <td className={`${td} ${num}`}>{Math.round(result.successRate * 100)}%</td>
                        <td className={`${td} ${num}`}>{formatUSDCompact(result.leftTypical)}</td>
                        <td className={`${td} ${num}`}>{formatUSDCompact(result.leftPoor)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section title="Your plan">
          <Facts
            rows={[
              ['Filing status', plan.filingStatus === 'married' ? 'Married filing jointly (spouse assumed same age)' : 'Single'],
              ['Ages', `Now ${plan.currentAge} · retire at ${plan.retirementAge} · plan to ${plan.lifeExpectancy}`],
              ['Yearly spending', `${formatUSD(plan.annualSpending)} in today's dollars, excluding healthcare`],
              ['Social Security', `${formatUSD(plan.socialSecurityAtFRA)}/mo at 67${people === 2 ? ' (combined)' : ''}, claiming at ${plan.socialSecurityClaimAge}`],
              ['Healthcare', `${formatUSD(plan.healthcare.preMedicareAnnual)}/yr before Medicare, ${formatUSD(plan.healthcare.medicareAnnual)}/yr on Medicare, per person; +${pct(plan.healthcare.excessInflation)} above inflation`],
              ['Returns', `${pct(plan.assumptions.returnPreRetirement)} before / ${pct(plan.assumptions.returnPostRetirement)} after retirement; volatility ${pct(plan.assumptions.volatilityPreRetirement, 0)} / ${pct(plan.assumptions.volatilityPostRetirement, 0)}`],
              ['Inflation', pct(plan.assumptions.inflation)],
            ]}
          />

          <h3 className="pt-2 text-sm font-semibold">Accounts</h3>
          {plan.accounts.length === 0 ? (
            <p className="text-sm text-slate-600">None</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Account</th>
                  <th className={th}>Type</th>
                  <th className={`${th} ${num}`}>Balance</th>
                  <th className={`${th} ${num}`}>You add / yr</th>
                  <th className={`${th} ${num}`}>Match / yr</th>
                </tr>
              </thead>
              <tbody>
                {plan.accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className={td}>{acc.name}</td>
                    <td className={`${td} text-slate-600`}>{ACCOUNT_TYPE_LABEL[acc.type]}</td>
                    <td className={`${td} ${num}`}>{formatUSD(acc.balance)}</td>
                    <td className={`${td} ${num}`}>{formatUSD(acc.annualContribution)}</td>
                    <td className={`${td} ${num}`}>{formatUSD(acc.employerMatch)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 pr-3 font-medium">Total</td>
                  <td />
                  <td className={`py-1 pr-3 font-medium ${num}`}>{formatUSD(plan.accounts.reduce((s, x) => s + x.balance, 0))}</td>
                  <td className={`py-1 pr-3 ${num}`}>{formatUSD(plan.accounts.reduce((s, x) => s + x.annualContribution, 0))}</td>
                  <td className={`py-1 pr-3 ${num}`}>{formatUSD(plan.accounts.reduce((s, x) => s + x.employerMatch, 0))}</td>
                </tr>
              </tbody>
            </table>
          )}

          {(plan.incomeStreams.length > 0 || a.enabled) && (
            <>
              <h3 className="pt-2 text-sm font-semibold">Other income</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {plan.incomeStreams.map((s) => (
                  <li key={s.id}>
                    {s.name} ({INCOME_KIND_LABEL[s.kind]}): {formatUSD(s.annualAmount)}/yr from {s.startAge}
                    {s.endAge === null ? ' for life' : ` to ${s.endAge}`}, {s.inflationAdjusted ? 'rises with inflation' : 'fixed'},{' '}
                    {pct(s.taxableShare, 0)} taxable
                  </li>
                ))}
                {a.enabled && (
                  <li>
                    Annuity purchase: {formatUSD(a.amount)} at {a.purchaseAge} from{' '}
                    {a.fundedFrom === 'pretax' ? 'pre-tax' : 'after-tax'} savings at a {pct(payoutRate(a, plan.filingStatus))} payout
                    {a.payoutRate === null ? ' (estimate)' : ' (quote)'} ≈ {formatUSD(a.amount * payoutRate(a, plan.filingStatus))}/yr for life,{' '}
                    {a.inflationAdjusted ? 'rising with inflation' : 'fixed'}
                  </li>
                )}
              </ul>
            </>
          )}
        </Section>

        <Section title="Milestones (average returns, today's dollars)">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Age</th>
                <th className={`${th} ${num}`}>Savings</th>
                <th className={`${th} ${num}`}>Spending incl. healthcare</th>
                <th className={`${th} ${num}`}>Income</th>
                <th className={`${th} ${num}`}>Federal tax</th>
                <th className={`${th} ${num}`}>Required min. distribution</th>
              </tr>
            </thead>
            <tbody>
              {milestoneYears(plan, det.years).map((y) => (
                <tr key={y.age}>
                  <td className={td}>
                    {y.age}
                    {y.age === plan.retirementAge && <span className="text-slate-500"> · retire</span>}
                  </td>
                  <td className={`${td} ${num}`}>{formatUSD(y.startBalanceReal)}</td>
                  {y.age < plan.retirementAge ? (
                    <td colSpan={3} className={`${td} text-center text-slate-500`}>Working and saving</td>
                  ) : (
                    <>
                      <td className={`${td} ${num}`}>{formatUSD(y.spending / y.priceLevel)}</td>
                      <td className={`${td} ${num}`}>{formatUSD(y.income / y.priceLevel)}</td>
                      <td className={`${td} ${num}`}>{formatUSD(y.tax / y.priceLevel)}</td>
                    </>
                  )}
                  <td className={`${td} ${num}`}>{formatUSD(y.rmd / y.priceLevel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="How this was calculated">
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-700">
            <li>
              {mc.runs.toLocaleString()} simulated markets with random yearly returns (lognormal) and random inflation; “chance
              money lasts” is the share where savings cover spending every year to {plan.lifeExpectancy}.
            </li>
            <li>
              Withdrawals: required minimum distributions first, the HSA for healthcare, then cash → taxable → pre-tax → Roth → HSA.
              Surplus income is reinvested.
            </li>
            <li>
              Federal income tax uses 2026 brackets and deductions, indexed to inflation, and taxes up to 85% of Social Security.
            </li>
            <li>
              Not modeled: state tax, capital gains, Medicare surcharges (IRMAA), ACA subsidies, long-term care, survivor
              benefits. Social Security assumes the ssa.gov estimate, which assumes you keep working until 67.
            </li>
            {plan.scenarios.some((s) => s.stress !== 'none') && (
              <li>
                Stress tests: {STRESS_LABEL.crash.toLowerCase()}; {STRESS_LABEL['high-inflation'].toLowerCase()}.
              </li>
            )}
          </ul>
        </Section>
      </article>
    </div>
  )
}
