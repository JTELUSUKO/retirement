import { AGE_LIMITS, type IncomeKind, type IncomeStream } from '../engine'
import { usePlanStore } from '../store/planStore'
import { INCOME_KIND_LABEL } from '../utils/labels'
import { NumberField, PercentField } from './NumberField'

const kinds: { value: IncomeKind; hint: string }[] = [
  {
    value: 'annuity',
    hint: 'Taxable: 100% if bought inside an IRA/401(k); only the earnings part if bought with after-tax money (check your contract).',
  },
  { value: 'pension', hint: 'Usually 100% taxable. Many private pensions have no cost-of-living raise; government pensions often do.' },
  { value: 'work', hint: 'Enter gross pay; payroll taxes aren’t modeled. Usually 100% taxable.' },
  { value: 'rental', hint: 'Enter net rent after expenses. Taxable share depends on depreciation; often less than 100%.' },
  { value: 'other', hint: 'Any other regular income in retirement.' },
]
const labelOf = (kind: IncomeKind) => INCOME_KIND_LABEL[kind]

const checkbox = 'h-4 w-4 accent-teal-700 dark:accent-teal-400'

function IncomeCard({ stream, married }: { stream: IncomeStream; married: boolean }) {
  const { updateIncome, removeIncome } = usePlanStore()
  const set = (patch: Partial<IncomeStream>) => updateIncome(stream.id, patch)
  const lifetime = stream.endAge === null

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex gap-2">
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={stream.name}
          aria-label="Income name"
          onChange={(e) => set({ name: e.target.value })}
        />
        <select
          className="rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={stream.kind}
          aria-label="Income type"
          onChange={(e) => {
            const kind = e.target.value as IncomeKind
            // Rename only if the name was still the default for the old type
            set(stream.name === labelOf(stream.kind) ? { kind, name: labelOf(kind) } : { kind })
          }}
        >
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{labelOf(k.value)}</option>
          ))}
        </select>
        <button
          type="button"
          className="px-2 text-slate-400 hover:text-red-600"
          aria-label={`Remove ${stream.name}`}
          onClick={() => removeIncome(stream.id)}
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumberField label="Per year" prefix="$" min={0} step={1000} value={stream.annualAmount} onChange={(v) => set({ annualAmount: v })} />
        <NumberField label="From age" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={stream.startAge} onChange={(v) => set({ startAge: v })} />
        {lifetime ? (
          <div className="text-sm">
            <span className="text-slate-600 dark:text-slate-400">Until</span>
            <div className="mt-1 py-2 text-slate-500">For life</div>
          </div>
        ) : (
          <NumberField label="Until age" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={stream.endAge!} onChange={(v) => set({ endAge: v })} />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className={checkbox}
              checked={lifetime}
              onChange={(e) => set({ endAge: e.target.checked ? null : stream.startAge + 5 })}
            />
            Paid for life
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className={checkbox}
              checked={stream.inflationAdjusted}
              onChange={(e) => set({ inflationAdjusted: e.target.checked })}
            />
            Rises with inflation
          </label>
        </div>
        <div className="w-28">
          <PercentField label="Taxable" min={0} max={100} value={stream.taxableShare} onChange={(v) => set({ taxableShare: v })} />
        </div>
        {married && (
          <div className="w-36">
            <PercentField label="After a death" min={0} max={100} value={stream.survivorShare} onChange={(v) => set({ survivorShare: v })} />
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {stream.inflationAdjusted
          ? 'Amount in today’s dollars; it rises with inflation.'
          : 'Fixed dollar amount actually paid each year; its buying power shrinks with inflation.'}{' '}
        {kinds.find((k) => k.value === stream.kind)!.hint}
      </p>
    </div>
  )
}

export function IncomeList() {
  const { plan, addIncome } = usePlanStore()
  return (
    <div className="space-y-3">
      {plan.incomeStreams.map((s) => (
        <IncomeCard key={s.id} stream={s} married={plan.filingStatus === 'married'} />
      ))}
      <button type="button" onClick={addIncome} className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
        + Add income (annuity, pension, part-time work, rental)
      </button>
      <p className="text-xs text-slate-500">Counted from your retirement age; income before then is assumed to be part of today’s budget.</p>
    </div>
  )
}
