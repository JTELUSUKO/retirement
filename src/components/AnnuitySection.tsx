import { AGE_LIMITS, estimatePayoutRate, payoutRate } from '../engine'
import { usePlanStore } from '../store/planStore'
import { formatUSD } from '../utils/format'
import { NumberField, PercentField } from './NumberField'

const checkbox = 'h-4 w-4 accent-teal-700 dark:accent-teal-400'

export function AnnuitySection() {
  const { plan, updateAnnuity } = usePlanStore()
  const a = plan.annuityPurchase
  const estimate = estimatePayoutRate(a.purchaseAge, plan.filingStatus, a.inflationAdjusted)
  const rate = payoutRate(a, plan.filingStatus)
  const yearly = a.amount * rate

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className={checkbox}
          checked={a.enabled}
          onChange={(e) =>
            // Default the purchase to the retirement age the first time it's turned on
            updateAnnuity(
              a.purchaseAge < plan.retirementAge
                ? { enabled: e.target.checked, purchaseAge: plan.retirementAge }
                : { enabled: e.target.checked },
            )
          }
        />
        Buy an annuity with part of my savings
      </label>

      {a.enabled && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Amount (today's $)" prefix="$" min={0} step={10_000} value={a.amount} onChange={(v) => updateAnnuity({ amount: v })} />
            <NumberField label="At age" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={a.purchaseAge} onChange={(v) => updateAnnuity({ purchaseAge: v })} />
          </div>

          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Pay with</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              value={a.fundedFrom}
              onChange={(e) => updateAnnuity({ fundedFrom: e.target.value as typeof a.fundedFrom })}
            >
              <option value="pretax">Pre-tax 401(k)/IRA money (payments fully taxable)</option>
              <option value="aftertax">Taxable or cash savings (only earnings taxed)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={checkbox}
              checked={a.inflationAdjusted}
              onChange={(e) => updateAnnuity({ inflationAdjusted: e.target.checked })}
            />
            Payments rise with inflation (starts about 28% lower)
          </label>

          <div className="flex items-end gap-3">
            <div className="w-36">
              <PercentField label="Payout rate" min={0.1} max={30} value={rate} onChange={(v) => updateAnnuity({ payoutRate: v })} />
            </div>
            <p className="pb-2 text-xs text-slate-500">
              {a.payoutRate === null ? (
                <>
                  {a.purchaseAge > 0 ? `Estimated for age ${a.purchaseAge}` : 'Enter an age for an estimate'}
                  {plan.filingStatus === 'married' ? ', joint life' : ''}. Type a real quote to override.
                </>
              ) : (
                <>
                  Your quote (estimate: {(estimate * 100).toFixed(1)}%).{' '}
                  <button type="button" className="underline" onClick={() => updateAnnuity({ payoutRate: null })}>
                    Use estimate
                  </button>
                </>
              )}
            </p>
          </div>

          {a.purchaseAge > 0 && a.amount > 0 && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
              ≈ <strong className="tabular-nums">{formatUSD(yearly)}/yr</strong> ({formatUSD(yearly / 12)}/mo) for life from age{' '}
              {a.purchaseAge}, in today's dollars
              {a.inflationAdjusted ? ', keeping its buying power.' : '. The payment is fixed, so its buying power shrinks with inflation.'}
            </p>
          )}
          <p className="text-xs text-slate-500">
            The money leaves your savings for good: payments stop at death and nothing is left to heirs (no
            cash-refund or period-certain options modeled). Payouts vary by insurer, sex, health and interest rates; get
            real quotes before deciding.
          </p>
        </div>
      )}
    </div>
  )
}
