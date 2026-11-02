import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './Icons'

/** The free calculator pages (paths relative to the planner, which sits at the site root) */
const CALCULATORS: { path: string; name: string; blurb: string; icon: IconName; isNew?: boolean }[] = [
  { path: 'how-long-will-my-money-last/', name: 'How long will my money last?', blurb: 'The age your savings could run out', icon: 'trend' },
  { path: '4-percent-rule-calculator/', name: '4% rule calculator', blurb: 'A safe withdrawal rate for your savings', icon: 'percent', isNew: true },
  { path: 'social-security-claiming-age/', name: 'Social Security claiming age', blurb: 'Claim at 62, 67 or 70? Break-even ages', icon: 'landmark', isNew: true },
  { path: 'kids-investment-account-calculator/', name: 'Kids’ investment account', blurb: 'Grow the new federal children’s account', icon: 'sprout', isNew: true },
  { path: 'roth-conversion-calculator/', name: 'Roth conversion calculator', blurb: 'Tax now vs later on a conversion', icon: 'wallet' },
  { path: 'rmd-calculator/', name: 'RMD calculator', blurb: 'Required minimum distributions by year', icon: 'calendar' },
]

const NewBadge = () => (
  <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-900 dark:text-amber-100">
    New
  </span>
)

/**
 * "Free calculators" button in the header, opening a list of the calculator pages. It glows a few times on load to be
 * noticed, then stays still (no animation at all when the visitor prefers reduced motion).
 */
export function CalculatorsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="calculators-menu"
        onClick={() => setOpen((o) => !o)}
        className="attention inline-flex items-center gap-1.5 rounded-md border border-teal-600 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100 dark:hover:bg-teal-900"
      >
        <Icon name="calculator" size={15} />
        Free calculators
        <NewBadge />
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          id="calculators-menu"
          className="absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] sm:right-0 sm:left-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <ul>
            {CALCULATORS.map((c) => (
              <li key={c.path}>
                <a href={c.path} className="flex items-start gap-3 rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                    <Icon name={c.icon} size={16} />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {c.name}
                      {c.isNew && <NewBadge />}
                    </span>
                    <span className="block text-xs text-muted">{c.blurb}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The calculators as a grid of cards (the planner's footer) */
export function CalculatorGrid() {
  return (
    <nav aria-label="Free calculators">
      <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
        <Icon name="calculator" size={16} className="text-teal-700 dark:text-teal-400" />
        Free calculators
      </h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((c) => (
          <li key={c.path}>
            <a
              href={c.path}
              className="flex h-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-400"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Icon name={c.icon} size={16} />
              </span>
              <span>
                <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  {c.name}
                  {c.isNew && <NewBadge />}
                </span>
                <span className="block text-xs text-muted">{c.blurb}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
