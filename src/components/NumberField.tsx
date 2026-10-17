interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  step?: number
  min?: number
  max?: number
}

export function NumberField({ label, value, onChange, prefix, suffix, step = 1, min, max }: Props) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-teal-600 dark:border-slate-700 dark:bg-slate-900">
        {prefix && <span className="pl-3 text-slate-500">{prefix}</span>}
        <input
          type="number"
          className="w-full bg-transparent px-3 py-2 outline-none"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.valueAsNumber || 0)}
        />
        {suffix && <span className="pr-3 text-slate-500">{suffix}</span>}
      </div>
    </label>
  )
}

/** Same as NumberField but shows a fraction (0.07) as a percent (7). */
export function PercentField({ label, value, onChange }: Omit<Props, 'prefix' | 'suffix'>) {
  return (
    <NumberField
      label={label}
      value={Math.round(value * 1000) / 10}
      onChange={(v) => onChange(v / 100)}
      suffix="%"
      step={0.1}
    />
  )
}
