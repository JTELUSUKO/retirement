import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BUCKETS, type TaxBucket, type YearResult } from '../engine'
import { BUCKET_COLOR, BUCKET_LABEL } from '../utils/buckets'
import { formatUSD, formatUSDCompact } from '../utils/format'

interface Props {
  years: YearResult[]
  retirementAge: number
  rmdStartAge: number
}

interface TooltipProps {
  active?: boolean
  label?: number
  payload?: { payload: YearResult }[]
  buckets: TaxBucket[]
}

function ChartTooltip({ active, label, payload, buckets }: TooltipProps) {
  if (!active || !payload?.length) return null
  const y = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--chart-grid)] bg-[var(--chart-tooltip-bg)] px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-medium">Age {label}</div>
      {[...buckets].reverse().map((b) => (
        <div key={b} className="flex items-center justify-between gap-6 tabular-nums">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLOR[b] }} />
            {BUCKET_LABEL[b]}
          </span>
          <span>{formatUSD(y.startByBucketReal[b])}</span>
        </div>
      ))}
      {y.rmd > 0 && (
        <div className="mt-1 border-t border-[var(--chart-grid)] pt-1 text-slate-500">
          RMD this year: {formatUSD(y.rmd)}
        </div>
      )}
    </div>
  )
}

/** Stacked balance by tax bucket (average returns). Colors are fixed per bucket. */
export function BucketChart({ years, retirementAge, rmdStartAge }: Props) {
  // Only show buckets that ever hold money; colors stay tied to the bucket, not its position.
  const buckets = BUCKETS.filter((b) => years.some((y) => y.startByBucketReal[b] > 0.5))

  return (
    <div>
      <div className="h-72 w-full">
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
            <Tooltip content={<ChartTooltip buckets={buckets} />} cursor={{ stroke: 'var(--chart-ink)', strokeDasharray: '3 3' }} />
            <ReferenceLine
              x={retirementAge}
              stroke="var(--chart-ink)"
              strokeDasharray="4 4"
              label={{ value: 'Retire', position: 'insideTopRight', fill: 'var(--chart-ink)', fontSize: 12 }}
            />
            {rmdStartAge <= years.at(-1)!.age && (
              <ReferenceLine
                x={rmdStartAge}
                stroke="var(--chart-ink)"
                strokeDasharray="2 4"
                label={{ value: 'RMDs', position: 'insideTopRight', fill: 'var(--chart-ink)', fontSize: 12 }}
              />
            )}
            {buckets.map((b) => (
              <Area
                key={b}
                type="monotone"
                dataKey={(y: YearResult) => y.startByBucketReal[b]}
                name={BUCKET_LABEL[b]}
                stackId="balance"
                stroke="var(--chart-tooltip-bg)"
                strokeWidth={2}
                fill={BUCKET_COLOR[b]}
                fillOpacity={0.9}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        {buckets.map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: BUCKET_COLOR[b] }} />
            {BUCKET_LABEL[b]}
          </span>
        ))}
      </div>
    </div>
  )
}
