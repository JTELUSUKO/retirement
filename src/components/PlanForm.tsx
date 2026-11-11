import type { ReactNode } from 'react'
import { AGE_LIMITS, TAX_CONFIG, contributionWarnings, mixLabel, MIX_PRESETS, mixReturns, mixShare, validatePlan, type AccountType, type Plan, type PlanIssue } from '../engine'
import { usePlanStore } from '../store/planStore'
import { useUiPrefs, type FormMode } from '../store/uiPrefs'
import { formatUSD } from '../utils/format'
import { claimsWhileWorking } from '../utils/heatmap'
import { SSA_FEWER_YEARS, ssaEstimateAssumes, stopsEarningEarly } from '../utils/socialSecurityNotes'
import { mayUseRothEarly } from '../utils/watchOuts'
import { ACCOUNT_TYPE_LABEL, activeAdvancedSettings, defaultAccountName, isAutoAccountName, sectionSummaries } from '../utils/labels'
import { Icon, type IconName } from './Icons'
import { InfoTip } from './InfoTip'
import { AnnuitySection } from './AnnuitySection'
import { BigExpenseList } from './BigExpenseList'
import { IncomeList } from './IncomeList'
import { LongTermCareSection } from './LongTermCareSection'
import { NumberField, PercentField } from './NumberField'
import { PlanToolbar } from './PlanToolbar'
import { RothConversionSection } from './RothConversionSection'
import { StateField } from './StateField'
import { SurvivorSection } from './SurvivorSection'


