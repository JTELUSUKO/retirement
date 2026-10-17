import type { ReactNode } from 'react'
import type { MonteCarloResult } from '../engine'
import { formatUSDCompact } from '../utils/format'

interface Props {
  title: string
  description: ReactNode
  /** Final age label, e.g. "95" or "100 (spouse 95)" */
  endAge: string
  /** Column labels, e.g. "Without" / "With annuity" */
  baseLabel: string
  changedLabel: string
  base: MonteCarloResult
  changed: MonteCarloResult
}

function compare(changed: number, base: number): 'changed' | 'base' | null {
  const diff = changed - base
  if (Math.abs(diff) < Math.max(Math.abs(base) * 0.005, 0.005)) return null
  return diff > 0 ? 'changed' : 'base'
}

/** Two simulations side by side: chance the money lasts and savings left, with the better value in bold. */
export function OutcomeComparison({ title, description, endAge, baseLabel, changedLabel, base, changed }: Props) {
  const last = (mc: MonteCarloResult) => mc.years.at(-1)!
  const rows = [
    {
      label: `Chance money lasts to ${endAge}`,
      base: `${Math.round(base.successRate * 100)}%`,
      changed: `${Math.round(changed.successRate * 100)}%`,
      better: compare(changed.successRate, base.successRate),
    },
    {
      label: `Savings left at ${endAge}, typical markets`,
      base: formatUSDCompact(last(base).p50),
      changed: formatUSDCompact(last(changed).p50),
      better: compare(last(changed).p50, last(base).p50),
    },
    {
      label: `Savings left at ${endAge}, poor markets (10th)`,
      base: formatUSDCompact(last(base).p10),
      changed: formatUSDCompact(last(changed).p10),
      better: compare(last(changed).p10, last(base).p10),
    },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
      <table className="mt-3 w-full text-sm tabular-nums">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 text-left font-normal" />
            <th className="py-1 text-right font-normal">{baseLabel}</th>
            <th className="py-1 text-right font-normal">{changedLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5">{r.label}</td>
              <td className={`py-1.5 text-right ${r.better === 'base' ? 'font-semibold' : ''}`}>{r.base}</td>
              <td className={`py-1.5 text-right ${r.better === 'changed' ? 'font-semibold' : ''}`}>
                {r.changed} {r.better === 'changed' ? '▲' : r.better === 'base' ? '▼' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
