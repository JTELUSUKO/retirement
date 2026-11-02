import { useMemo, useState, type ReactNode } from 'react'
import { NO_INCOME_TAX_STATES, TAX_CONFIG, type FilingStatus } from '../engine'
import { NumberField, PercentField } from '../components/NumberField'
import { ALL_STATES } from '../utils/states'
import { formatUSD } from '../utils/format'
import { rothConversion, ROTH_DEFAULTS, type RothInputs } from './rothConversion'

const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`

const card = 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const select =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900'

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? 'font-semibold' : ''}`}>
      <dt className={strong ? '' : 'text-slate-600 dark:text-slate-400'}>{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  )
}

/** Interactive Roth conversion calculator: tax cost this year, bracket room, Medicare surcharge, break-even. */
export function RothCalculator() {
  const [inputs, setInputs] = useState<RothInputs>(ROTH_DEFAULTS)
  const set = (patch: Partial<RothInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const r = useMemo(() => rothConversion(inputs), [inputs])
  const ahead = r.compare.convert - r.compare.dontConvert
  // Costs on top of the bracket rate, explained under the result
  const federalRate = inputs.conversion > 0 ? r.extraFederal / inputs.conversion : 0
  const alsoCosts = [
    r.alsoCosts.socialSecurity && 'makes more of your Social Security taxable',
    r.alsoCosts.seniorDeduction && 'shrinks the new senior deduction',
  ].filter((x): x is string => Boolean(x))

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className={`${card} space-y-4`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
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
          label="Your age this year"
          value={inputs.age}
          onChange={(age) => set({ age })}
          min={18}
          max={100}
          info="Used for the 65+ deductions, the early-withdrawal penalty and Medicare. Married couples are treated as both being this age."
        />
        <NumberField
          label="Other taxable income this year"
          prefix="$"
          value={inputs.otherIncome}
          onChange={(otherIncome) => set({ otherIncome })}
          min={0}
          info="Wages, pensions, IRA or 401(k) withdrawals, interest and other ordinary income, before the conversion. Leave out Social Security; it has its own box."
        />
        <NumberField
          label="Social Security received this year"
          prefix="$"
          value={inputs.socialSecurity}
          onChange={(socialSecurity) => set({ socialSecurity })}
          min={0}
          info="Total yearly benefits for your household. A conversion can make more of it taxable."
        />
        <NumberField
          label="Amount to convert"
          prefix="$"
          value={inputs.conversion}
          onChange={(conversion) => set({ conversion })}
          min={0}
        />
        <fieldset className="space-y-3">
          <legend className="w-full border-t border-slate-200 pt-4 text-sm font-medium dark:border-slate-800">Converting vs. not converting</legend>
          <NumberField label="Years until you spend this money" value={inputs.years} onChange={(years) => set({ years })} min={1} max={60} />
          <PercentField label="Expected yearly return" value={inputs.annualReturn} onChange={(annualReturn) => set({ annualReturn })} min={0} max={15} />
          <PercentField
            label="Your tax rate when you withdraw later"
            value={inputs.futureTaxRate}
            onChange={(futureTaxRate) => set({ futureTaxRate })}
            min={0}
            max={60}
            info="Your expected federal + state rate on traditional IRA withdrawals in retirement. Required minimum distributions, Social Security and a surviving spouse filing single can push it higher than today."
          />
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Pay the tax on the conversion from</span>
            <select className={select} value={inputs.payTaxFrom} onChange={(e) => set({ payTaxFrom: e.target.value as RothInputs['payTaxFrom'] })}>
              <option value="savings">Other savings</option>
              <option value="conversion">The conversion itself (withheld)</option>
            </select>
          </label>
        </fieldset>
      </form>

      <section className="space-y-4" aria-label="Results">
        <div className={card}>
          <p className="text-sm text-slate-600 dark:text-slate-400">Extra tax this year from converting {formatUSD(inputs.conversion)}</p>
          {/* Only the headline is announced to screen readers as you type */}
          <p className="mt-1 text-3xl font-semibold tabular-nums" aria-live="polite">{formatUSD(r.extraTax)}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {inputs.conversion > 0 ? `${pct(r.effectiveRate)} of the amount converted` : 'Enter an amount to convert'}
          </p>
          <dl className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
            <Row label="Federal income tax">{formatUSD(r.extraFederal)}</Row>
            <Row label="State income tax">{inputs.state ? formatUSD(r.extraState) : 'not included'}</Row>
            <Row label="Federal bracket of the last dollar converted">
              {r.topBracket === 0 ? '0% (covered by deductions)' : pct(r.topBracket, 0)}
            </Row>
            <Row label={r.topBracket === 0 ? 'Room left before any federal tax' : `Room left in the ${pct(r.topBracket, 0)} bracket`}>
              {Number.isFinite(r.roomInBracket) ? formatUSD(r.roomInBracket) : 'top bracket'}
            </Row>
            <Row label="Income before → after (AGI)">
              {formatUSD(r.before.magi)} → {formatUSD(r.after.magi)}
            </Row>
          </dl>
          {alsoCosts.length > 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Besides your bracket rate, each converted dollar also {alsoCosts.join(' and ')}. That’s included above: your
              federal tax on this conversion works out to {pct(federalRate)}.
            </p>
          )}
        </div>

        <div className={card}>
          <h3 className="font-medium">Fill a bracket</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Conversion that brings this year’s taxable income to the top of each federal bracket.</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 font-normal">Up to the top of</th>
                <th className="py-1 text-right font-normal">Convert</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {r.fillTo.map(({ rate, amount }) => (
                <tr key={rate} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{pct(rate, 0)} bracket</td>
                  <td className="py-1.5 text-right tabular-nums">{amount > 0 ? formatUSD(amount) : 'already past it'}</td>
                  <td className="py-1.5 text-right">
                    {amount > 0 && (
                      <button type="button" className="text-teal-700 underline underline-offset-2 dark:text-teal-400" onClick={() => set({ conversion: amount })}>
                        Use
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {r.irmaa.applies && (
          <div className={`${card} ${r.irmaa.extraYearly > 0 ? 'border-amber-400 dark:border-amber-500' : ''}`}>
            <h3 className="font-medium">Medicare premiums two years from now</h3>
            <p className="mt-1 text-sm">
              {r.irmaa.extraYearly > 0 ? (
                <>
                  This conversion is likely to add an income surcharge (IRMAA) of about{' '}
                  <strong className="tabular-nums">{formatUSD(r.irmaa.extraYearly)}</strong> a year
                </>
              ) : r.irmaa.afterYearly > 0 ? (
                <>
                  Your income is already in a surcharge (IRMAA) tier, about{' '}
                  <strong className="tabular-nums">{formatUSD(r.irmaa.afterYearly)}</strong> a year; this conversion doesn’t
                  move you to a higher one
                </>
              ) : (
                'No income surcharge (IRMAA)'
              )}
              {r.irmaa.people > 1 ? ' for the two of you' : ''}, at {TAX_CONFIG.year} tiers.
              {Number.isFinite(r.irmaa.roomInTier) && (
                <>
                  {' '}You could add about <strong className="tabular-nums">{formatUSD(r.irmaa.roomInTier)}</strong> more income
                  before the next tier.
                </>
              )}
            </p>
          </div>
        )}

        <div className={card}>
          <h3 className="font-medium">After {inputs.years} years, after tax</h3>
          <dl className="mt-2 text-sm">
            <Row label="Convert">{formatUSD(r.compare.convert)}</Row>
            <Row label="Don’t convert">{formatUSD(r.compare.dontConvert)}</Row>
            <Row label={ahead >= 0 ? 'Converting comes out ahead by' : 'Not converting comes out ahead by'} strong>
              {formatUSD(Math.abs(ahead))}
            </Row>
          </dl>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Converting comes out ahead if your tax rate when you withdraw is above{' '}
            <strong className="text-slate-900 dark:text-slate-100">{pct(r.compare.breakEvenRate)}</strong>.
            {inputs.payTaxFrom === 'savings' && inputs.annualReturn > 0
              ? ' Paying the tax from other savings lowers this, because the full amount keeps growing tax-free.'
              : ''}
          </p>
          {r.compare.earlyPenalty > 0 && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
              You’re under 59½, so tax withheld from the conversion also owes a 10% early-withdrawal penalty (about{' '}
              {formatUSD(r.compare.earlyPenalty)}). Paying the tax from other savings avoids it.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Assumes the same return in both cases, withdrawal of the traditional IRA at your later tax rate, and money kept in
            a taxable account losing 15% of its growth to tax.
          </p>
        </div>

        <a
          href="../"
          className="block rounded-lg bg-teal-700 px-4 py-3 text-center font-medium text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          Plan conversions year by year in the free retirement planner →
        </a>
      </section>
    </div>
  )
}
