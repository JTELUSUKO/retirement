import { useState } from 'react'
import type { PercentileYear, YearResult } from '../engine'
import { formatUSD } from '../utils/format'

interface Props {
  averageYears: YearResult[]
  simulatedYears: PercentileYear[]
}

type View = 'average' | 'simulated'

const th = 'px-2 py-1 font-normal'
const td = 'px-2 py-1'

export function YearTable({ averageYears, simulatedYears }: Props) {
  const [view, setView] = useState<View>('average')

  const tab = (value: View, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === value}
      onClick={() => setView(value)}
      className={`rounded-md px-3 py-1 text-sm ${
        view === value
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div role="tablist" className="mt-3 flex gap-1">
        {tab('average', 'Average returns')}
        {tab('simulated', 'Simulation range')}
      </div>
      <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full text-right text-sm tabular-nums">
          {view === 'average' ? (
            <>
              <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={`${th} text-left`}>Age</th>
                  <th className={th}>Start balance (today's $)</th>
                  <th className={th}>Contributions</th>
                  <th className={th}>Withdrawal</th>
                  <th className={th}>Income</th>
                  <th className={th}>End balance</th>
                </tr>
              </thead>
              <tbody>
                {averageYears.map((y) => (
                  <tr key={y.age} className="border-t border-slate-100 dark:border-slate-800">
                    <td className={`${td} text-left`}>{y.age}</td>
                    <td className={td}>{formatUSD(y.startBalanceReal)}</td>
                    <td className={td}>{formatUSD(y.contributions)}</td>
                    <td className={td}>{formatUSD(y.withdrawal)}</td>
                    <td className={td}>{formatUSD(y.income)}</td>
                    <td className={td}>{formatUSD(y.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className={`${th} text-left`}>Age</th>
                  <th className={th}>Poor (10th)</th>
                  <th className={th}>25th</th>
                  <th className={th}>Median</th>
                  <th className={th}>75th</th>
                  <th className={th}>Good (90th)</th>
                </tr>
              </thead>
              <tbody>
                {simulatedYears.map((y) => (
                  <tr key={y.age} className="border-t border-slate-100 dark:border-slate-800">
                    <td className={`${td} text-left`}>{y.age}</td>
                    <td className={td}>{formatUSD(y.p10)}</td>
                    <td className={td}>{formatUSD(y.p25)}</td>
                    <td className={td}>{formatUSD(y.p50)}</td>
                    <td className={td}>{formatUSD(y.p75)}</td>
                    <td className={td}>{formatUSD(y.p90)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {view === 'average'
          ? 'Start balance is in today’s dollars; other columns are in future dollars for that year.'
          : 'Start-of-year balance in today’s dollars across 1,000 simulated markets.'}
      </p>
    </div>
  )
}
