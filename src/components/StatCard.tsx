import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icons'
import { InfoTip } from './InfoTip'

interface Props {
  label: string
  /** Explanation shown in an ⓘ tip next to the label */
  info?: ReactNode
  value: string
  detail?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
  icon?: IconName
}

const iconTone = {
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const toneClass = {
  default: '',
  good: 'border-l-4 border-l-emerald-600 dark:border-l-emerald-500',
  warn: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
  bad: 'border-l-4 border-l-red-600 dark:border-l-red-500',
}

export function StatCard({ label, value, detail, tone = 'default', info, icon }: Props) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${toneClass[tone]}`}>
      <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
        {icon && (
          <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconTone[tone]}`}>
            <Icon name={icon} size={15} />
          </span>
        )}
        <span className={icon ? 'pt-1' : undefined}>
          {label}
          {info && <InfoTip label={label}>{info}</InfoTip>}
        </span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted">{detail}</div>}
    </div>
  )
}
