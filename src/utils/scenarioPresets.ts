import { STRESS_LABEL, type Plan, type Scenario } from '../engine'
import { formatUSDCompact } from './format'

type Preset = {
  key: string
  label: string
  make: (plan: Plan) => Omit<Scenario, 'id' | 'slot'>
  /** Only offered when this returns true */
  when?: (plan: Plan) => boolean
}

/** One-click what-ifs, built from the current plan. */
export const SCENARIO_PRESETS: Preset[] = [
  {
    key: 'earlier',
    label: 'Retire 2 years earlier',
    make: (p) => ({ name: `Retire at ${p.retirementAge - 2}`, overrides: { retirementAge: p.retirementAge - 2 }, stress: 'none' }),
  },
  {
    key: 'later',
    label: 'Retire 2 years later',
    make: (p) => ({ name: `Retire at ${p.retirementAge + 2}`, overrides: { retirementAge: p.retirementAge + 2 }, stress: 'none' }),
  },
  {
    key: 'spend-less',
    label: 'Spend 10% less',
    make: (p) => {
      const spending = Math.round((p.annualSpending * 0.9) / 1000) * 1000
      return { name: `Spend ${formatUSDCompact(spending)}/yr`, overrides: { annualSpending: spending }, stress: 'none' }
    },
  },
  {
    key: 'ss70',
    label: 'Claim Social Security at 70',
    make: () => ({ name: 'Social Security at 70', overrides: { socialSecurityClaimAge: 70 }, stress: 'none' }),
  },
  {
    key: 'annuity',
    label: 'Toggle the annuity',
    make: (p) =>
      p.annuityPurchase.enabled
        ? { name: 'Without the annuity', overrides: { annuityEnabled: false }, stress: 'none' }
        : {
            name: `${formatUSDCompact(p.annuityPurchase.amount)} annuity`,
            overrides: { annuityEnabled: true },
            stress: 'none',
          },
  },
  {
    key: 'early-death',
    label: 'One spouse dies early',
    when: (p) => p.filingStatus === 'married',
    make: (p) => {
      // Ten years into retirement, but at least a year before the plan ends
      const age = Math.min(Math.max(p.retirementAge + 10, p.currentAge + 1), p.lifeExpectancy - 1)
      return { name: `Spouse dies at ${age}`, overrides: { survivorDeathAge: age }, stress: 'none' }
    },
  },
  { key: 'crash', label: 'Market crash at retirement', make: () => ({ name: 'Crash at retirement', overrides: {}, stress: 'crash' }) },
  {
    key: 'inflation',
    label: 'High inflation',
    make: () => ({ name: 'High inflation', overrides: {}, stress: 'high-inflation' }),
  },
]

export const stressOptions = Object.entries(STRESS_LABEL) as [Scenario['stress'], string][]
