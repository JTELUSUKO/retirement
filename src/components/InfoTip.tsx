import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const WIDTH = 256
const MARGIN = 8

/**
 * A small ⓘ button that shows an explanation on hover, keyboard focus or tap, and closes with Esc or a click
 * elsewhere. The text is linked to the button for screen readers.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Place the tip under the icon, kept inside the screen (icons near an edge would otherwise push it off)
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, MARGIN), window.innerWidth - width - MARGIN)
    setPosition({ left, top: r.bottom + 6 })
  }, [open])

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
    <span ref={ref} className="relative inline-block align-middle" onMouseLeave={() => setOpen(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault() // inside a <label>: don't focus the input
          setOpen((o) => !o)
        }}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] leading-none font-semibold text-slate-500 hover:border-teal-600 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-slate-500 dark:text-slate-400"
      >
        i
      </button>
      {open && position && (
        <span
          id={id}
          role="tooltip"
          style={{ left: position.left, top: position.top, width: Math.min(WIDTH, window.innerWidth - 2 * MARGIN) }}
          className="fixed z-30 block rounded-md border border-slate-200 bg-white p-3 text-xs leading-relaxed font-normal tracking-normal text-slate-700 normal-case shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {children}
        </span>
      )}
    </span>
  )
}
