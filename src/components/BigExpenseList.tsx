import { AGE_LIMITS, expenseStartAge, TAX_CONFIG, WORKING_YEARS_ORDINARY_RATE, type BigExpense, type CollegeType, type Plan } from '../engine'
import { usePlanStore } from '../store/planStore'
import { formatUSD } from '../utils/format'
import { NumberField, PercentField } from './NumberField'
import { SELECT } from './styles'

const C = TAX_CONFIG.bigExpenses.college
const COLLEGE_TYPES: [CollegeType, string][] = [
  ['publicInState', 'Public, in-state'],
  ['publicOutOfState', 'Public, out-of-state'],
  ['privateNonprofit', 'Private'],
]
// Calendar years for the "paid in …" note (the projection starts this year too)
const THIS_YEAR = new Date().getFullYear()

/** When it starts, in your own age and the calendar year */
function StartsNote({ plan, expense }: { plan: Plan; expense: BigExpense }) {
  const start = expenseStartAge(plan, expense)
  if (!plan.currentAge) return null
  const year = THIS_YEAR + (start - plan.currentAge)
  const last = start + Math.max(expense.years, 1) - 1
  return (
    <p className="text-xs text-muted">
      {expense.years > 1 ? `Paid from ${year} to ${year + expense.years - 1}` : `Paid in ${year}`}, when you’re{' '}
      {expense.years > 1 ? `${start}–${last}` : start}
      {start < plan.retirementAge ? ' (before you retire)' : ''}.
    </p>
  )
}

function ExpenseCard({ plan, expense: e }: { plan: Plan; expense: BigExpense }) {
  const { updateBigExpense, removeBigExpense } = usePlanStore()
  const set = (patch: Partial<BigExpense>) => updateBigExpense(e.id, patch)

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex gap-2">
        <input
          className="w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-900"
          value={e.name}
          aria-label="Expense name"
          onChange={(ev) => set({ name: ev.target.value })}
        />
        <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label={`Remove ${e.name}`} onClick={() => removeBigExpense(e.id)}>
          ✕
        </button>
      </div>

      {e.kind === 'college' && (
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Type of college</span>
          <select
            className={SELECT}
            value={e.collegeType ?? 'custom'}
            onChange={(ev) => {
              const type = ev.target.value === 'custom' ? null : (ev.target.value as CollegeType)
              // A preset fills in this year's average; "My own amount" keeps the cost to edit
              set(type ? { collegeType: type, annualAmount: C[type] } : { collegeType: null })
            }}
          >
            {COLLEGE_TYPES.map(([type, label]) => (
              <option key={type} value={type}>
                {label}: about {formatUSD(C[type])}/yr
              </option>
            ))}
            <option value="custom">My own amount</option>
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={e.kind === 'wedding' || e.years === 1 ? 'Cost' : 'Cost per year'}
          prefix="$"
          min={0}
          value={e.annualAmount}
          // Typing your own cost leaves the college preset
          onChange={(v) => set(e.kind === 'college' && v !== e.annualAmount ? { annualAmount: v, collegeType: null } : { annualAmount: v })}
          info={
            e.kind === 'college'
              ? 'Tuition and fees plus housing and food, in today’s dollars (College Board averages for this school year). Leave out what scholarships, aid or your child will cover.'
              : e.kind === 'wedding'
                ? 'The part you plan to pay, in today’s dollars. The US average wedding costs about this much (The Knot).'
                : 'In today’s dollars; it rises with inflation.'
          }
        />
        {e.kind !== 'wedding' && <NumberField label="Years" min={1} max={40} value={e.years} onChange={(v) => set({ years: v })} />}
        {e.childAgeNow !== null ? (
          <>
            <NumberField label="Child’s age now" min={0} max={60} value={e.childAgeNow} onChange={(v) => set({ childAgeNow: v })} />
            <NumberField
              label={e.kind === 'college' ? 'Starts at child’s age' : 'At child’s age'}
              min={0}
              max={80}
              value={e.atChildAge}
              onChange={(v) => set({ atChildAge: v })}
            />
          </>
        ) : (
          <NumberField label="Starts at your age" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={e.startAge} onChange={(v) => set({ startAge: v })} />
        )}
      </div>

      {e.kind === 'college' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="In a 529 today"
            prefix="$"
            min={0}
            value={e.saved529}
            onChange={(v) => set({ saved529: v })}
            info="A 529 college savings plan pays this expense first, tax-free. It grows like your investments. Money left over stays your child’s (it isn’t added to your savings); under current law up to $35,000 of it can move to the child’s Roth IRA over time."
          />
          <NumberField
            label="Into the 529 / yr"
            prefix="$"
            min={0}
            value={e.yearly529}
            onChange={(v) => set({ yearly529: v })}
            info="Until college starts, in today’s dollars. Like your other contributions, it comes from your pay."
          />
          <PercentField
            label="Cost growth above inflation"
            min={-5}
            max={10}
            value={e.excessInflation}
            onChange={(v) => set({ excessInflation: v })}
            info="College prices have usually risen faster than prices in general; 1% a year extra is a moderate assumption."
          />
        </div>
      )}

      <StartsNote plan={plan} expense={e} />
    </div>
  )
}

/** Big one-off or multi-year costs (Basic and Advanced): college, a wedding, or anything else */
export function BigExpenseList() {
  const plan = usePlanStore((s) => s.plan)
  const addBigExpense = usePlanStore((s) => s.addBigExpense)
  const add = 'rounded-md border border-teal-600 px-2.5 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-300 dark:hover:bg-teal-950'
  return (
    <div className="space-y-3">
      {plan.bigExpenses.map((e) => (
        <ExpenseCard key={e.id} plan={plan} expense={e} />
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={add} onClick={() => addBigExpense('college')}>
          + College
        </button>
        <button type="button" className={add} onClick={() => addBigExpense('wedding')}>
          + Wedding
        </button>
        <button type="button" className={add} onClick={() => addBigExpense('other')}>
          + Other (car, home, …)
        </button>
      </div>
      <p className="text-xs text-muted">
        Paid from your savings in the year they happen: cash first, then brokerage, then retirement accounts. Before you
        retire, pre-tax withdrawals are taxed at about {Math.round(WORKING_YEARS_ORDINARY_RATE * 100)}% plus a 10% penalty
        before 59½.
      </p>
    </div>
  )
}
