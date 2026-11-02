import { useMemo, useState } from 'react'
import { CAPITAL_MARKETS, TAX_CONFIG } from '../engine'
import { NumberField, PercentField } from '../components/NumberField'
import { ScrollRegion } from '../components/ScrollRegion'
import { CALL_TO_ACTION } from '../components/styles'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { allowedContributions, kidsAccount, KIDS_ACCOUNT_DEFAULTS, type KidsAccountInputs, type Range } from './kidsAccount'

const K = TAX_CONFIG.kidsAccount
const YEAR = TAX_CONFIG.year
const [FIRST_DEPOSIT_YEAR, LAST_DEPOSIT_YEAR] = K.pilotBirthYears

const card = 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

function RangeNote({ range }: { range: Range }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Between <strong className="tabular-nums text-slate-800 dark:text-slate-200">{formatUSDCompact(range.poor)}</strong> and{' '}
      <strong className="tabular-nums text-slate-800 dark:text-slate-200">{formatUSDCompact(range.good)}</strong> in 8 of 10
      simulated markets.
    </p>
  )
}

/** One part of the "what makes up the balance" bar, with its legend entry */
interface Part {
  label: string
  value: number
  color: string
}

function Breakdown({ parts }: { parts: Part[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  const shown = parts.filter((p) => p.value > 0)
  return (
    <div className="mt-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
        {shown.map((p) => (
          <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {shown.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
              {p.label}
            </dt>
            <dd className="tabular-nums">{formatUSD(Math.round(p.value))}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Interactive calculator for the children's investment accounts created by the 2025 tax law. */
export function KidsAccountCalculator() {
  const [inputs, setInputs] = useState<KidsAccountInputs>(KIDS_ACCOUNT_DEFAULTS)
  const set = (patch: Partial<KidsAccountInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const r = useMemo(() => kidsAccount(inputs), [inputs])
  const allowed = allowedContributions(inputs.family, inputs.employer)
  const capped = allowed.family !== inputs.family || allowed.employer !== inputs.employer
  const accessYear = inputs.birthYear + K.accessAge
  const growth = r.atAccess.typical - r.totals.family - r.totals.employer - r.totals.deposit

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className={`${card} h-fit space-y-4`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <NumberField
          label="Child’s birth year"
          value={inputs.birthYear}
          onChange={(birthYear) => set({ birthYear })}
          min={YEAR - K.accessAge + 1}
          max={YEAR}
          info={`Children can have an account until the year they turn ${K.accessAge}. The one-time ${formatUSD(K.pilotAmount)} federal deposit is for US citizens born ${FIRST_DEPOSIT_YEAR}–${LAST_DEPOSIT_YEAR}.`}
        />
        <NumberField
          label="Family contributions per year"
          prefix="$"
          value={inputs.family}
          onChange={(family) => set({ family })}
          min={0}
          info={`From parents, relatives and friends, in today’s dollars, until the year the child turns ${K.accessAge - 1}. Up to ${formatUSD(K.annualLimit)} a year in total, including any employer contribution.`}
        />
        <NumberField
          label="Employer contributions per year"
          prefix="$"
          value={inputs.employer}
          onChange={(employer) => set({ employer })}
          min={0}
          info={`Some employers add money to employees’ children’s accounts, up to ${formatUSD(K.employerLimit)} a year per employee, tax-free to you. It counts toward the ${formatUSD(K.annualLimit)} yearly limit.`}
        />
        {capped && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            ⚠ Capped at {formatUSD(K.annualLimit)} a year in total (employer up to {formatUSD(K.employerLimit)}): using{' '}
            {formatUSD(allowed.family)} family and {formatUSD(allowed.employer)} employer.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-teal-700"
            checked={r.depositEligible && inputs.claimDeposit}
            disabled={!r.depositEligible}
            onChange={(e) => set({ claimDeposit: e.target.checked })}
          />
          <span>
            Include the {formatUSD(K.pilotAmount)} federal deposit
            <span className="block text-xs text-muted">
              {r.depositEligible
                ? 'Requested with IRS Form 4547 when you open the account.'
                : `Only for children born ${FIRST_DEPOSIT_YEAR}–${LAST_DEPOSIT_YEAR}.`}
            </span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Fund fee"
            suffix="%"
            value={Math.round(inputs.fee * 10000) / 100}
            onChange={(v) => set({ fee: v / 100 })}
            min={0}
            max={K.expenseCap * 100}
            info={`The fund’s yearly expense ratio. Accounts may only hold broad US stock index funds charging ${K.expenseCap * 100}% or less; many charge 0.02–0.05%.`}
          />
          <PercentField
            label="Inflation"
            value={inputs.inflation}
            onChange={(inflation) => set({ inflation })}
            min={0}
            max={10}
            info="Results are in today’s dollars, so this only changes how much of the return is real growth."
          />
        </div>
        <NumberField
          label="Also show the value at age"
          value={inputs.laterAge}
          onChange={(laterAge) => set({ laterAge })}
          min={K.accessAge + 1}
          max={100}
          info="If the money stays invested after 18, with nothing more added."
        />
        <p className="text-xs text-muted">
          Invested in US stocks (the only option before {K.accessAge}): an illustrative average return of{' '}
          {(CAPITAL_MARKETS.stocks.mean * 100).toFixed(1)}% a year with {Math.round(CAPITAL_MARKETS.stocks.volatility * 100)}% volatility,
          before inflation and the fund fee.
        </p>
      </form>

      <section className="min-w-0 space-y-4" aria-label="Results">
        {r.tooOld ? (
          <div className={`${card} border-amber-400 dark:border-amber-500`}>
            <p className="font-medium">A child born in {inputs.birthYear} is too old for a new account.</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Accounts are for children who don’t turn {K.accessAge} before the end of the year it’s opened.
            </p>
          </div>
        ) : (
          <>
            <div className={card}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                When the child can take money out (January {accessYear}, the year they turn {K.accessAge}), the account
                could be worth
              </p>
              {/* Only the headline is announced to screen readers as you type */}
              <p className="mt-1 text-3xl font-semibold tabular-nums" aria-live="polite">
                {formatUSD(Math.round(r.atAccess.typical))}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">With typical stock returns, in today’s dollars.</p>
              <RangeNote range={r.atAccess} />
              <Breakdown
                parts={[
                  { label: 'Family contributions', value: r.totals.family, color: 'var(--series-pretax)' },
                  { label: 'Employer contributions', value: r.totals.employer, color: 'var(--series-hsa)' },
                  { label: 'Federal deposit', value: r.totals.deposit, color: 'var(--series-cash)' },
                  { label: 'Investment growth', value: Math.max(growth, 0), color: 'var(--series-taxable)' },
                ]}
              />
            </div>

            <div className={card}>
              <h2 className="font-medium">Left invested to age {inputs.laterAge}</h2>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{formatUSD(Math.round(r.atLater.typical))}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                With typical returns, in today’s dollars, and nothing added after {K.accessAge}.
              </p>
              <RangeNote range={r.atLater} />
              {r.depositEligible && (
                <p className="mt-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
                  The {formatUSD(K.pilotAmount)} federal deposit alone could grow to{' '}
                  <strong className="tabular-nums">{formatUSD(Math.round(r.depositAloneLater))}</strong> by {inputs.laterAge}.
                </p>
              )}
            </div>

            <div className={card}>
              <h2 className="font-medium">Year by year until {K.accessAge}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">With typical returns, in today’s dollars. Money goes in at the start of each year.</p>
              <ScrollRegion label={`Year by year until ${K.accessAge}`} className="mt-2 max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="text-left text-muted">
                      <th className="py-1 pr-2 font-normal">Year</th>
                      <th className="py-1 pr-2 font-normal">Age</th>
                      <th className="py-1 pr-2 text-right font-normal">Added</th>
                      <th className="py-1 text-right font-normal">Value at year end</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.schedule.map((y, t) => (
                      <tr key={y.age} className="border-t border-slate-100 tabular-nums dark:border-slate-800">
                        <td className="py-1 pr-2">{YEAR + t}</td>
                        <td className="py-1 pr-2">{y.age}</td>
                        <td className="py-1 pr-2 text-right">{formatUSD(Math.round(y.added))}</td>
                        <td className="py-1 text-right">{formatUSD(Math.round(y.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            </div>

            <div className={`${card} text-sm text-slate-600 dark:text-slate-400`}>
              <h2 className="font-medium text-slate-900 dark:text-slate-100">At {K.accessAge}, it works like a traditional IRA</h2>
              <p className="mt-1">
                The child can withdraw from January of the year they turn {K.accessAge}. The share that came from family
                contributions comes back tax-free; earnings, employer contributions and the federal deposit are taxed as
                income when withdrawn, with a 10% penalty before 59½ unless an exception applies (such as college costs or
                a first home). Left invested, it can keep growing for retirement.
              </p>
            </div>

            <a href="../" className={CALL_TO_ACTION}>
              Plan your own retirement in the free retirement planner →
            </a>
          </>
        )}
      </section>
    </div>
  )
}
