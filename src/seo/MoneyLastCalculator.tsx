import { useMemo, useState, type ReactNode } from 'react'
import { mixLabel, MIX_PRESETS } from '../engine'
import { NumberField, PercentField } from '../components/NumberField'
import { CALL_TO_ACTION } from '../components/styles'
import { formatUSD } from '../utils/format'
import { moneyLast, MONEY_LAST_DEFAULTS, type MoneyLastInputs } from './moneyLast'
import { ScrollRegion } from '../components/ScrollRegion'

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`
/** Ages past this read as "past 110": the table and the IRS tables stop there. */
const OLDEST = 110

const card = 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const select =
  'mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-2 dark:border-slate-500 dark:bg-slate-900'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  )
}

const ageText = (age: number | null) =>
  age === null ? 'indefinitely' : age > OLDEST ? `past age ${OLDEST}` : `to about age ${Math.floor(age)}`
const yearsText = (years: number) => (Number.isFinite(years) ? `${Math.floor(years)} years` : 'indefinitely')

/** Interactive "how long will my money last" calculator. */
export function MoneyLastCalculator() {
  const [inputs, setInputs] = useState<MoneyLastInputs>(MONEY_LAST_DEFAULTS)
  const set = (patch: Partial<MoneyLastInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const valid = inputs.planToAge > inputs.age
  const r = useMemo(() => (valid ? moneyLast(inputs) : null), [inputs, valid])

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className={`${card} space-y-4`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <NumberField label="Savings today" prefix="$" value={inputs.savings} onChange={(savings) => set({ savings })} min={0} />
        <NumberField
          label="Yearly spending from savings"
          prefix="$"
          value={inputs.spending}
          onChange={(spending) => set({ spending })}
          min={0}
          info="What you take out each year, in today’s dollars. It rises with inflation. Leave out spending covered by Social Security or a pension."
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Your age" value={inputs.age} onChange={(age) => set({ age })} min={18} max={100} />
          <NumberField
            label="Plan to age"
            value={inputs.planToAge}
            onChange={(planToAge) => set({ planToAge })}
            min={19}
            max={110}
            error={valid ? undefined : 'Must be older than your age'}
            info="How long the money needs to last. Many plans use 90–95; check your own life expectancy with the SSA calculator linked below."
          />
        </div>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Investment mix</span>
          <select className={select} value={inputs.stockShare} onChange={(e) => set({ stockShare: Number(e.target.value) })}>
            {MIX_PRESETS.map((share) => (
              <option key={share} value={share}>
                {mixLabel(share)}
              </option>
            ))}
          </select>
        </label>
        <PercentField
          label="Average inflation"
          value={inputs.inflation}
          onChange={(inflation) => set({ inflation })}
          min={0}
          max={10}
          info="Long-run US inflation has averaged around 3% a year. Spending rises with it."
        />
        {r && (
          <p className="text-xs text-muted">
            This mix assumes an average return of {pct(r.mean)} a year with {pct(r.volatility)} volatility (illustrative
            long-run figures), before taxes and fees.
          </p>
        )}
      </form>

      {r && (
        <section className="space-y-4" aria-label="Results">
          <div className={card}>
            <p className="text-sm text-slate-600 dark:text-slate-400">With typical market returns, your money lasts</p>
            {/* Only the headline is announced to screen readers as you type */}
            <p className="mt-1 text-3xl font-semibold" aria-live="polite">
              {Number.isFinite(r.typical.years)
                ? `${yearsText(r.typical.years)}, ${ageText(r.typical.runOutAge)}`
                : 'Indefinitely'}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {Number.isFinite(r.typical.years)
                ? r.typical.years >= r.horizon
                  ? `That’s past your plan age of ${inputs.planToAge}.`
                  : `That’s ${Math.ceil(r.horizon - r.typical.years)} years short of your plan age of ${inputs.planToAge}.`
                : 'Your savings earn more than you spend, after inflation.'}
            </p>
            <dl className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
              <Row label="Withdrawal rate">{pct(r.withdrawalRate)} of savings in the first year</Row>
            </dl>
          </div>

          <div className={`${card} ${r.simulated.chanceLasts < 0.75 ? 'border-amber-400 dark:border-amber-500' : ''}`}>
            <h2 className="font-medium">Across 1,000 simulated markets</h2>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{pct(r.simulated.chanceLasts, 0)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              chance your money lasts to age {inputs.planToAge}, with ups and downs in returns and inflation
            </p>
            <dl className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
              <Row label="Lasts at least this long in half the markets">{yearsText(r.simulated.medianYears)}</Row>
              <Row label="Lasts at least this long in 9 of 10 markets">{yearsText(r.simulated.poorYears)}</Row>
            </dl>
            <p className="mt-2 text-xs text-muted">
              A bad stretch early in retirement does the most damage, because you’re selling while prices are down. That’s
              why the simulated range is wide.
            </p>
          </div>

          <div className={card}>
            <h2 className="font-medium">Spending that lasts to age {inputs.planToAge}</h2>
            <dl className="mt-2 text-sm">
              <Row label="With typical returns">{formatUSD(r.spendingThatLasts.typical)} a year</Row>
              <Row label="In 9 of 10 simulated markets">{formatUSD(r.spendingThatLasts.ninetyPercent)} a year</Row>
            </dl>
            <p className="mt-2 text-xs text-muted">In today’s dollars, rising with inflation, from {formatUSD(inputs.savings)}.</p>
          </div>

          <div className={card}>
            <h2 className="font-medium">Year by year, with typical returns</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">In today’s dollars. Spending comes out at the start of each year.</p>
            <ScrollRegion label="Year by year, with typical returns" className="mt-2 max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-2 font-normal">Age</th>
                    <th className="py-1 pr-2 text-right font-normal">Start</th>
                    <th className="py-1 pr-2 text-right font-normal">Spending</th>
                    <th className="py-1 text-right font-normal">End</th>
                  </tr>
                </thead>
                <tbody>
                  {r.typical.schedule.map((y) => (
                    <tr key={y.age} className="border-t border-slate-100 tabular-nums dark:border-slate-800">
                      <td className="py-1 pr-2">{y.age}</td>
                      <td className="py-1 pr-2 text-right">{formatUSD(y.start)}</td>
                      <td className="py-1 pr-2 text-right">{formatUSD(y.withdrawal)}</td>
                      <td className="py-1 text-right">{formatUSD(y.end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          </div>

          <a
            href="../"
            className={CALL_TO_ACTION}
          >
            Add Social Security, taxes and healthcare in the free retirement planner →
          </a>
        </section>
      )}
    </div>
  )
}
