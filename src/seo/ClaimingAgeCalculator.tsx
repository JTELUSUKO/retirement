import { useMemo, useState, type ReactNode } from 'react'
import { TAX_CONFIG } from '../engine'
import { NumberField, PercentField } from '../components/NumberField'
import { CALL_TO_ACTION } from '../components/styles'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { claimingAge, CLAIMING_DEFAULTS, type ClaimingInputs } from './claimingAge'

const { fullRetirementAge, earliestClaimAge, latestClaimAge } = TAX_CONFIG.socialSecurity

const card = 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  )
}

/** "about age 80 and 5 months", or "not by age 110" */
const ageText = (age: number | null) => {
  if (age === null) return 'not by age 110'
  let years = Math.floor(age)
  let months = Math.round((age - years) * 12)
  if (months === 12) {
    years += 1
    months = 0
  }
  return `about age ${years}${months ? ` and ${months} month${months === 1 ? '' : 's'}` : ''}`
}

/** Interactive Social Security claiming-age calculator. */
export function ClaimingAgeCalculator() {
  const [inputs, setInputs] = useState<ClaimingInputs>(CLAIMING_DEFAULTS)
  const set = (patch: Partial<ClaimingInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const r = useMemo(() => claimingAge(inputs), [inputs])
  const maxMonthly = r.options[r.options.length - 1].monthly

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className={`${card} h-fit space-y-4`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <NumberField
          label={`Your monthly benefit at ${fullRetirementAge}`}
          prefix="$"
          value={inputs.benefitAtFRA}
          onChange={(benefitAtFRA) => set({ benefitAtFRA })}
          min={0}
          info={`Your benefit at full retirement age (${fullRetirementAge} for anyone born in 1960 or later), from your statement at ssa.gov/myaccount.`}
        />
        <NumberField
          label="Add up benefits to age"
          value={inputs.planToAge}
          onChange={(planToAge) => set({ planToAge })}
          min={earliestClaimAge}
          max={110}
          info="How long you expect to collect. Many people use 85–95; the SSA life expectancy calculator (linked below) gives an estimate for you."
        />
        <PercentField
          label="Return on money you get sooner"
          value={inputs.realReturn}
          onChange={(realReturn) => set({ realReturn })}
          min={0}
          max={10}
          info="Optional. Earlier benefits could be invested (or let you leave savings invested). Enter a yearly return after inflation to value earlier money more; 0% simply adds up the payments."
        />
        <p className="text-xs text-muted">
          Amounts are in today’s dollars: benefits rise with inflation each year. Before taxes; for one person (spousal and
          survivor benefits aren’t included).
        </p>
      </form>

      <section className="min-w-0 space-y-4" aria-label="Results">
        <div className={card}>
          <p className="text-sm text-slate-600 dark:text-slate-400">If you collect to age {inputs.planToAge}, the most in total comes from claiming at</p>
          {/* Only the headline is announced to screen readers as you type */}
          <p className="mt-1 text-3xl font-semibold" aria-live="polite">
            {inputs.benefitAtFRA > 0 ? `Age ${r.best.age}: ${formatUSDCompact(r.best.lifetime)} in total` : 'Enter your benefit'}
          </p>
          {inputs.benefitAtFRA > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {formatUSD(Math.round(r.best.monthly))} a month
              {inputs.realReturn > 0 ? ', with earlier money valued at your return' : ''}.
            </p>
          )}
        </div>

        <div className={card}>
          <h2 className="font-medium">Break-even ages</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Waiting pays more in total if you live past</p>
          <dl className="mt-2 text-sm">
            <Row label={`Waiting from ${earliestClaimAge} to ${fullRetirementAge}`}>{ageText(r.breakEven.from62to67)}</Row>
            <Row label={`Waiting from ${fullRetirementAge} to ${latestClaimAge}`}>{ageText(r.breakEven.from67to70)}</Row>
            <Row label={`Waiting from ${earliestClaimAge} to ${latestClaimAge}`}>{ageText(r.breakEven.from62to70)}</Row>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Before the break-even age, claiming earlier has paid more; after it, waiting has, for the rest of your life.
          </p>
        </div>

        <div className={card}>
          <h2 className="font-medium">Every claiming age</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1 pr-2 font-normal">Claim at</th>
                  <th className="py-1 pr-2 font-normal">Monthly</th>
                  <th className="py-1 pr-2 text-right font-normal">Of full</th>
                  <th className="py-1 text-right font-normal">Total to {inputs.planToAge}</th>
                </tr>
              </thead>
              <tbody>
                {r.options.map((o) => {
                  const best = inputs.benefitAtFRA > 0 && o.age === r.best.age
                  return (
                    <tr key={o.age} className={`border-t border-slate-100 tabular-nums dark:border-slate-800 ${best ? 'bg-teal-50 dark:bg-teal-950' : ''}`}>
                      <td className="py-1.5 pr-2">
                        {o.age}
                        {o.age === fullRetirementAge && <span className="text-muted"> (full)</span>}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-2">
                          <span className="w-16 shrink-0">{formatUSD(Math.round(o.monthly))}</span>
                          {/* Bar: the monthly benefit against the age-70 one */}
                          <span className="hidden h-2 flex-1 rounded-full bg-slate-100 sm:block dark:bg-slate-800" aria-hidden>
                            <span
                              className="block h-2 rounded-full bg-teal-600 dark:bg-teal-400"
                              style={{ width: `${maxMonthly > 0 ? (o.monthly / maxMonthly) * 100 : 0}%` }}
                            />
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">{Math.round(o.shareOfFull * 100)}%</td>
                      <td className="py-1.5 text-right">
                        {best && <span className="mr-1.5 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900 dark:bg-teal-900 dark:text-teal-100">Most</span>}
                        {formatUSDCompact(o.lifetime)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <a href="../" className={CALL_TO_ACTION}>
          See how your claiming age fits your whole plan in the free retirement planner →
        </a>
      </section>
    </div>
  )
}
