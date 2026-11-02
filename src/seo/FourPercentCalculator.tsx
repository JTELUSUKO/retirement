import { useMemo, useState } from 'react'
import { mixLabel, MIX_PRESETS } from '../engine'
import { NumberField, PercentField } from '../components/NumberField'
import { CALL_TO_ACTION } from '../components/styles'
import { formatUSD } from '../utils/format'
import { FOUR_PERCENT_DEFAULTS, fourPercent, GRID_RATES, GRID_YEARS, savingsNeeded, successGrid, type FourPercentInputs } from './fourPercent'

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`

/** Rounded, but "100%" only when every simulated market lasted */
const chanceText = (chance: number) => (chance < 1 && chance >= 0.995 ? '>99%' : `${Math.round(chance * 100)}%`)

const card = 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const select =
  'mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-2 dark:border-slate-500 dark:bg-slate-900'

/** The planner's verdict bands: 85%+ strong, 70–84% borderline, under 70% at risk */
const band = (chance: number) => {
  const p = Math.round(chance * 100)
  return p >= 85 ? 'strong' : p >= 70 ? 'borderline' : 'at-risk'
}
const CELL = {
  strong: 'bg-teal-100 text-teal-950 dark:bg-teal-900/70 dark:text-teal-50',
  borderline: 'bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50',
  'at-risk': 'bg-red-100 text-red-950 dark:bg-red-900/60 dark:text-red-50',
}
const BORDER = {
  strong: '',
  borderline: 'border-amber-400 dark:border-amber-500',
  'at-risk': 'border-red-400 dark:border-red-500',
}

/** Interactive 4% rule calculator. */
export function FourPercentCalculator() {
  const [inputs, setInputs] = useState<FourPercentInputs>(FOUR_PERCENT_DEFAULTS)
  const [spending, setSpending] = useState(40_000)
  const set = (patch: Partial<FourPercentInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const valid = inputs.rate > 0 && inputs.years >= 1
  const r = useMemo(() => (valid ? fourPercent(inputs) : null), [inputs, valid])
  // The table only depends on the mix and inflation, not on the amounts being typed
  const grid = useMemo(() => successGrid(inputs.stockShare, inputs.inflation), [inputs.stockShare, inputs.inflation])
  const row = GRID_RATES.findIndex((rate) => Math.abs(rate - inputs.rate) < 1e-9)
  const col = GRID_YEARS.indexOf(inputs.years)

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className={`${card} h-fit space-y-4`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <NumberField label="Savings at retirement" prefix="$" value={inputs.savings} onChange={(savings) => set({ savings })} min={0} />
        <PercentField
          label="Withdrawal rate"
          value={inputs.rate}
          onChange={(rate) => set({ rate })}
          min={0.1}
          max={20}
          info="The share of your savings you spend in the first year. After that, the dollar amount rises with inflation each year, whatever markets do. That's how the 4% rule works."
        />
        <NumberField
          label="Years it needs to last"
          value={inputs.years}
          onChange={(years) => set({ years })}
          min={1}
          max={60}
          info="The original 4% rule studied 30-year retirements. Retiring early or living long can mean 35–40 years or more."
        />
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
        <section className="min-w-0 space-y-4" aria-label="Results">
          <div className={card}>
            <p className="text-sm text-slate-600 dark:text-slate-400">At {pct(inputs.rate, 2)}, you can spend</p>
            {/* Only the headline is announced to screen readers as you type */}
            <p className="mt-1 text-3xl font-semibold tabular-nums" aria-live="polite">
              {formatUSD(Math.round(r.firstYear))} in the first year
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {formatUSD(Math.round(r.firstYear / 12))} a month, then raised with inflation every year after.
            </p>
          </div>

          <div className={`${card} ${BORDER[band(r.chanceLasts)]}`}>
            <h2 className="font-medium">Across 1,000 simulated markets</h2>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{pct(r.chanceLasts, 0)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              chance your money lasts {inputs.years} years, with ups and downs in returns and inflation
            </p>
            <p className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
              Highest rate that lasted {inputs.years} years in 9 of 10 markets:{' '}
              <strong className="tabular-nums">{pct(r.rateFor90, 2)}</strong> ({formatUSD(Math.round(inputs.savings * r.rateFor90))} in the first year)
            </p>
          </div>

          <div className={card}>
            <h2 className="font-medium">How much do you need?</h2>
            <div className="mt-2 grid items-end gap-4 sm:grid-cols-2">
              <NumberField
                label="Yearly spending from savings"
                prefix="$"
                value={spending}
                onChange={setSpending}
                min={0}
                info="What your savings must cover each year, after Social Security and any pension."
              />
              <p className="pb-2 text-sm">
                <span className="block text-2xl font-semibold tabular-nums">{formatUSD(Math.round(savingsNeeded(spending, inputs.rate)))}</span>
                at {pct(inputs.rate, 2)}, which is {Math.round((1 / inputs.rate) * 10) / 10}× your spending
              </p>
            </div>
          </div>

          <div className={card}>
            <h2 className="font-medium">Chance the money lasts, by withdrawal rate and years</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {mixLabel(inputs.stockShare)}, {pct(inputs.inflation)} average inflation, 1,000 simulated markets.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-sm tabular-nums">
                <caption className="sr-only">Chance the money lasts, by first-year withdrawal rate (rows) and years in retirement (columns)</caption>
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className="px-2 py-1 text-left font-normal">Rate</th>
                    {GRID_YEARS.map((years) => (
                      <th key={years} scope="col" className="px-2 py-1 text-center font-normal">
                        {years} yrs
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GRID_RATES.map((rate, i) => (
                    <tr key={rate}>
                      <th scope="row" className={`px-2 py-1 text-left font-medium ${i === row ? 'text-teal-800 dark:text-teal-300' : ''}`}>
                        {pct(rate)}
                      </th>
                      {grid[i].map((chance, j) => (
                        <td
                          key={j}
                          className={`rounded px-2 py-1.5 text-center ${CELL[band(chance)]} ${i === row && j === col ? 'font-bold ring-2 ring-slate-900 dark:ring-white' : ''}`}
                        >
                          {chanceText(chance)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${CELL.strong}`} aria-hidden />85% or more</span>
              <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${CELL.borderline}`} aria-hidden />70–84%</span>
              <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${CELL['at-risk']}`} aria-hidden />Under 70%</span>
              {row >= 0 && col >= 0 && <span>Outlined: your rate and years</span>}
            </p>
          </div>

          <a href="../" className={CALL_TO_ACTION}>
            Add Social Security, taxes and healthcare in the free retirement planner →
          </a>
        </section>
      )}
    </div>
  )
}
