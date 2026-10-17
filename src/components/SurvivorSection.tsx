import { AGE_LIMITS } from '../engine'
import { usePlanStore } from '../store/planStore'
import { NumberField, PercentField } from './NumberField'

const checkbox = 'h-4 w-4 accent-teal-700 dark:accent-teal-400'

/** Married couples: model one spouse dying first. */
export function SurvivorSection() {
  const { plan, update } = usePlanStore()
  const s = plan.survivor
  const set = (patch: Partial<typeof s>) => update({ survivor: { ...s, ...patch } })

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className={checkbox}
          checked={s.enabled}
          // Suggest age 80 the first time it's turned on
          onChange={(e) => set(s.firstDeathAge === 0 ? { enabled: e.target.checked, firstDeathAge: 80 } : { enabled: e.target.checked })}
        />
        Model one of us dying first
      </label>
      {s.enabled && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="At age" placeholder="e.g. 80" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={s.firstDeathAge} onChange={(v) => set({ firstDeathAge: v })} />
            <PercentField label="Survivor’s spending" min={30} max={100} value={s.spendingShare} onChange={(v) => set({ spendingShare: v })} />
          </div>
          <p className="text-xs text-slate-500">
            From that age the survivor keeps the larger of your two Social Security benefits, spends this share of what
            you spend together (healthcare is counted for one person), and receives each pension or other income at its
            “after a death” share. From the next year they file taxes as single, which usually means a higher tax rate.
            Survivor spending is often 70–80% of a couple’s.
          </p>
          {plan.spouseSocialSecurityAtFRA === 0 && plan.socialSecurityAtFRA > 0 && (
            <p role="note" className="rounded-md border border-l-4 border-slate-200 border-l-amber-500 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:border-l-amber-400 dark:text-slate-400">
              ⚠ Your spouse’s Social Security is empty. If “Your SS” holds a combined amount for both of you, split it
              into the two fields, or the survivor would keep the whole combined benefit.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
