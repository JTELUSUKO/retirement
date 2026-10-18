import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'

interface Props {
  label: string
  /** Explanation shown in an ⓘ tip next to the label */
  info?: ReactNode
  value: string
  detail?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}

const toneClass = {
  default: '',
  good: 'border-l-4 border-l-emerald-600 dark:border-l-emerald-500',
  warn: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
  bad: 'border-l-4 border-l-red-600 dark:border-l-red-500',
}

export function StatCard({ label, value, detail, tone = 'default', info }: Props) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${toneClass[tone]}`}>
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {label}
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </div>
  )
}
