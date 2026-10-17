import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, IncomeStream, Plan, Scenario } from '../engine'

/** Sample plan behind “Load example”. */
export const examplePlan: Plan = {
  filingStatus: 'single',
  state: 'NC',
  stateRetirementExclusion: 0,
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 95,
  accounts: [
    { id: '1', name: '401(k)', type: '401k', balance: 450_000, annualContribution: 24_500, employerMatch: 6_000, costBasis: null },
    { id: '2', name: 'Roth IRA', type: 'roth', balance: 80_000, annualContribution: 7_500, employerMatch: 0, costBasis: null },
    { id: '3', name: 'Brokerage', type: 'taxable', balance: 60_000, annualContribution: 6_000, employerMatch: 0, costBasis: 45_000 },
    { id: '4', name: 'Emergency fund', type: 'cash', balance: 30_000, annualContribution: 0, employerMatch: 0, costBasis: null },
  ],
  annualSpending: 60_000,
  socialSecurityAtFRA: 2_800,
  spouseSocialSecurityAtFRA: 0,
  spouseCurrentAge: 55,
  spouseClaimAge: 67,
  survivor: { enabled: false, whoDies: 'you', firstDeathAge: 0, spendingShare: 0.75 },
  socialSecurityClaimAge: 67,
  incomeStreams: [],
  annuityPurchase: {
    enabled: false,
    amount: 150_000,
    purchaseAge: 65,
    payoutRate: null,
    inflationAdjusted: false,
    fundedFrom: 'pretax',
  },
  scenarios: [],
  healthcare: { preMedicareAnnual: 12_000, medicareAnnual: 7_000, excessInflation: 0.02 },
  assumptions: {
    returnPreRetirement: 0.07,
    returnPostRetirement: 0.05,
    volatilityPreRetirement: 0.15,
    volatilityPostRetirement: 0.1,
    inflation: 0.025,
  },
}

/**
 * What a new visitor starts with: personal fields blank (0 shows as an empty box), no accounts or
 * income. Model assumptions, healthcare estimates and claiming at 67 stay filled in.
 */
export const blankPlan: Plan = {
  ...examplePlan,
  state: '',
  stateRetirementExclusion: 0,
  currentAge: 0,
  retirementAge: 0,
  lifeExpectancy: 0,
  accounts: [],
  annualSpending: 0,
  socialSecurityAtFRA: 0,
  spouseSocialSecurityAtFRA: 0,
  spouseCurrentAge: 0,
  spouseClaimAge: 67,
  survivor: { enabled: false, whoDies: 'you', firstDeathAge: 0, spendingShare: 0.75 },
  incomeStreams: [],
  annuityPurchase: { ...examplePlan.annuityPurchase, enabled: false, purchaseAge: 0 },
  scenarios: [],
}

/** Back to a blank plan, keeping the visitor's own assumptions and healthcare estimates. */
export const clearedPlan = (plan: Plan): Plan => ({
  ...blankPlan,
  assumptions: plan.assumptions,
  healthcare: plan.healthcare,
})

/** Upgrade a plan saved by an older version of the app. */
export function migratePlanState(persisted: unknown, version: number): { plan: Plan } {
  const state = persisted as { plan: Plan }
  // v1 → v2: volatility assumptions added
  if (version < 2) {
    state.plan.assumptions = { ...examplePlan.assumptions, ...state.plan.assumptions }
  }
  // v2 → v3: filing status added
  if (version < 3) {
    state.plan = { ...state.plan, filingStatus: state.plan.filingStatus ?? 'single' }
  }
  // v3 → v4: healthcare costs added (spending now excludes healthcare)
  if (version < 4) {
    state.plan = { ...state.plan, healthcare: state.plan.healthcare ?? examplePlan.healthcare }
  }
  // v4 → v5: single pension field replaced by a list of income streams
  if (version < 5) {
    const { annualPension = 0, ...rest } = state.plan as Plan & { annualPension?: number }
    const pension: IncomeStream = {
      id: 'pension',
      name: 'Pension',
      kind: 'pension',
      annualAmount: annualPension,
      startAge: rest.retirementAge,
      endAge: null,
      inflationAdjusted: true,
      taxableShare: 1,
      survivorShare: 1,
    }
    state.plan = { ...rest, incomeStreams: annualPension > 0 ? [pension] : [] }
  }
  // v5 → v6: optional annuity purchase (off by default)
  if (version < 6) {
    state.plan = {
      ...state.plan,
      annuityPurchase: state.plan.annuityPurchase ?? { ...examplePlan.annuityPurchase, purchaseAge: state.plan.retirementAge },
    }
  }
  // v6 → v7: scenarios for comparison
  if (version < 7) {
    state.plan = { ...state.plan, scenarios: state.plan.scenarios ?? [] }
  }
  // v7 → v8: scenarios get a fixed chart color slot
  if (version < 8) {
    state.plan = {
      ...state.plan,
      scenarios: state.plan.scenarios.map((sc, i) => ({ ...sc, slot: sc.slot ?? i + 1 })),
    }
  }
  // v8 → v9: state income tax (not chosen yet)
  if (version < 9) {
    state.plan = {
      ...state.plan,
      state: state.plan.state ?? '',
      stateRetirementExclusion: state.plan.stateRetirementExclusion ?? 0,
    }
  }
  // v9 → v10: survivor modeling for couples; separate spouse Social Security; survivor share per income
  if (version < 10) {
    state.plan = {
      ...state.plan,
      spouseSocialSecurityAtFRA: state.plan.spouseSocialSecurityAtFRA ?? 0,
      survivor: state.plan.survivor ?? { enabled: false, whoDies: 'you', firstDeathAge: 0, spendingShare: 0.75 },
      incomeStreams: state.plan.incomeStreams.map((s) => ({ ...s, survivorShare: s.survivorShare ?? 1 })),
    }
  }
  // v10 → v11: separate spouse age and claiming age; who dies first
  if (version < 11) {
    state.plan = {
      ...state.plan,
      spouseCurrentAge: state.plan.spouseCurrentAge ?? state.plan.currentAge,
      spouseClaimAge: state.plan.spouseClaimAge ?? state.plan.socialSecurityClaimAge,
      survivor: { ...state.plan.survivor, whoDies: state.plan.survivor.whoDies ?? 'you' },
    }
  }
  // v11 → v12: brokerage cost basis (unknown = same as balance, i.e. no gains yet)
  if (version < 12) {
    state.plan = { ...state.plan, accounts: state.plan.accounts.map((a) => ({ ...a, costBasis: a.costBasis ?? null })) }
  }
  return state
}