/** Stock/bond mix picker that fills in return and volatility ("Custom" when they don't match a preset). */
function MixSelect({ label, mean, volatility, onPick }: {
  label: string
  mean: number
  volatility: number
  onPick: (m: { mean: number; volatility: number }) => void
}) {
  const current = mixShare(mean, volatility) ?? undefined
  return (
    <label className="block text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-slate-500 bg-white px-2 py-2 dark:border-slate-500 dark:bg-slate-900"
        value={current === undefined ? 'custom' : String(current)}
        onChange={(e) => e.target.value !== 'custom' && onPick(mixReturns(Number(e.target.value)))}
      >
        {MIX_PRESETS.map((w) => (
          <option key={w} value={w}>
            {mixLabel(w)}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>
    </label>
  )
}

type SectionId = 'you' | 'accounts' | 'spending' | 'bigExpenses' | 'survivor' | 'income' | 'annuity' | 'ltc' | 'tax' | 'healthcare' | 'assumptions'

const SECTION_ICON: Record<SectionId, IconName> = {
  you: 'user',
  accounts: 'wallet',
  spending: 'banknote',
  bigExpenses: 'sprout',
  survivor: 'users',
  income: 'briefcase',
  annuity: 'umbrella',
  ltc: 'heart',
  tax: 'percent',
  healthcare: 'pulse',
  assumptions: 'trend',
}

/** Collapsible form section; shows a one-line summary when closed. */
function Section({
  id,
  title,
  info,
  defaultOpen,
  summary,
  children,
}: {
  id: SectionId
  title: string
  info?: ReactNode
  defaultOpen: boolean
  summary: string
  children: ReactNode
}) {
  const stored = useUiPrefs((s) => s.open[id])
  const setOpen = useUiPrefs((s) => s.setOpen)
  const open = stored ?? defaultOpen
  const panelId = `section-${id}`
  return (
    <fieldset className="space-y-3">
      <legend className="flex w-full items-center text-xs font-semibold tracking-wide text-muted uppercase">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(id, !open)}
          className="flex items-center gap-1.5 rounded hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:hover:text-slate-200"
        >
          <span aria-hidden className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
          <Icon name={SECTION_ICON[id]} size={14} className="text-teal-700 dark:text-teal-400" />
          {title}
        </button>
        {info && <InfoTip label={title}>{info}</InfoTip>}
      </legend>
      {open ? (
        <div id={panelId} className="space-y-3">
          {children}
        </div>
      ) : (
        <p className="text-sm text-muted">{summary}</p>
      )}
    </fieldset>
  )
}

const SS_LINK = (
  <>
    Find your estimate at{' '}
    <a className="underline" href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer">
      ssa.gov/myaccount
    </a>
    .
  </>
)

export function PlanForm() {
  const { plan, update, updateAssumptions, updateHealthcare, updateAccount, addAccount, removeAccount } = usePlanStore()
  const mode = useUiPrefs((s) => s.mode)
  const setMode = useUiPrefs((s) => s.setMode)
  const advanced = mode === 'advanced'
  const issues = validatePlan(plan)
  const married = plan.filingStatus === 'married'
  const warnings = contributionWarnings(plan)
  const summaries = sectionSummaries(plan)
  const activeAdvanced = activeAdvancedSettings(plan)
  // Blank (0) fields just show their placeholder; the results area lists what's still needed
  const errorFor = (field: PlanIssue['field']) =>
    field !== 'accounts' && plan[field] === 0 ? undefined : issues.find((i) => i.field === field)?.message
  const { earliestClaimAge, latestClaimAge, fullRetirementAge, earningsLimit, earningsWithholdingRate } = TAX_CONFIG.socialSecurity
  const stillWorking = plan.currentAge > 0 && plan.currentAge < plan.retirementAge
  // Pay only matters for benefits that start before you stop working
  const showPay = stillWorking && (advanced || plan.annualPay > 0 || plan.spouseAnnualPay > 0 || claimsWhileWorking(plan, plan.retirementAge, plan.socialSecurityClaimAge))
  const payInfo = `Only used if Social Security starts while still working: before ${fullRetirementAge}, pay above ${formatUSD(earningsLimit)} a year holds back $1 of benefits for every $${1 / earningsWithholdingRate}. Left empty, the planner assumes those benefits are held back in full.`
  const early = plan.retirementAge > 0 ? stopsEarningEarly(plan, plan.retirementAge) : null
  const modeButton = (value: FormMode, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={`rounded px-3 py-1 text-sm ${mode === value ? 'bg-white font-medium shadow-sm dark:bg-slate-700' : 'text-slate-600 dark:text-slate-400'}`}
    >
      {label}
    </button>
  )

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      <PlanToolbar />

      <div className="space-y-2">
        <div role="radiogroup" aria-label="How much detail" className="inline-flex rounded-md bg-slate-100 p-1 dark:bg-slate-800">
          {modeButton('basic', 'Basic')}
          {modeButton('advanced', 'Advanced')}
        </div>
        <p className="text-xs text-muted">
          {advanced
            ? 'All settings: survivor planning, other income, annuity, long-term care, Roth conversions, healthcare and assumptions.'
            : `Just the essentials. Healthcare costs and investment assumptions use sensible defaults${activeAdvanced.length ? `; also in effect: ${activeAdvanced.join(', ')}` : ''}. Switch to Advanced to change them.`}
        </p>
      </div>

      <Section id="you" title="You" defaultOpen summary={summaries.you}>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Tax filing status</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-2 dark:border-slate-500 dark:bg-slate-900"
            value={plan.filingStatus}
            onChange={(e) => update({ filingStatus: e.target.value as Plan['filingStatus'] })}
          >
            <option value="single">Single</option>
            <option value="married">Married filing jointly</option>
          </select>
        </label>
        <StateField />
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Age" placeholder="e.g. 55" value={plan.currentAge} onChange={(v) => update({ currentAge: v })} min={AGE_LIMITS.min} max={AGE_LIMITS.max} error={errorFor('currentAge')} />
          <NumberField label="Retire at" placeholder="e.g. 65" value={plan.retirementAge} onChange={(v) => update({ retirementAge: v })} min={AGE_LIMITS.min} max={AGE_LIMITS.max} error={errorFor('retirementAge')} />
          <NumberField
            label={married ? 'Plan to (younger)' : 'Plan to age'}
            placeholder="e.g. 95"
            info="How long the money needs to last. Many planners use 90–95 to be safe; for couples, the age the younger of you reaches."
            value={plan.lifeExpectancy}
            onChange={(v) => update({ lifeExpectancy: v })}
            min={AGE_LIMITS.min}
            max={AGE_LIMITS.max}
            error={errorFor('lifeExpectancy')}
          />
        </div>
        {married && (
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Spouse’s age"
              placeholder="e.g. 55"
              info="You retire together at your “Retire at” age. The plan runs until the younger of you reaches “Plan to”. Ages in results are yours, with your spouse’s alongside."
              value={plan.spouseCurrentAge}
              onChange={(v) => update({ spouseCurrentAge: v })}
              min={AGE_LIMITS.min}
              max={AGE_LIMITS.max}
              error={errorFor('spouseCurrentAge')}
            />
          </div>
        )}
      </Section>

      <Section
        id="accounts"
        title="Accounts"
        defaultOpen
        summary={summaries.accounts}
        info="Each savings account and how it’s taxed: pre-tax 401(k)/IRA (taxed when withdrawn), Roth (tax-free), HSA (tax-free for healthcare), taxable brokerage (gains taxed when sold) and cash."
      >
        {plan.accounts.length === 0 && (
          <p className="text-sm text-muted">No accounts yet. Add your 401(k), IRA, Roth, HSA, brokerage or savings.</p>
        )}
        {plan.accounts.map((acc) => (
          <div key={acc.id} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-900"
                value={acc.name}
                aria-label="Account name"
                onChange={(e) => updateAccount(acc.id, { name: e.target.value })}
              />
              <select
                className="rounded-md border border-slate-500 bg-white px-2 text-sm dark:border-slate-500 dark:bg-slate-900"
                value={acc.type}
                aria-label="Account type"
                onChange={(e) => {
                  const type = e.target.value as AccountType
                  // Rename only if the name is still automatic (not one you typed)
                  const others = plan.accounts.filter((a) => a.id !== acc.id).map((a) => a.name)
                  // A brokerage cost basis and a Roth's contributions share a field; neither carries over to another type
                  updateAccount(acc.id, { type, costBasis: null, ...(isAutoAccountName(acc.name, acc.type) ? { name: defaultAccountName(type, others) } : {}) })
                }}
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
              <NumberField label="Balance" prefix="$" min={0} value={acc.balance} onChange={(v) => updateAccount(acc.id, { balance: v })} />
              <NumberField
                label="You add / yr"
                prefix="$"
                min={0}
                info={`What you contribute each year until you retire, in today’s dollars (it rises with inflation). You’ll see a warning if it’s above the IRS limit for ${TAX_CONFIG.year}.`}
                value={acc.annualContribution}
                onChange={(v) => updateAccount(acc.id, { annualContribution: v })}
              />
              <NumberField label="Match / yr" prefix="$" min={0} value={acc.employerMatch} onChange={(v) => updateAccount(acc.id, { employerMatch: v })} />
            </div>
            {acc.type === 'taxable' && (
              <NumberField
                label="Cost basis (what you paid in)"
                prefix="$"
                min={0}
                placeholder="Same as balance"
                info="Gains above this are taxed when you sell (0%, 15% or 20%, plus 3.8% at high incomes). Find it on your brokerage statement; leave empty to assume no gains yet."
                value={acc.costBasis ?? 0}
                onChange={(v) => updateAccount(acc.id, { costBasis: v === 0 ? null : v })}
              />
            )}
            {acc.type === 'roth' && (advanced || mayUseRothEarly(plan)) && (
              <NumberField
                label="Contributions so far (what you put in)"
                prefix="$"
                min={0}
                placeholder="Same as balance"
                info="What you’ve contributed comes out tax-free at any age. Growth taken out before 59½ is taxed as income plus a 10% penalty, so this matters if you retire early. Leave empty to count today’s balance as all contributions; if none of it is (only growth or an employer match), enter 1."
                value={acc.costBasis ?? 0}
                onChange={(v) => updateAccount(acc.id, { costBasis: v === 0 ? null : v })}
              />
            )}
            {warnings.filter((w) => w.accountId === acc.id).map((w) => (
              <p key={w.message} role="note" className="rounded-md border border-l-4 border-slate-200 border-l-amber-500 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:border-l-amber-400 dark:text-slate-400">
                ⚠ {w.message}
              </p>
            ))}
          </div>
        ))}
        <button type="button" onClick={addAccount} className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
          + Add account
        </button>
      </Section>

      <Section id="spending" title="Spending & Social Security" defaultOpen summary={summaries.spending}>
        <NumberField
          label="Yearly spending in retirement"
          prefix="$"
          min={0}
          info="Everything you expect to spend each year once retired, in today’s dollars, except healthcare (entered separately under Advanced). It rises with inflation."
          value={plan.annualSpending}
          onChange={(v) => update({ annualSpending: v })}
        />
        {advanced && (
          <div className="grid grid-cols-3 items-end gap-3">
            <label className={`${plan.spendingRule.type === 'guardrails' ? 'col-span-2' : 'col-span-3'} block text-sm`}>
              <span className="text-slate-600 dark:text-slate-400">
                Spending rule
                <InfoTip label="Spending rule">
                  Guardrails: your starting withdrawal rate is set once Social Security is flowing. If markets push it more
                  than 20% higher, spending (not healthcare) is cut 10%, never below your floor and not in the plan’s last
                  15 years; if it falls more than 20% lower, cuts are restored (never above your plan). Being willing to cut
                  raises the chance your money lasts.
                </InfoTip>
              </span>
              <select
                // The wrapping label also holds the ⓘ button, which would otherwise take the label
                aria-label="Spending rule"
                className="mt-1 w-full rounded-md border border-slate-500 bg-white px-2 py-2 dark:border-slate-500 dark:bg-slate-900"
                value={plan.spendingRule.type}
                onChange={(e) => update({ spendingRule: { ...plan.spendingRule, type: e.target.value as Plan['spendingRule']['type'] } })}
              >
                <option value="fixed">Fixed: same every year (plus inflation)</option>
                <option value="guardrails">Guardrails: cut 10% after bad markets, restore after good</option>
              </select>
            </label>
            {plan.spendingRule.type === 'guardrails' && (
              <PercentField label="Never below" min={30} max={100} value={plan.spendingRule.floor} onChange={(v) => update({ spendingRule: { ...plan.spendingRule, floor: v } })} />
            )}
          </div>
        )}
        {married ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Yours / mo" prefix="$" min={0} info={<>Your own monthly benefit at 67. {SS_LINK}</>} value={plan.socialSecurityAtFRA} onChange={(v) => update({ socialSecurityAtFRA: v })} />
            <NumberField
              label="Spouse’s / mo"
              prefix="$"
              min={0}
              info="Your spouse’s own monthly benefit at 67. If one benefit is under half of the other’s, a spousal top-up is added automatically once both have claimed."
              value={plan.spouseSocialSecurityAtFRA}
              onChange={(v) => update({ spouseSocialSecurityAtFRA: v })}
            />
            <NumberField label="You claim at" min={earliestClaimAge} max={latestClaimAge} info="62 to 70. Claiming early lowers the benefit for life (about 30% less at 62); waiting past 67 raises it 8% a year." value={plan.socialSecurityClaimAge} onChange={(v) => update({ socialSecurityClaimAge: v })} />
            <NumberField label="Spouse claims at" min={earliestClaimAge} max={latestClaimAge} info="Your spouse’s own claiming age (their age, 62 to 70)." value={plan.spouseClaimAge} onChange={(v) => update({ spouseClaimAge: v })} error={errorFor('spouseClaimAge')} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Social Security at 67 / mo" prefix="$" min={0} info={<>Your monthly benefit at full retirement age (67), in today’s dollars. {SS_LINK}</>} value={plan.socialSecurityAtFRA} onChange={(v) => update({ socialSecurityAtFRA: v })} />
            <NumberField label="Claim at age" min={earliestClaimAge} max={latestClaimAge} info="62 to 70. Claiming early lowers the benefit for life (about 30% less at 62); waiting past 67 raises it 8% a year." value={plan.socialSecurityClaimAge} onChange={(v) => update({ socialSecurityClaimAge: v })} />
          </div>
        )}
        {showPay && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={married ? 'Your pay / yr' : 'Pay / yr'} prefix="$" min={0} placeholder="Optional" info={payInfo} value={plan.annualPay} onChange={(v) => update({ annualPay: v })} />
            {married && (
              <NumberField
                label="Spouse’s pay / yr"
                prefix="$"
                min={0}
                placeholder="Optional"
                info={`${payInfo} If your spouse isn’t working, enter 1.`}
                value={plan.spouseAnnualPay}
                onChange={(v) => update({ spouseAnnualPay: v })}
              />
            )}
          </div>
        )}
        {early && (
          <p role="note" className="rounded-md border border-l-4 border-slate-200 border-l-amber-500 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:border-l-amber-400 dark:text-slate-400">
            ⚠ {ssaEstimateAssumes(early)} {SSA_FEWER_YEARS} {early === 'spouse' ? `You retire together, when your spouse is ${plan.retirementAge + plan.spouseCurrentAge - plan.currentAge}. ` : ''}
            A my Social Security account can show how changing future earnings affects the estimate; otherwise use a
            somewhat lower amount here.
          </p>
        )}
      </Section>

      <Section
        id="bigExpenses"
        title="Big expenses"
        // Open by default: its + College / + Wedding / + Other buttons are how people find it
        defaultOpen
        summary={summaries.bigExpenses}
        info="Large costs on top of your yearly spending, in any year: your kids’ college, a wedding, a car, a home down payment. They come out of your savings, before or after you retire."
      >
        <BigExpenseList />
      </Section>

      {advanced && (
        <>
          {married && (
            <Section id="survivor" title="If one of you dies first" defaultOpen={false} summary={summaries.survivor}>
              <SurvivorSection />
            </Section>
          )}

          <Section id="income" title="Other income in retirement" defaultOpen={false} summary={summaries.income}>
            <IncomeList />
          </Section>

          <Section id="annuity" title="Annuity" defaultOpen={false} summary={summaries.annuity}>
            <AnnuitySection />
          </Section>

          <Section id="ltc" title="Long-term care" defaultOpen={false} summary={summaries.ltc}>
            <LongTermCareSection />
          </Section>

          <Section id="tax" title="Tax strategy" defaultOpen={false} summary={summaries.tax}>
            <RothConversionSection />
          </Section>

          <Section
            id="healthcare"
            title="Healthcare in retirement"
            defaultOpen={false}
            summary={summaries.healthcare}
            info={`Per person per year, in today’s dollars: premiums plus out-of-pocket costs${married ? ', counted for each of you' : ''}. “Before Medicare” only applies if you retire before 65. Any HSA pays these first, tax-free. Medicare income surcharges (IRMAA) are added automatically.`}
          >
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Before Medicare / yr" prefix="$" min={0} value={plan.healthcare.preMedicareAnnual} onChange={(v) => updateHealthcare({ preMedicareAnnual: v })} />
              <NumberField label="On Medicare (65+) / yr" prefix="$" min={0} value={plan.healthcare.medicareAnnual} onChange={(v) => updateHealthcare({ medicareAnnual: v })} />
            </div>
            <PercentField
              label="Medical costs rise faster than inflation by"
              min={-5}
              max={10}
              info="Healthcare costs have historically risen faster than general inflation; 1–3 points extra is a common assumption."
              value={plan.healthcare.excessInflation}
              onChange={(v) => updateHealthcare({ excessInflation: v })}
            />
          </Section>

          <Section id="assumptions" title="Assumptions" defaultOpen={false} summary={summaries.assumptions}>
            <div className="grid grid-cols-2 gap-3">
              <MixSelect
                label="Investment mix before"
                mean={plan.assumptions.returnPreRetirement}
                volatility={plan.assumptions.volatilityPreRetirement}
                onPick={(m) => updateAssumptions({ returnPreRetirement: m.mean, volatilityPreRetirement: m.volatility })}
              />
              <MixSelect
                label="Investment mix after"
                mean={plan.assumptions.returnPostRetirement}
                volatility={plan.assumptions.volatilityPostRetirement}
                onPick={(m) => updateAssumptions({ returnPostRetirement: m.mean, volatilityPostRetirement: m.volatility })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PercentField
                label="Avg return before"
                min={-50}
                max={50}
                info="Average (not compounded) yearly return before fees. Money grows at the typical (median) rate, about 1 point lower when returns swing 15% a year."
                value={plan.assumptions.returnPreRetirement}
                onChange={(v) => updateAssumptions({ returnPreRetirement: v })}
              />
              <PercentField label="Avg return after" min={-50} max={50} value={plan.assumptions.returnPostRetirement} onChange={(v) => updateAssumptions({ returnPostRetirement: v })} />
              <PercentField label="Inflation" min={-5} max={20} info="Average yearly inflation. The simulation also varies it from year to year." value={plan.assumptions.inflation} onChange={(v) => updateAssumptions({ inflation: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PercentField
                label="Volatility before"
                min={0}
                max={60}
                info="How much returns swing year to year: about 17% for all stocks, 11% for 60/40, 6% for bonds."
                value={plan.assumptions.volatilityPreRetirement}
                onChange={(v) => updateAssumptions({ volatilityPreRetirement: v })}
              />
              <PercentField label="Volatility after" min={0} max={60} value={plan.assumptions.volatilityPostRetirement} onChange={(v) => updateAssumptions({ volatilityPostRetirement: v })} />
              <PercentField
                label="Fees / yr"
                min={0}
                max={3}
                info="Advisory fees plus fund expenses. An index-fund portfolio is often 0.05–0.2%; an advisor often adds about 1%."
                value={plan.assumptions.annualFee}
                onChange={(v) => updateAssumptions({ annualFee: v })}
              />
            </div>
            <p className="text-xs text-muted">
              Mix presets use illustrative long-run assumptions: stocks 8.5% average with 17% volatility, bonds 4.5% with
              6%. Type your own numbers to override.
            </p>
          </Section>
        </>
      )}
    </form>
  )
}
