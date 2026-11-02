import { useId, useMemo, useRef, useState } from 'react'
import { NO_INCOME_TAX_STATES } from '../engine'
import { ALL_STATES, matchStates, type StateOption as Option } from '../utils/states'

const nameOf = (code: string) => ALL_STATES.find(([c]) => c === code)?.[1] ?? ''

/**
 * Pick a state by typing part of its name (or its two-letter code) and choosing from the filtered list, or by
 * opening the list and scrolling. `emptyLabel` is the "no state" choice ('' value), e.g. "Not sure yet".
 * Leaving the field picks the only match, or the state whose name or code was typed in full; otherwise it goes back.
 */
export function StateSelect({ label, value, onChange, emptyLabel }: {
  label: string
  value: string
  onChange: (code: string) => void
  emptyLabel: string
}) {
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState<string | null>(null) // null = not typing: the field shows the chosen state
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const typing = query !== null
  const matches = useMemo(() => matchStates(query ?? ''), [query])
  // The "no state" choice leads the full list (not while filtering)
  const options: Option[] = query !== null && query.trim() ? matches : [{ code: '', name: emptyLabel }, ...matches]

  const choose = (code: string) => {
    if (code !== value) onChange(code)
    setQuery(null)
    setOpen(false)
  }
  const show = (index: number) => {
    setActive(index)
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }
  const openAt = (code: string) => {
    setOpen(true)
    setActive(Math.max(0, options.findIndex((o) => o.code === code)))
  }

  const settle = () => {
    if (query === null) return setOpen(false)
    const q = query.trim().toLowerCase()
    if (!q) return choose('')
    const exact = ALL_STATES.find(([code, name]) => name.toLowerCase() === q || code.toLowerCase() === q)
    if (exact) return choose(exact[0])
    if (matches.length === 1) return choose(matches[0].code)
    setQuery(null)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-sm text-slate-600 dark:text-slate-400">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-${options[active].code || 'none'}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type to search, e.g. Texas or TX"
          className="w-full rounded-md border border-slate-500 bg-white py-2 pr-9 pl-3 text-sm placeholder:text-slate-500 dark:border-slate-500 dark:bg-slate-900 dark:placeholder:text-slate-400"
          value={typing ? query : value ? nameOf(value) : ''}
          onFocus={(e) => e.target.select()}
          onClick={() => !open && openAt(value)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onBlur={settle}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              if (!open) return openAt(value)
              const next = e.key === 'ArrowDown' ? Math.min(active + 1, options.length - 1) : Math.max(active - 1, 0)
              show(next)
            } else if (e.key === 'Enter') {
              if (open && options[active]) {
                e.preventDefault()
                choose(options[active].code)
              }
            } else if (e.key === 'Escape' && (open || typing)) {
              e.preventDefault()
              setQuery(null)
              setOpen(false)
            }
          }}
        />
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition-transform dark:text-slate-400 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.length === 0 && <li className="px-3 py-2 text-muted">No state matches “{query}”</li>}
          {options.map((o, i) => (
            <li
              key={o.code || 'none'}
              id={`${id}-${o.code || 'none'}`}
              role="option"
              aria-selected={o.code === value}
              // Keep focus in the field, so the click lands before the field's blur
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.code)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 ${i === active ? 'bg-teal-50 dark:bg-teal-950' : ''} ${o.code ? '' : 'text-muted'}`}
            >
              {/* States with no income tax stand out in green, with a badge (words too, not just colour) */}
              {NO_INCOME_TAX_STATES[o.code] ? (
                <span className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                  {o.name}
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                    No income tax
                  </span>
                </span>
              ) : (
                <span>{o.name}</span>
              )}
              {o.code === value && (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="text-teal-700 dark:text-teal-300">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