/** Scenarios shown next to the base plan (each runs its own simulation). */
export const MAX_SCENARIOS = 3

/** Bump when the saved plan shape changes, and add a step to migratePlanState. */
export const PLAN_VERSION = 12

type UndoAction = 'cleared' | 'example' | 'imported'

interface PlanState {
  plan: Plan
  /** Plan before the last Clear / Load example, so it can be undone. Not saved to storage. */
  undo: { plan: Plan; action: UndoAction } | null
  update: (patch: Partial<Plan>) => void
  updateAssumptions: (patch: Partial<Plan['assumptions']>) => void
  updateHealthcare: (patch: Partial<Plan['healthcare']>) => void
  updateAnnuity: (patch: Partial<Plan['annuityPurchase']>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  addAccount: () => void
  removeAccount: (id: string) => void
  addIncome: () => void
  updateIncome: (id: string, patch: Partial<IncomeStream>) => void
  removeIncome: (id: string) => void
  addScenario: (scenario: Omit<Scenario, 'id' | 'slot'>) => void
  updateScenario: (id: string, patch: Partial<Scenario>) => void
  removeScenario: (id: string) => void
  clear: () => void
  loadExample: () => void
  importPlan: (plan: Plan) => void
  undoLast: () => void
}

// Saved in the browser's localStorage under "retirement-plan". Nothing leaves the device.
export const usePlanStore = create<PlanState>()(
  persist(
    (set) => {
      // Any edit drops the undo point: undo only reverses the last Clear / Load example.
      const edit = (fn: (plan: Plan) => Plan) => set((s) => ({ plan: fn(s.plan), undo: null }))
      return {
        plan: blankPlan,
        undo: null,
        update: (patch) => edit((p) => ({ ...p, ...patch })),
        updateAssumptions: (patch) => edit((p) => ({ ...p, assumptions: { ...p.assumptions, ...patch } })),
        updateHealthcare: (patch) => edit((p) => ({ ...p, healthcare: { ...p.healthcare, ...patch } })),
        updateAnnuity: (patch) => edit((p) => ({ ...p, annuityPurchase: { ...p.annuityPurchase, ...patch } })),
        updateAccount: (id, patch) =>
          edit((p) => ({ ...p, accounts: p.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
        addAccount: () =>
          edit((p) => ({
            ...p,
            accounts: [
              ...p.accounts,
              { id: crypto.randomUUID(), name: 'New account', type: 'taxable', balance: 0, annualContribution: 0, employerMatch: 0, costBasis: null },
            ],
          })),
        removeAccount: (id) => edit((p) => ({ ...p, accounts: p.accounts.filter((a) => a.id !== id) })),
        addIncome: () =>
          edit((p) => ({
            ...p,
            incomeStreams: [
              ...p.incomeStreams,
              {
                id: crypto.randomUUID(),
                name: 'Annuity',
                kind: 'annuity',
                annualAmount: 0,
                startAge: p.retirementAge,
                endAge: null,
                inflationAdjusted: false,
                taxableShare: 1,
                survivorShare: 1,
              },
            ],
          })),
        updateIncome: (id, patch) =>
          edit((p) => ({ ...p, incomeStreams: p.incomeStreams.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
        removeIncome: (id) => edit((p) => ({ ...p, incomeStreams: p.incomeStreams.filter((i) => i.id !== id) })),
        addScenario: (scenario) =>
          edit((p) => {
            if (p.scenarios.length >= MAX_SCENARIOS) return p
            const used = new Set(p.scenarios.map((sc) => sc.slot))
            const slot = [1, 2, 3].find((n) => !used.has(n))!
            return { ...p, scenarios: [...p.scenarios, { ...scenario, id: crypto.randomUUID(), slot }] }
          }),
        updateScenario: (id, patch) =>
          edit((p) => ({ ...p, scenarios: p.scenarios.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)) })),
        removeScenario: (id) => edit((p) => ({ ...p, scenarios: p.scenarios.filter((sc) => sc.id !== id) })),
        clear: () => set((s) => ({ plan: clearedPlan(s.plan), undo: { plan: s.plan, action: 'cleared' } })),
        loadExample: () => set((s) => ({ plan: examplePlan, undo: { plan: s.plan, action: 'example' } })),
        importPlan: (plan) => set((s) => ({ plan, undo: { plan: s.plan, action: 'imported' } })),
        undoLast: () => set((s) => (s.undo ? { plan: s.undo.plan, undo: null } : s)),
      }
    },
    {
      name: 'retirement-plan',
      version: PLAN_VERSION,
      partialize: (s) => ({ plan: s.plan }),
      migrate: (persisted, version) => migratePlanState(persisted, version) as PlanState,
    },
  ),
)
