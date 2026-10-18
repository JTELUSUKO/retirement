import { AGE_LIMITS } from '../engine'
import { usePlanStore } from '../store/planStore'
import { InfoTip } from './InfoTip'
import { NumberField } from './NumberField'

const checkbox = 'h-4 w-4 accent-teal-700 dark:accent-teal-400'
const RATES = [0.1, 0.12, 0.22, 0.24, 0.32]

/** Roth conversions in low-income years ("fill the bracket"). */
export function RothConversionSection() {
  const { plan, updateRothConversion } = usePlanStore()
  const c = plan.rothConversion

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className={checkbox} checked={c.enabled} onChange={(e) => updateRothConversion({ enabled: e.target.checked })} />
        Convert pre-tax savings to Roth in low-income years
              <InfoTip label="Roth conversions">
            Each year in this window, pre-tax money is moved to Roth until your taxable income reaches the top of the
            chosen federal bracket. You pay tax on it now (from savings) at a known, lower rate, and later RMDs and
            taxes shrink. Defaults: from retirement through the year before RMDs start. Income at 63 and later sets
            Medicare premiums two years later, so the IRMAA option caps conversions there.
        </InfoTip>
      </label>
      {c.enabled && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Fill up to</span>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
                value={c.fillToRate}
                onChange={(e) => updateRothConversion({ fillToRate: Number(e.target.value) })}
              >
                {RATES.map((r) => (
                  <option key={r} value={r}>{Math.round(r * 100)}% bracket</option>
                ))}
              </select>
            </label>
            <NumberField label="From age" placeholder={`${plan.retirementAge || 'retire'}`} min={0} max={AGE_LIMITS.max} value={c.fromAge} onChange={(v) => updateRothConversion({ fromAge: v })} />
            <NumberField label="Through age" placeholder="RMDs − 1" min={0} max={AGE_LIMITS.max} value={c.toAge} onChange={(v) => updateRothConversion({ toAge: v })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className={checkbox} checked={c.stayUnderIrmaa} onChange={(e) => updateRothConversion({ stayUnderIrmaa: e.target.checked })} />
            Stay under the Medicare surcharge (IRMAA) threshold from age 63
          </label>
        </div>
      )}
    </div>
  )
}
