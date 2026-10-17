import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { YearResult } from '../engine'
import { formatUSD, formatUSDCompact } from '../utils/format'

interface Props {
  years: YearResult[]
  retirementAge: number
}

export function BalanceChart({ years, retirementAge }: Props) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <AreaChart data={years} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-ink)', fontSize: 12 }} />
          <YAxis
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
            formatter={(v) => [formatUSD(Number(v)), "Balance (today's $)"]}
          />
          <ReferenceLine
            x={retirementAge}
            stroke="var(--chart-ink)"
            strokeDasharray="4 4"
            label={{ value: 'Retire', position: 'insideTopRight', fill: 'var(--chart-ink)', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="balanceReal"
            stroke="var(--chart-series)"
            strokeWidth={2}
            fill="var(--chart-series)"
            isAnimationActive={false}
            fillOpacity={0.12}
            activeDot={{ r: 5, stroke: 'var(--chart-tooltip-bg)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
