import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUiPrefs } from '../store/uiPrefs'
import { CALCULATORS } from '../utils/calculators'
import { Icon } from './Icons'

const MENU_WIDTH = 352
const MARGIN = 8

const NewBadge = () => (
  <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-900 dark:text-amber-100">
    New
  </span>
)

/** One calculator: icon, name (with a New badge) and a one-line description */
function Entry({ calculator: c, onClick, className }: { calculator: (typeof CALCULATORS)[number]; onClick?: () => void; className: string }) {
  return (
    <a href={c.path} onClick={onClick} className={`flex items-start gap-3 ${className}`}>
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
  )
}

/**
 * "Free calculators" button in the header, opening a list of the calculator pages. Until it's first opened it glows a
 * few times on each load to be noticed, then stays still (no animation at all when the visitor prefers reduced motion).
 * Closes on Esc (focus back on the button), a tap or click outside, tabbing away, or following a link.
 */
export function CalculatorsMenu() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)
  const seen = useUiPrefs((s) => s.calculatorsSeen)
  const setSeen = useUiPrefs((s) => s.setCalculatorsSeen)
  const ref = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    if (!open) setSeen()
    setOpen(!open)
  }

  // Under the button, right-aligned with it where there's room, and always inside the screen
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = button.current!.getBoundingClientRect()
      const width = Math.min(MENU_WIDTH, window.innerWidth - 2 * MARGIN)
      const left = Math.min(Math.max(r.right - width, MARGIN), window.innerWidth - width - MARGIN)
      setPosition({ left, top: r.bottom + 8, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, { passive: true })
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // pointerdown: iPhones don't send mousedown for taps on plain text
    const onPointer = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    // Page-wide (Safari doesn't focus a clicked button), skipping an Esc another field already used (e.g. a list)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const inside = ref.current?.contains(document.activeElement)
      setOpen(false)
      if (inside) button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Coming back with Back can restore the page as it was left (menu open): start closed
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setOpen(false)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  return (
    <div
      ref={ref}
      className="relative"
      // Tabbing out of the button and the list closes it
      onBlur={(e) => open && !ref.current?.contains(e.relatedTarget as Node | null) && e.relatedTarget && setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? 'calculators-menu' : undefined}
        onClick={toggle}
        className={`${seen ? '' : 'attention'} inline-flex items-center gap-1.5 rounded-md border border-teal-600 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100 dark:hover:bg-teal-900`}
      >
        <Icon name="calculator" size={15} />
        Free calculators
        {CALCULATORS.some((c) => c.isNew) && <NewBadge />}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && position && (
        <div
          id="calculators-menu"
          style={position}
          className="fixed z-30 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <ul>
            {CALCULATORS.map((c) => (
              <li key={c.path}>
                <Entry calculator={c} onClick={() => setOpen(false)} className="rounded-md p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" />
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
            <Entry
              calculator={c}
              className="h-full rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-400"
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}
