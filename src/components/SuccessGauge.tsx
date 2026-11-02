import { useEffect, useRef, useState } from 'react'
import { verdictFor } from '../utils/levers'

// Half-circle dial for the chance the money lasts. The arc is drawn left (0%) to right (100%) around (100, 100).
const R = 80
const ARC = `M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`

/** Point on the arc for a share 0–1 */
const at = (share: number, radius = R) => {
  const angle = Math.PI * (1 - share)
  return { x: 100 + radius * Math.cos(angle), y: 100 - radius * Math.sin(angle) }
}

const TONE = {
  strong: 'text-teal-600 dark:text-teal-400',
  borderline: 'text-amber-500 dark:text-amber-400',
  'at-risk': 'text-red-600 dark:text-red-500',
}
const NOTE = { strong: '✓ Strong', borderline: '⚠ Borderline', 'at-risk': '✕ At risk' }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Counts from the last shown value to `target` (straight to it when the user prefers less motion). */
function useCountUp(target: number, ms = 450) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const still = reducedMotion()
  useEffect(() => {
    if (still) {
      from.current = target
      return
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const step = (now: number) => {
      const t = Math.min((now - start) / ms, 1)
      const value = Math.round(begin + (target - begin) * (1 - (1 - t) ** 3))
      from.current = value
      setShown(value)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, ms, still])
  return still ? target : shown
}

/**
 * The success rate as a dial, coloured by verdict, with ticks at 70% and 85% (where the verdict changes).
 * `baseline` adds a marker for the rate it's being compared with.
 */
export function SuccessGauge({ rate, baseline, label, pending }: { rate: number; baseline?: number; label: string; pending?: boolean }) {
  const pct = Math.round(rate * 100)
  const verdict = verdictFor(rate)
  const shown = useCountUp(pct)
  const knob = at(pct / 100)

  return (
    <figure className="flex flex-col items-center" role="img" aria-label={`${label}: ${pct}%, ${NOTE[verdict].slice(2).toLowerCase()}`}>
      <svg viewBox="0 0 200 116" className="w-full max-w-60">
        <path d={ARC} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-slate-200 dark:stroke-slate-800" />
        <path
          d={ARC}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(pct, 0.5)} 100`}
          stroke="currentColor"
          className={`${TONE[verdict]} transition-[stroke-dasharray,color] duration-500 ease-out motion-reduce:transition-none`}
        />
        {[0.7, 0.85].map((share) => {
          const a = at(share, R - 11)
          const b = at(share, R + 11)
          return <line key={share} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="2" className="stroke-white dark:stroke-slate-900" />
        })}
        {baseline !== undefined && Math.round(baseline * 100) !== pct && (
          <circle cx={at(baseline).x} cy={at(baseline).y} r="4" strokeWidth="2" className="fill-white stroke-slate-500 dark:fill-slate-900 dark:stroke-slate-400" />
        )}
        <circle
          cx={knob.x}
          cy={knob.y}
          r="9"
          strokeWidth="3"
          stroke="currentColor"
          className={`fill-white dark:fill-slate-900 ${TONE[verdict]} transition-[cx,cy] duration-500 ease-out motion-reduce:transition-none`}
        />
        <text x="100" y="92" textAnchor="middle" className="fill-slate-900 text-[34px] font-semibold tabular-nums dark:fill-slate-100">
          {shown}%
        </text>
        <text x={100 - R} y="114" textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">
          0
        </text>
        <text x={100 + R} y="114" textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">
          100
        </text>
      </svg>
      <figcaption className={`-mt-1 text-sm font-medium ${TONE[verdict]}`}>{pending ? 'Updating…' : NOTE[verdict]}</figcaption>
    </figure>
  )
}
