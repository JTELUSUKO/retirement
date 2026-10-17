import { useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  step?: number
  min?: number
  max?: number
  /** Message from plan validation (e.g. "must be later than retirement age"). */
  error?: string
}

/**
 * Number input that keeps whatever you are typing and only updates the plan
 * once the text is a valid number within [min, max]. On blur it shows the
 * last valid value again, so a cleared field never feeds 0 into the plan.
 */
export function NumberField({ label, value, onChange, prefix, suffix, step = 1, min, max, error }: Props) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)

  const parse = (raw: string) => {
    const n = Number(raw)
    const valid = raw.trim() !== '' && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
    return valid ? n : null
  }
  const typingInvalid = editing && parse(text) === null
  const invalid = typingInvalid || Boolean(error)
  const rangeHint =
    min !== undefined && max !== undefined ? `Enter ${min}–${max}` : min !== undefined ? `Minimum ${min}` : 'Enter a number'

  return (
    <label className="block text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <div
        className={`mt-1 flex items-center rounded-md border bg-white focus-within:ring-2 dark:bg-slate-900 ${
          invalid
            ? 'border-red-500 focus-within:ring-red-500'
            : 'border-slate-300 focus-within:ring-teal-600 dark:border-slate-700'
        }`}
      >
        {prefix && <span className="pl-3 text-slate-500">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          className="w-full bg-transparent px-3 py-2 outline-none"
          value={editing ? text : String(value)}
          step={step}
          min={min}
          max={max}
          aria-invalid={invalid}
          onFocus={() => {
            setText(String(value))
            setEditing(true)
          }}
          onBlur={() => setEditing(false)}
          onChange={(e) => {
            setText(e.target.value)
            const n = parse(e.target.value)
            if (n !== null) onChange(n)
          }}
        />
        {suffix && <span className="pr-3 text-slate-500">{suffix}</span>}
      </div>
      {typingInvalid ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{rangeHint}</span>
      ) : (
        error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </label>
  )
}

/** Same as NumberField but shows a fraction (0.07) as a percent (7). */
export function PercentField({ label, value, onChange, min, max }: Omit<Props, 'prefix' | 'suffix' | 'step'>) {
  return (
    <NumberField
      label={label}
      value={Math.round(value * 1000) / 10}
      onChange={(v) => onChange(v / 100)}
      suffix="%"
      step={0.1}
      min={min}
      max={max}
    />
  )
}
