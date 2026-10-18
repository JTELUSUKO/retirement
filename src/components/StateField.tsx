import { describeStateRule, NO_INCOME_TAX_STATES, stateRule } from '../engine'
import { ALL_STATES } from '../utils/states'
import { usePlanStore } from '../store/planStore'
import { NumberField } from './NumberField'

/** State of residence in retirement, with a one-line summary of how it taxes retirees. */
export function StateField() {
  const { plan, update } = usePlanStore()
  const rule = stateRule(plan.state)
  const showExclusion = rule !== null && rule.exemptRetirementIncomeFromAge === null

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">State you’ll live in during retirement</span>
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          value={plan.state}
          onChange={(e) => update({ state: e.target.value })}
        >
          <option value="">Choose a state…</option>
          {ALL_STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
              {NO_INCOME_TAX_STATES[code] ? ' (no income tax)' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate-500">{describeStateRule(plan.state)}</p>
      {showExclusion && (
        <div>
          <NumberField
            label="Retirement income your state exempts, per person / yr"
            prefix="$"
            min={0}
            info="Many states exempt part of pension or IRA income for older residents (for example a fixed amount per person). Check your state’s rules; leave empty if unsure, which assumes no exemption."
            value={plan.stateRetirementExclusion}
            onChange={(v) => update({ stateRetirementExclusion: v })}
          />
        </div>
      )}
    </div>
  )
}
