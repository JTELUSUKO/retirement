import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { SCROLL_REGION } from './styles'

/**
 * A box that may scroll (wide or long tables). While its content overflows it is a focusable, labelled region, so
 * keyboard users can scroll it; when everything fits it isn't, so short tables don't add a tab stop that does nothing.
 */
export function ScrollRegion({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const check = () => setScrolls(box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1)
    check()
    // The box and its table change size with the window and with the rows shown
    const observer = new ResizeObserver(check)
    observer.observe(box)
    for (const child of box.children) observer.observe(child)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`${className} ${SCROLL_REGION}`} {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}>
      {children}
    </div>
  )
}
