import { useState, type ReactNode } from 'react'
import { InfoTip } from './InfoTip'

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
  /** Keep the label for screen readers only (e.g. inside a table with row headers). */
  hideLabel?: boolean
  /** Shown when the field is empty. Zero is displayed as an empty field. */
  placeholder?: string
  /** Explanation shown in an ⓘ tip next to the label */
  info?: ReactNode
}

/**
 * Number input that keeps whatever you are typing and only updates the plan
 * once the text is a valid number within [min, max]. On blur it shows the
 * last valid value again, so a cleared field never feeds 0 into the plan.
 */
export function NumberField({ label, value, onChange, prefix, suffix, min, max, error, hideLabel, placeholder = '0', info }: Props) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)

  const zeroAllowed = min === undefined || min <= 0
  const parse = (raw: string) => {
    // An emptied field means 0 where 0 is allowed (e.g. dollar amounts)
    if (raw.trim() === '') return zeroAllowed ? 0 : null
    // Accept "450,000", "$450000" or " 450000 "
    const n = Number(raw.replace(/[$,\s]/g, ''))
    const valid = Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
    return valid ? n : null
  }
  const typingInvalid = editing && parse(text) === null
  const invalid = typingInvalid || Boolean(error)
  const rangeHint =
    min !== undefined && max !== undefined ? `Enter ${min}–${max}` : min !== undefined ? `Minimum ${min}` : 'Enter a number'

  return (
    <label className="block text-sm">
      <span className={hideLabel ? 'sr-only' : 'text-slate-600 dark:text-slate-400'}>
        {label}
        {info && !hideLabel && <InfoTip label={label}>{info}</InfoTip>}
      </span>
      <div
        className={`${hideLabel ? '' : 'mt-1 '}flex items-center rounded-md border bg-white focus-within:ring-2 dark:bg-slate-900 ${
          invalid
            ? 'border-red-500 focus-within:ring-red-500'
            : 'border-slate-300 focus-within:ring-teal-600 dark:border-slate-700'
        }`}
      >
        {prefix && <span className="pl-3 text-slate-500">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="w-full bg-transparent px-3 py-2 outline-none"
          // Money shows thousands separators ("450,000"); while typing, the raw text is kept
          value={editing ? text : value === 0 ? '' : prefix === '$' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(value)}
          placeholder={placeholder}
          aria-invalid={invalid}
          onFocus={() => {
            setText(value === 0 ? '' : String(value))
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
export function PercentField({ label, value, onChange, min, max, info }: Omit<Props, 'prefix' | 'suffix' | 'step' | 'placeholder'>) {
  return (
    <NumberField
      label={label}
      info={info}
      value={Math.round(value * 1000) / 10}
      onChange={(v) => onChange(v / 100)}
      placeholder="0"
      suffix="%"
      min={min}
      max={max}
    />
  )
}
