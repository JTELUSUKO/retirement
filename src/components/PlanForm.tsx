import type { AccountType } from '../engine'
import { usePlanStore } from '../store/planStore'
import { NumberField, PercentField } from './NumberField'

const accountTypes: { value: AccountType; label: string }[] = [
  { value: '401k', label: '401(k) / 403(b)' },
  { value: 'traditional-ira', label: 'Traditional IRA' },
  { value: 'roth', label: 'Roth IRA / Roth 401(k)' },
  { value: 'hsa', label: 'HSA' },
  { value: 'taxable', label: 'Taxable brokerage' },
  { value: 'cash', label: 'Cash / savings' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  )
}

export function PlanForm() {
  const { plan, update, updateAssumptions, updateAccount, addAccount, removeAccount, reset } = usePlanStore()

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      <Section title="You">
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Age" value={plan.currentAge} onChange={(v) => update({ currentAge: v })} min={18} max={100} />
          <NumberField label="Retire at" value={plan.retirementAge} onChange={(v) => update({ retirementAge: v })} min={plan.currentAge} max={100} />
          <NumberField label="Plan to age" value={plan.lifeExpectancy} onChange={(v) => update({ lifeExpectancy: v })} min={plan.retirementAge} max={110} />
        </div>
      </Section>

      <Section title="Accounts">
        {plan.accounts.map((acc) => (
          <div key={acc.id} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={acc.name}
                aria-label="Account name"
                onChange={(e) => updateAccount(acc.id, { name: e.target.value })}
              />
              <select
                className="rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={acc.type}
                aria-label="Account type"
                onChange={(e) => updateAccount(acc.id, { type: e.target.value as AccountType })}
              >
                {accountTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="px-2 text-slate-400 hover:text-red-600"
                aria-label={`Remove ${acc.name}`}
                onClick={() => removeAccount(acc.id)}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Balance" prefix="$" step={1000} value={acc.balance} onChange={(v) => updateAccount(acc.id, { balance: v })} />
              <NumberField label="You add / yr" prefix="$" step={500} value={acc.annualContribution} onChange={(v) => updateAccount(acc.id, { annualContribution: v })} />
              <NumberField label="Match / yr" prefix="$" step={500} value={acc.employerMatch} onChange={(v) => updateAccount(acc.id, { employerMatch: v })} />
            </div>
          </div>
        ))}
        <button type="button" onClick={addAccount} className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
          + Add account
        </button>
      </Section>

      <Section title="Retirement income & spending">
        <NumberField label="Yearly spending (today's $)" prefix="$" step={1000} value={plan.annualSpending} onChange={(v) => update({ annualSpending: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Social Security at 67 / mo" prefix="$" step={50} value={plan.socialSecurityAtFRA} onChange={(v) => update({ socialSecurityAtFRA: v })} />
          <NumberField label="Claim at age" min={62} max={70} value={plan.socialSecurityClaimAge} onChange={(v) => update({ socialSecurityClaimAge: v })} />
        </div>
        <p className="text-xs text-slate-500">
          Find your estimate at <a className="underline" href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer">ssa.gov/myaccount</a>.
        </p>
        <NumberField label="Pension / yr (today's $)" prefix="$" step={1000} value={plan.annualPension} onChange={(v) => update({ annualPension: v })} />
      </Section>

      <Section title="Assumptions">
        <div className="grid grid-cols-3 gap-3">
          <PercentField label="Return before" value={plan.assumptions.returnPreRetirement} onChange={(v) => updateAssumptions({ returnPreRetirement: v })} />
          <PercentField label="Return after" value={plan.assumptions.returnPostRetirement} onChange={(v) => updateAssumptions({ returnPostRetirement: v })} />
          <PercentField label="Inflation" value={plan.assumptions.inflation} onChange={(v) => updateAssumptions({ inflation: v })} />
        </div>
      </Section>

      <button type="button" onClick={reset} className="text-sm text-slate-500 hover:underline">
        Reset to example plan
      </button>
    </form>
  )
}
