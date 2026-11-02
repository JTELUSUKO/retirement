import { describeStateRule, stateRule } from '../engine'
import { StateSelect } from './StateSelect'
import { usePlanStore } from '../store/planStore'
import { NumberField } from './NumberField'

/** State of residence in retirement, with a one-line summary of how it taxes retirees. */
export function StateField() {
  const { plan, update } = usePlanStore()
  const rule = stateRule(plan.state)
  const showExclusion = rule !== null && rule.exemptRetirementIncomeFromAge === null

  return (
    <div className="space-y-2">
      <StateSelect label="State you’ll live in during retirement" value={plan.state} onChange={(state) => update({ state })} emptyLabel="Choose a state…" />
      <p className="text-xs text-muted">{describeStateRule(plan.state)}</p>
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
