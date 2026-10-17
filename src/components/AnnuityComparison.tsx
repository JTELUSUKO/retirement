import { payoutRate, type MonteCarloResult, type Plan } from '../engine'
import { formatUSD, formatUSDCompact } from '../utils/format'

interface Props {
  plan: Plan
  withAnnuity: MonteCarloResult
  withoutAnnuity: MonteCarloResult
}

/** Side-by-side: success rate and money left, with and without the annuity purchase. */
export function AnnuityComparison({ plan, withAnnuity, withoutAnnuity }: Props) {
  const a = plan.annuityPurchase
  const last = (mc: MonteCarloResult) => mc.years.at(-1)!
  const rows: { label: string; without: string; with: string; better: 'with' | 'without' | null }[] = [
    {
      label: `Chance money lasts to ${plan.lifeExpectancy}`,
      without: `${Math.round(withoutAnnuity.successRate * 100)}%`,
      with: `${Math.round(withAnnuity.successRate * 100)}%`,
      better: compare(withAnnuity.successRate, withoutAnnuity.successRate),
    },
    {
      label: `Savings left at ${plan.lifeExpectancy}, typical markets`,
      without: formatUSDCompact(last(withoutAnnuity).p50),
      with: formatUSDCompact(last(withAnnuity).p50),
      better: compare(last(withAnnuity).p50, last(withoutAnnuity).p50),
    },
    {
      label: `Savings left at ${plan.lifeExpectancy}, poor markets (10th)`,
      without: formatUSDCompact(last(withoutAnnuity).p10),
      with: formatUSDCompact(last(withAnnuity).p10),
      better: compare(last(withAnnuity).p10, last(withoutAnnuity).p10),
    },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-medium">Annuity: with vs. without</h2>
      <p className="text-sm text-slate-500">
        Buying {formatUSDCompact(a.amount)} at {a.purchaseAge} for about{' '}
        {formatUSD(a.amount * payoutRate(a, plan.filingStatus))}/yr for life (today's dollars). Savings left are in
        today's dollars; the annuity itself is worth nothing to heirs.
      </p>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 text-left font-normal" />
            <th className="py-1 text-right font-normal">Without</th>
            <th className="py-1 text-right font-normal">With annuity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5">{r.label}</td>
              <td className={`py-1.5 text-right ${r.better === 'without' ? 'font-semibold' : ''}`}>{r.without}</td>
              <td className={`py-1.5 text-right ${r.better === 'with' ? 'font-semibold' : ''}`}>
                {r.with} {r.better === 'with' ? '▲' : r.better === 'without' ? '▼' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function compare(withValue: number, withoutValue: number): 'with' | 'without' | null {
  const diff = withValue - withoutValue
  if (Math.abs(diff) < Math.max(Math.abs(withoutValue) * 0.005, 0.005)) return null
  return diff > 0 ? 'with' : 'without'
}
