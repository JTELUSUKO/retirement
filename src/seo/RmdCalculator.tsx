import { useMemo, useState, type ReactNode } from 'react'
import { TAX_CONFIG, NO_INCOME_TAX_STATES, type FilingStatus } from '../engine'
import { NumberField, PercentField } from '../components/NumberField'
import { CALL_TO_ACTION } from '../components/styles'
import { ALL_STATES } from '../utils/states'
import { formatUSD } from '../utils/format'
import { rmdCalculator, RMD_DEFAULTS, type RmdInputs } from './rmd'
import { ScrollRegion } from '../components/ScrollRegion'

const YEAR = TAX_CONFIG.year
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`

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

/** Interactive RMD calculator: this year's required minimum distribution, deadline, tax and future RMDs. */
export function RmdCalculator() {
  const [inputs, setInputs] = useState<RmdInputs>(RMD_DEFAULTS)
  const set = (patch: Partial<RmdInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const r = useMemo(() => rmdCalculator(inputs), [inputs])
  const tax = r.tax
  const alsoCosts = tax
    ? [
        tax.alsoCosts.socialSecurity && 'makes more of your Social Security taxable',
        tax.alsoCosts.seniorDeduction && 'shrinks the new senior deduction',
      ].filter((x): x is string => Boolean(x))
    : []

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className={`${card} space-y-4`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <NumberField
          label="Year you were born"
          value={inputs.birthYear}
          onChange={(birthYear) => set({ birthYear })}
          min={1916}
          max={2008}
          info="Sets when RMDs start: age 73 if born 1951–1959, age 75 if born 1960 or later."
        />
        <NumberField
          label={`Balance on December 31, ${YEAR - 1}`}
          prefix="$"
          value={inputs.balance}
          onChange={(balance) => set({ balance })}
          min={0}
          info="Traditional IRA, SEP or SIMPLE IRA, or 401(k)/403(b) balance at the end of last year. Leave out Roth IRAs: they have no RMDs for the original owner."
        />
        <fieldset className="space-y-3">
          <legend className="w-full border-t border-slate-200 pt-4 text-sm font-medium dark:border-slate-800">
            For the tax estimate (optional)
          </legend>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Tax filing status</span>
            <select className={select} value={inputs.status} onChange={(e) => set({ status: e.target.value as FilingStatus })}>
              <option value="married">Married filing jointly</option>
              <option value="single">Single</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">State</span>
            <select className={select} value={inputs.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="">Leave out state tax</option>
              {ALL_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                  {NO_INCOME_TAX_STATES[code] ? ' (no income tax)' : ''}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Other taxable income this year"
            prefix="$"
            value={inputs.otherIncome}
            onChange={(otherIncome) => set({ otherIncome })}
            min={0}
            info="Pensions, wages, interest and other ordinary income, not counting this RMD or Social Security."
          />
          <NumberField
            label="Social Security received this year"
            prefix="$"
            value={inputs.socialSecurity}
            onChange={(socialSecurity) => set({ socialSecurity })}
            min={0}
            info="Total yearly benefits for your household."
          />
          <PercentField
            label="Expected yearly return"
            value={inputs.annualReturn}
            onChange={(annualReturn) => set({ annualReturn })}
            min={0}
            max={15}
            info="Used only to project future RMDs in the table."
          />
        </fieldset>
      </form>

      <section className="space-y-4" aria-label="Results">
        <div className={card}>
          {r.rmd > 0 ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">Your {YEAR} required minimum distribution</p>
              {/* Only the headline is announced to screen readers as you type */}
              <p className="mt-1 text-3xl font-semibold tabular-nums" aria-live="polite">
                {formatUSD(r.rmd)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {pct(r.rate, 2)} of your balance · take it by <strong className="text-slate-900 dark:text-slate-100">{r.deadline}</strong>
              </p>
              <dl className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
                <Row label={`Your age in ${YEAR}`}>{r.age}</Row>
                <Row label="IRS life expectancy factor">{r.divisor}</Row>
                <Row label="Balance ÷ factor">
                  {formatUSD(inputs.balance)} ÷ {r.divisor}
                </Row>
              </dl>
              {r.firstYearGrace && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  This is your first RMD, so you can wait until April 1, {YEAR + 1}. But your {YEAR + 1} RMD is also due by December 31,{' '}
                  {YEAR + 1}, so waiting puts two RMDs in one tax year.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">No RMD required for {YEAR}</p>
              <p className="mt-1 text-2xl font-semibold" aria-live="polite">
                Your first RMD is for {r.firstYear}, the year you turn {r.startAge}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                The table below projects it using your expected return. The first one can wait until April 1, {r.firstYear + 1}.
              </p>
            </>
          )}
        </div>

        {tax && (
          <div className={card}>
            <h2 className="font-medium">Estimated tax on this RMD</h2>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatUSD(tax.extraTax)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{pct(tax.effectiveRate)} of the RMD</p>
            <dl className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
              <Row label="Federal income tax">{formatUSD(tax.extraFederal)}</Row>
              <Row label="State income tax">{inputs.state ? formatUSD(tax.extraState) : 'not included'}</Row>
              <Row label="Federal bracket of the last dollar">
                {tax.topBracket === 0 ? '0% (covered by deductions)' : pct(tax.topBracket, 0)}
              </Row>
              <Row label="Income before → after (AGI)">
                {formatUSD(tax.before.magi)} → {formatUSD(tax.after.magi)}
              </Row>
            </dl>
            {alsoCosts.length > 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Besides your bracket rate, each RMD dollar also {alsoCosts.join(' and ')}. That’s included above.
              </p>
            )}
            {tax.irmaa.applies && (
              <p className="mt-2 text-sm">
                <strong>Medicare:</strong>{' '}
                {tax.irmaa.extraYearly > 0
                  ? `this RMD likely adds an income surcharge (IRMAA) of about ${formatUSD(tax.irmaa.extraYearly)} a year`
                  : tax.irmaa.afterYearly > 0
                    ? `your income is in a surcharge (IRMAA) tier, about ${formatUSD(tax.irmaa.afterYearly)} a year`
                    : 'no income surcharge (IRMAA)'}
                {tax.irmaa.people > 1 ? ' for the two of you' : ''} two years from now, at {YEAR} tiers.
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Federal and {YEAR} state rules, simplified. Withholding from the RMD can cover this tax.
            </p>
          </div>
        )}

        {r.schedule.length > 0 && (
          <div className={card}>
            <h2 className="font-medium">Your RMDs year by year</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Projected at a {pct(inputs.annualReturn)} return, taking only the minimum each year. Actual RMDs use each
              December 31 balance.
            </p>
            <ScrollRegion label="Your RMDs year by year" className="mt-2 max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-2 font-normal">Year</th>
                    <th className="py-1 pr-2 font-normal">Age</th>
                    <th className="py-1 pr-2 text-right font-normal">Start balance</th>
                    <th className="py-1 pr-2 text-right font-normal">Factor</th>
                    <th className="py-1 text-right font-normal">RMD</th>
                  </tr>
                </thead>
                <tbody>
                  {r.schedule.map((y) => (
                    <tr key={y.year} className="border-t border-slate-100 tabular-nums dark:border-slate-800">
                      <td className="py-1 pr-2">{y.year}</td>
                      <td className="py-1 pr-2">{y.age}</td>
                      <td className="py-1 pr-2 text-right">{formatUSD(y.startBalance)}</td>
                      <td className="py-1 pr-2 text-right">{y.divisor}</td>
                      <td className="py-1 text-right">{formatUSD(y.rmd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          </div>
        )}

        <a
          href="../"
          className={CALL_TO_ACTION}
        >
          See how RMDs fit your whole retirement in the free planner →
        </a>
      </section>
    </div>
  )
}
