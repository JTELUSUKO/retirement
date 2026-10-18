import { AGE_LIMITS } from '../engine'
import { usePlanStore } from '../store/planStore'
import { NumberField } from './NumberField'

const checkbox = 'h-4 w-4 accent-teal-700 dark:accent-teal-400'

/** Optional long-term care need. */
export function LongTermCareSection() {
  const { plan, updateLongTermCare } = usePlanStore()
  const l = plan.longTermCare
  const married = plan.filingStatus === 'married'

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className={checkbox} checked={l.enabled} onChange={(e) => updateLongTermCare({ enabled: e.target.checked })} />
        Plan for a period of long-term care
      </label>
      {l.enabled && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className={`grid gap-3 ${married ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {married && (
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Who</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
                  value={l.who}
                  onChange={(e) => updateLongTermCare({ who: e.target.value as typeof l.who })}
                >
                  <option value="you">You</option>
                  <option value="spouse">Spouse</option>
                </select>
              </label>
            )}
            <NumberField label="From their age" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={l.startAge} onChange={(v) => updateLongTermCare({ startAge: v })} />
            <NumberField label="Years" min={1} max={20} value={l.years} onChange={(v) => updateLongTermCare({ years: v })} />
            <NumberField label="Cost / yr" prefix="$" min={0} step={5000} value={l.annualCost} onChange={(v) => updateLongTermCare({ annualCost: v })} />
          </div>
          <p className="text-xs text-slate-500">
            In today’s dollars, rising with healthcare costs, on top of regular healthcare (your HSA can pay it). Costs
            vary widely by type of care and location, roughly $60,000 for some home care to well over $100,000 a year
            for a private nursing-home room. Long-term care insurance premiums can be entered as part of spending instead.
          </p>
        </div>
      )}
    </div>
  )
}
