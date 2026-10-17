import { AGE_LIMITS, CONFIG_2026, validatePlan, type AccountType, type Plan, type PlanIssue } from '../engine'
import { usePlanStore } from '../store/planStore'
import { ACCOUNT_TYPE_LABEL } from '../utils/labels'
import { AnnuitySection } from './AnnuitySection'
import { IncomeList } from './IncomeList'
import { NumberField, PercentField } from './NumberField'
import { PlanToolbar } from './PlanToolbar'
import { StateField } from './StateField'


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  )
}

export function PlanForm() {
  const { plan, update, updateAssumptions, updateHealthcare, updateAccount, addAccount, removeAccount } = usePlanStore()
  const issues = validatePlan(plan)
  // Blank (0) fields just show their placeholder; the results area lists what's still needed
  const errorFor = (field: PlanIssue['field']) =>
    field !== 'accounts' && plan[field] === 0 ? undefined : issues.find((i) => i.field === field)?.message
  const { earliestClaimAge, latestClaimAge } = CONFIG_2026.socialSecurity

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      <PlanToolbar />

      <Section title="You">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Tax filing status</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            value={plan.filingStatus}
            onChange={(e) => update({ filingStatus: e.target.value as Plan['filingStatus'] })}
          >
            <option value="single">Single</option>
            <option value="married">Married filing jointly (spouse assumed same age)</option>
          </select>
        </label>
        <StateField />
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Age" placeholder="e.g. 55" value={plan.currentAge} onChange={(v) => update({ currentAge: v })} min={AGE_LIMITS.min} max={AGE_LIMITS.max} error={errorFor('currentAge')} />
          <NumberField label="Retire at" placeholder="e.g. 65" value={plan.retirementAge} onChange={(v) => update({ retirementAge: v })} min={AGE_LIMITS.min} max={AGE_LIMITS.max} error={errorFor('retirementAge')} />
          <NumberField label="Plan to age" placeholder="e.g. 95" value={plan.lifeExpectancy} onChange={(v) => update({ lifeExpectancy: v })} min={AGE_LIMITS.min} max={AGE_LIMITS.max} error={errorFor('lifeExpectancy')} />
        </div>
      </Section>

      <Section title="Accounts">
        {plan.accounts.length === 0 && (
          <p className="text-sm text-slate-500">No accounts yet. Add your 401(k), IRA, Roth, HSA, brokerage or savings.</p>
        )}
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
                {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
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
              <NumberField label="Balance" prefix="$" min={0} step={1000} value={acc.balance} onChange={(v) => updateAccount(acc.id, { balance: v })} />
              <NumberField label="You add / yr" prefix="$" min={0} step={500} value={acc.annualContribution} onChange={(v) => updateAccount(acc.id, { annualContribution: v })} />
              <NumberField label="Match / yr" prefix="$" min={0} step={500} value={acc.employerMatch} onChange={(v) => updateAccount(acc.id, { employerMatch: v })} />
            </div>
          </div>
        ))}
        <button type="button" onClick={addAccount} className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
          + Add account
        </button>
      </Section>

      <Section title="Spending & Social Security">
        <NumberField label="Yearly spending, excluding healthcare (today's $)" prefix="$" min={0} step={1000} value={plan.annualSpending} onChange={(v) => update({ annualSpending: v })} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={plan.filingStatus === 'married' ? 'Social Security at 67 / mo (both)' : 'Social Security at 67 / mo'} prefix="$" min={0} step={50} value={plan.socialSecurityAtFRA} onChange={(v) => update({ socialSecurityAtFRA: v })} />
          <NumberField label="Claim at age" min={earliestClaimAge} max={latestClaimAge} value={plan.socialSecurityClaimAge} onChange={(v) => update({ socialSecurityClaimAge: v })} />
        </div>
        <p className="text-xs text-slate-500">
          Find your estimate at <a className="underline" href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer">ssa.gov/myaccount</a>.
        </p>
        {plan.retirementAge > 0 && plan.retirementAge < CONFIG_2026.socialSecurity.fullRetirementAge && (
          <p role="note" className="rounded-md border border-l-4 border-slate-200 border-l-amber-500 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:border-l-amber-400 dark:text-slate-400">
            ⚠ Your ssa.gov estimate assumes you keep earning until {CONFIG_2026.socialSecurity.fullRetirementAge}. Stopping
            work at {plan.retirementAge} means fewer earning years, which can lower your benefit, especially if you have
            fewer than 35 years of earnings. Your my Social Security account can show how changing your future earnings
            affects the estimate; otherwise use a somewhat lower amount here.
          </p>
        )}
      </Section>

      <Section title="Other income in retirement">
        <IncomeList />
      </Section>

      <Section title="Annuity">
        <AnnuitySection />
      </Section>

      <Section title="Healthcare in retirement">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Before Medicare / yr"
            prefix="$"
            min={0}
            step={500}
            value={plan.healthcare.preMedicareAnnual}
            onChange={(v) => updateHealthcare({ preMedicareAnnual: v })}
          />
          <NumberField
            label="On Medicare (65+) / yr"
            prefix="$"
            min={0}
            step={500}
            value={plan.healthcare.medicareAnnual}
            onChange={(v) => updateHealthcare({ medicareAnnual: v })}
          />
        </div>
        <PercentField
          label="Medical costs rise faster than inflation by"
          min={-5}
          max={10}
          value={plan.healthcare.excessInflation}
          onChange={(v) => updateHealthcare({ excessInflation: v })}
        />
        <p className="text-xs text-slate-500">
          Per person, in today's dollars: premiums plus out-of-pocket costs.
          {plan.filingStatus === 'married' && ' Counted for both of you.'} "Before Medicare" only applies if you retire
          before 65. Any HSA pays these costs first, tax-free.
        </p>
      </Section>

      <Section title="Assumptions">
        <div className="grid grid-cols-3 gap-3">
          <PercentField label="Return before" min={-50} max={50} value={plan.assumptions.returnPreRetirement} onChange={(v) => updateAssumptions({ returnPreRetirement: v })} />
          <PercentField label="Return after" min={-50} max={50} value={plan.assumptions.returnPostRetirement} onChange={(v) => updateAssumptions({ returnPostRetirement: v })} />
          <PercentField label="Inflation" min={-5} max={20} value={plan.assumptions.inflation} onChange={(v) => updateAssumptions({ inflation: v })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <PercentField label="Volatility before" min={0} max={60} value={plan.assumptions.volatilityPreRetirement} onChange={(v) => updateAssumptions({ volatilityPreRetirement: v })} />
          <PercentField label="Volatility after" min={0} max={60} value={plan.assumptions.volatilityPostRetirement} onChange={(v) => updateAssumptions({ volatilityPostRetirement: v })} />
        </div>
        <p className="text-xs text-slate-500">
          Volatility is how much returns swing year to year. Roughly 15% for a stock-heavy mix, 10% for a balanced one.
        </p>
      </Section>

    </form>
  )
}
