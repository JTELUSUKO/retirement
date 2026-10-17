import { Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PercentileYear } from '../engine'
import { formatUSD, formatUSDCompact } from '../utils/format'

interface Props {
  years: PercentileYear[]
  retirementAge: number
}

interface TooltipProps {
  active?: boolean
  label?: number
  payload?: { payload: PercentileYear }[]
}

function ChartTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const y = payload[0].payload
  const rows: [string, number][] = [
    ['Good markets (90th)', y.p90],
    ['Typical (median)', y.p50],
    ['Poor markets (10th)', y.p10],
  ]
  return (
    <div className="rounded-lg border border-[var(--chart-grid)] bg-[var(--chart-tooltip-bg)] px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-medium">Age {label}</div>
      {rows.map(([name, value]) => (
        <div key={name} className="flex justify-between gap-6 tabular-nums">
          <span className="text-slate-500">{name}</span>
          <span>{formatUSD(value)}</span>
        </div>
      ))}
    </div>
  )
}

export function ProbabilityChart({ years, retirementAge }: Props) {
  const data = years.map((y) => ({ ...y, outer: [y.p10, y.p90], inner: [y.p25, y.p75] }))

  return (
    <div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-ink)', fontSize: 12 }} />
            <YAxis
              tickFormatter={formatUSDCompact}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: 'var(--chart-ink)', fontSize: 12 }}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--chart-ink)', strokeDasharray: '3 3' }} />
            <ReferenceLine
              x={retirementAge}
              stroke="var(--chart-ink)"
              strokeDasharray="4 4"
              label={{ value: 'Retire', position: 'insideTopRight', fill: 'var(--chart-ink)', fontSize: 12 }}
            />
            <Area dataKey="outer" stroke="none" fill="var(--chart-series)" fillOpacity={0.12} isAnimationActive={false} activeDot={false} />
            <Area dataKey="inner" stroke="none" fill="var(--chart-series)" fillOpacity={0.2} isAnimationActive={false} activeDot={false} />
            <Line
              dataKey="p50"
              stroke="var(--chart-series)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 5, stroke: 'var(--chart-tooltip-bg)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--chart-series)]" /> Median outcome
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-[var(--chart-series)] opacity-35" /> Middle 50% of outcomes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-[var(--chart-series)] opacity-15" /> 10th–90th percentile
        </span>
      </div>
    </div>
  )
}
