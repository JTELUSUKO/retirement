import type { Plan, ProjectionResult } from '../engine'
import { watchOuts, type WatchOut } from '../utils/watchOuts'
import { InfoTip } from './InfoTip'

/** Tax and Medicare points in the typical-returns projection worth a look (nothing shown when there are none). */
export function WatchOuts({ plan, result }: { plan: Plan; result: ProjectionResult }) {
  const items = watchOuts(plan, result)
  if (items.length === 0) return null
  return (
    <section aria-labelledby="watch-outs-heading" className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="watch-outs-heading" className="font-medium">
        Watch-outs
        <InfoTip label="Watch-outs">
          Points in your plan worth a look, from the typical-returns path (median return every year). Federal brackets
          are for ordinary income such as pre-tax withdrawals and pensions. Educational only, not tax advice.
        </InfoTip>
      </h2>
      <WatchOutList items={items} className="mt-2 space-y-2" />
    </section>
  )
}

/** The watch-outs as a list (also used by the printable summary, which is always light: `paper`). */
export function WatchOutList({ items, className = '', paper = false }: { items: WatchOut[]; className?: string; paper?: boolean }) {
  const colour = {
    warn: paper ? 'text-amber-800' : 'text-amber-700 dark:text-amber-400',
    info: paper ? 'text-teal-700' : 'text-teal-700 dark:text-teal-400',
  }
  return (
    <ul className={`text-sm ${className}`}>
      {items.map((w) => (
        <li key={w.key} className="flex gap-2">
          {/* Text style, not emoji, so they take the colour */}
          <span aria-hidden="true" className={colour[w.tone]}>
            {w.tone === 'warn' ? '\u26A0\uFE0E' : '\u2139\uFE0E'}
          </span>
          <span>{w.text}</span>
        </li>
      ))}
    </ul>
  )
}
