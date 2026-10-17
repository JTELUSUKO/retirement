import { useSyncExternalStore } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { scenarioColor } from '../utils/buckets'
import { formatUSD, formatUSDCompact } from '../utils/format'

export interface ScenarioSeries {
  key: string
  name: string
  /** Color slot: 0 = your plan, 1–3 = scenarios (fixed per scenario). */
  slot: number
  /** Median start-of-year balance (today's $) by age */
  values: { age: number; value: number }[]
}

interface Props {
  series: ScenarioSeries[]
  retirementAges: number[]
}

// Fixed geometry so the HTML end labels line up with the plot area
const HEIGHT = 300
const LABEL_WIDTH = 132
const MARGIN = { top: 16, right: LABEL_WIDTH, bottom: 0, left: 8 }

// On narrow screens the end labels would squeeze the plot; the legend below names the lines instead.
const wide = window.matchMedia('(min-width: 640px)')
const subscribe = (cb: () => void) => {
  wide.addEventListener('change', cb)
  return () => wide.removeEventListener('change', cb)
}
const useWide = () => useSyncExternalStore(subscribe, () => wide.matches)
const X_AXIS_HEIGHT = 24
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom - X_AXIS_HEIGHT
const LABEL_GAP = 30

/** Round up to 1, 2, 2.5 or 5 × a power of ten. */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((n) => n >= v)!
}

/** Place end labels at their line's y, pushed apart so none overlap, kept inside the plot. */
function placeLabels(ends: { key: string; y: number }[]): Record<string, number> {
  const sorted = [...ends].sort((a, b) => a.y - b.y)
  const ys = sorted.map((e) => e.y)
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + LABEL_GAP)
  const bottom = MARGIN.top + PLOT_HEIGHT
  const overflow = ys.at(-1)! - bottom
  if (overflow > 0) for (let i = 0; i < ys.length; i++) ys[i] -= overflow
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + LABEL_GAP)
  return Object.fromEntries(sorted.map((e, i) => [e.key, ys[i]]))
}

/** Median savings by age for your plan and each scenario, with labels at the line ends. */
export function ScenarioChart({ series, retirementAges }: Props) {
  const showLabels = useWide()
  const margin = showLabels ? MARGIN : { ...MARGIN, right: 16 }
  const ages = series[0]?.values.map((v) => v.age) ?? []
  const data = ages.map((age, i) => Object.fromEntries([['age', age], ...series.map((s) => [s.key, s.values[i].value])]))
  const max = niceMax(Math.max(...series.flatMap((s) => s.values.map((v) => v.value))))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const yOf = (v: number) => MARGIN.top + (1 - v / max) * PLOT_HEIGHT
  const labelY = placeLabels(series.map((s) => ({ key: s.key, y: yOf(s.values.at(-1)!.value) })))
  const uniqueRetire = [...new Set(retirementAges)]

  return (
    <div className="relative w-full" style={{ height: HEIGHT }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={margin}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="age" height={X_AXIS_HEIGHT} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-ink)', fontSize: 12 }} />
          <YAxis
            domain={[0, max]}
            ticks={ticks}
            tickFormatter={formatUSDCompact}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: 'var(--chart-ink)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-ink)', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--chart-grid)',
              borderRadius: 8,
              color: 'var(--chart-text)',
            }}
            labelFormatter={(age) => `Age ${age}`}
            formatter={(v, key) => [formatUSD(Number(v)), series.find((s) => s.key === key)?.name ?? String(key)]}
          />
          {uniqueRetire.map((age) => (
            <ReferenceLine key={age} x={age} stroke="var(--chart-ink)" strokeDasharray="4 4" strokeOpacity={0.6} />
          ))}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={scenarioColor(s.slot)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 5, stroke: 'var(--chart-tooltip-bg)', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Direct labels at the line ends (text in ink; a color tick ties each to its line) */}
      {showLabels && series.map((s) => (
        <div
          key={s.key}
          className="pointer-events-none absolute flex -translate-y-1/2 items-start gap-1.5 text-xs leading-tight"
          style={{ top: labelY[s.key], right: 0, width: LABEL_WIDTH - 12 }}
        >
          <span className="mt-1.5 h-0.5 w-3 shrink-0" style={{ background: scenarioColor(s.slot) }} />
          <span>
            <span className="block truncate text-slate-700 dark:text-slate-300">{s.name}</span>
            <span className="tabular-nums text-slate-500">{formatUSDCompact(s.values.at(-1)!.value)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
