import { useState, type ReactNode } from 'react'
import { AGE_LIMITS, TAX_CONFIG, describeStateRule, NO_INCOME_TAX_STATES, validatePlan, type Plan } from '../engine'
import { usePlanStore } from '../store/planStore'
import { useUiPrefs } from '../store/uiPrefs'
import { ACCOUNT_TYPE_LABEL } from '../utils/labels'
import { ALL_STATES } from '../utils/states'
import { applySavings, isBlankPlan, QUICK_ACCOUNT_TYPES, savingsFromPlan, type QuickSavings } from '../utils/quickStart'
import { NumberField } from './NumberField'
import { PRIMARY, SECONDARY } from './styles'

const STEPS = ['About you', 'Where you’ll live', 'Your savings', 'Spending', 'Social Security'] as const
/** Short names under the progress bar */
const STEP_LABELS = ['You', 'State', 'Savings', 'Spending', 'Social Security']

const select = 'mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-2 dark:border-slate-500 dark:bg-slate-900'
const secondary =
  `${SECONDARY} px-4 py-2 text-sm`
const primary =
  `${PRIMARY} px-4 py-2 text-sm`

/** Five short steps for a first visit. Edits a draft and saves it to the plan on Finish. */
export function QuickStart() {
  const plan = usePlanStore((s) => s.plan)
  const update = usePlanStore((s) => s.update)
  const loadExample = usePlanStore((s) => s.loadExample)
  const setGuide = useUiPrefs((s) => s.setGuide)
  const [step, setStep] = useState(0)
  // Opened on purpose for an existing plan: leaving just returns to it
  const [startedBlank] = useState(() => isBlankPlan(plan))
  const [draft, setDraft] = useState<Plan>(plan)
  const [savings, setSavings] = useState<QuickSavings>(() => savingsFromPlan(plan))
  const set = (patch: Partial<Plan>) => setDraft((d) => ({ ...d, ...patch }))
  const married = draft.filingStatus === 'married'
  const { earliestClaimAge, latestClaimAge } = TAX_CONFIG.socialSecurity

  // Age problems are shown only once every age is filled in
  const ageFields = ['currentAge', 'retirementAge', 'lifeExpectancy', 'spouseCurrentAge'] as const
  const agesFilled = draft.currentAge > 0 && draft.retirementAge > 0 && draft.lifeExpectancy > 0 && (!married || draft.spouseCurrentAge > 0)
  const ageIssues = agesFilled ? validatePlan(draft).filter((i) => (ageFields as readonly string[]).includes(i.field)) : []
  const claimIssue = validatePlan(draft).find((i) => i.field === 'spouseClaimAge')
  const canContinue = [agesFilled && ageIssues.length === 0, true, true, draft.annualSpending > 0, !claimIssue][step]
  const last = step === STEPS.length - 1

  const finish = () => {
    update({ ...draft, accounts: applySavings(plan.accounts, savings) })
    setGuide('auto')
  }

  const body: ReactNode[] = [
    <>
      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">Are you planning for</span>
        <select className={select} value={draft.filingStatus} onChange={(e) => set({ filingStatus: e.target.value as Plan['filingStatus'] })}>
          <option value="single">Just me (single)</option>
          <option value="married">Me and my spouse (married filing jointly)</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Your age" placeholder="e.g. 55" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={draft.currentAge} onChange={(v) => set({ currentAge: v })} />
        {married && (
          <NumberField label="Spouse’s age" placeholder="e.g. 55" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={draft.spouseCurrentAge} onChange={(v) => set({ spouseCurrentAge: v })} />
        )}
        <NumberField label="Retire at" placeholder="e.g. 65" min={AGE_LIMITS.min} max={AGE_LIMITS.max} value={draft.retirementAge} onChange={(v) => set({ retirementAge: v })} />
        <NumberField
          label={married ? 'Plan until the younger is' : 'Plan until age'}
          placeholder="e.g. 95"
          min={AGE_LIMITS.min}
          max={AGE_LIMITS.max}
          info="How long the money needs to last. Many planners use 90–95 to be safe."
          value={draft.lifeExpectancy}
          onChange={(v) => set({ lifeExpectancy: v })}
        />
      </div>
      {ageIssues.map((i) => (
        <p key={i.message} role="alert" className="text-sm text-red-600 dark:text-red-400">✕ {i.message}</p>
      ))}
    </>,
    <>
      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">State you’ll live in during retirement</span>
        <select className={select} value={draft.state} onChange={(e) => set({ state: e.target.value })}>
          <option value="">Not sure yet (skip state tax)</option>
          {ALL_STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
              {NO_INCOME_TAX_STATES[code] ? ' (no income tax)' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-slate-500 dark:text-slate-400">{describeStateRule(draft.state)}</p>
    </>,
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Today’s balances{married ? ' for both of you' : ''}, and what you add each year until you retire. If you have
        more than one account of a type, enter the total (they’ll be combined into one). Leave empty what you don’t
        have. You can add employer matches and more detail later.
      </p>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-[1fr_8rem_8rem]">
          <span className="hidden sm:block">Account</span>
          <span>Balance</span>
          <span>You add / yr</span>
        </div>
        {QUICK_ACCOUNT_TYPES.map((type) => (
          <div key={type} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[1fr_8rem_8rem]">
            <span className="col-span-2 font-medium sm:col-span-1 sm:font-normal">{ACCOUNT_TYPE_LABEL[type]}</span>
            <NumberField
              label={`${ACCOUNT_TYPE_LABEL[type]} balance`}
              hideLabel
              prefix="$"
              min={0}
              value={savings[type].balance}
              onChange={(v) => setSavings((s) => ({ ...s, [type]: { ...s[type], balance: v } }))}
            />
            <NumberField
              label={`${ACCOUNT_TYPE_LABEL[type]} yearly contribution`}
              hideLabel
              prefix="$"
              min={0}
              value={savings[type].annualContribution}
              onChange={(v) => setSavings((s) => ({ ...s, [type]: { ...s[type], annualContribution: v } }))}
            />
          </div>
        ))}
      </div>
    </>,
    <>
      <NumberField
        label="How much do you expect to spend each year in retirement?"
        prefix="$"
        min={0}
        placeholder="e.g. 60,000"
        info="Everything except healthcare, which the app estimates separately. In today’s dollars; it rises with inflation. Not sure? Many people start from 70–80% of their current take-home spending."
        value={draft.annualSpending}
        onChange={(v) => set({ annualSpending: v })}
      />
    </>,
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your estimated monthly benefit at full retirement age (67) is on your{' '}
        <a className="underline" href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer">
          my Social Security
        </a>{' '}
        statement. Leave empty if you won’t get Social Security.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={married ? 'Yours at 67 / mo' : 'At 67 / mo'} prefix="$" min={0} value={draft.socialSecurityAtFRA} onChange={(v) => set({ socialSecurityAtFRA: v })} />
        <NumberField label="You claim at" min={earliestClaimAge} max={latestClaimAge} value={draft.socialSecurityClaimAge} onChange={(v) => set({ socialSecurityClaimAge: v })} />
        {married && (
          <>
            <NumberField label="Spouse’s at 67 / mo" prefix="$" min={0} value={draft.spouseSocialSecurityAtFRA} onChange={(v) => set({ spouseSocialSecurityAtFRA: v })} />
            <NumberField label="Spouse claims at" min={earliestClaimAge} max={latestClaimAge} value={draft.spouseClaimAge} onChange={(v) => set({ spouseClaimAge: v })} />
          </>
        )}
      </div>
      {claimIssue && <p role="alert" className="text-sm text-red-600 dark:text-red-400">✕ {claimIssue.message}</p>}
    </>,
  ]

  return (
    <section aria-labelledby="quickstart-heading" className="mx-auto max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-teal-700 uppercase dark:text-teal-400">
          Guided setup · Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="quickstart-heading" className="text-xl font-semibold">
          {STEPS[step]}
        </h2>
        {/* Finished steps can be revisited; later ones open with Next, once each step is valid */}
        <ol className="grid grid-cols-5 gap-1.5 pt-2" aria-label="Setup progress">
          {STEP_LABELS.map((label, i) => {
            const bar = `block h-2 rounded-full ${i <= step ? 'bg-teal-600 dark:bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`
            const text = `mt-1.5 block text-xs leading-tight ${i === step ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`
            return (
              <li key={label} aria-current={i === step ? 'step' : undefined}>
                {i < step ? (
                  <button type="button" className="group w-full text-left" onClick={() => setStep(i)} aria-label={`Back to step ${i + 1}: ${STEPS[i]}`}>
                    <span className={`${bar} group-hover:bg-teal-700`} />
                    <span className={`${text} underline-offset-2 group-hover:underline`}>{label}</span>
                  </button>
                ) : (
                  <>
                    <span className={bar} />
                    <span className={text}>{label}</span>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canContinue) return
          if (last) finish()
          else setStep(step + 1)
        }}
      >
        {body[step]}
        {/* One row at the card's foot: the way out on the left, away from Back / Next on the right */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            className="text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
            onClick={() => setGuide(startedBlank ? 'skipped' : 'auto')}
          >
            {startedBlank ? 'Skip setup' : 'Close without saving'}
          </button>
          <div className="ml-auto flex gap-2">
            {/* Always shown so the buttons don't move; inactive on the first step */}
            <button type="button" className={secondary} disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </button>
            <button type="submit" disabled={!canContinue} className={primary}>
              {last ? 'See my results' : 'Next'}
            </button>
          </div>
        </div>
      </form>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {startedBlank && (
          <>
            Want to look around first?{' '}
            <button
              type="button"
              className="font-medium text-teal-700 underline dark:text-teal-400"
              onClick={() => {
                loadExample()
                setGuide('auto')
              }}
            >
              Explore an example plan
            </button>
            .{' '}
          </>
        )}
        Nothing you enter leaves this browser.
      </p>
    </section>
  )
}
