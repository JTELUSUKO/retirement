import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, IncomeStream, Plan } from '../engine'

export const defaultPlan: Plan = {
  filingStatus: 'single',
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 95,
  accounts: [
    { id: '1', name: '401(k)', type: '401k', balance: 450_000, annualContribution: 24_500, employerMatch: 6_000 },
    { id: '2', name: 'Roth IRA', type: 'roth', balance: 80_000, annualContribution: 7_500, employerMatch: 0 },
    { id: '3', name: 'Brokerage', type: 'taxable', balance: 60_000, annualContribution: 6_000, employerMatch: 0 },
    { id: '4', name: 'Emergency fund', type: 'cash', balance: 30_000, annualContribution: 0, employerMatch: 0 },
  ],
  annualSpending: 60_000,
  socialSecurityAtFRA: 2_800,
  socialSecurityClaimAge: 67,
  incomeStreams: [],
  healthcare: { preMedicareAnnual: 12_000, medicareAnnual: 7_000, excessInflation: 0.02 },
  assumptions: {
    returnPreRetirement: 0.07,
    returnPostRetirement: 0.05,
    volatilityPreRetirement: 0.15,
    volatilityPostRetirement: 0.1,
    inflation: 0.025,
  },
}

/** Keeps ages, filing status, healthcare estimates and assumptions; removes accounts and zeroes income and spending. */
export const clearedPlan = (plan: Plan): Plan => ({
  ...plan,
  accounts: [],
  annualSpending: 0,
  socialSecurityAtFRA: 0,
  incomeStreams: [],
})

/** Upgrade a plan saved by an older version of the app. */
export function migratePlanState(persisted: unknown, version: number): { plan: Plan } {
  const state = persisted as { plan: Plan }
  // v1 → v2: volatility assumptions added
  if (version < 2) {
    state.plan.assumptions = { ...defaultPlan.assumptions, ...state.plan.assumptions }
  }
  // v2 → v3: filing status added
  if (version < 3) {
    state.plan = { ...state.plan, filingStatus: state.plan.filingStatus ?? 'single' }
  }
  // v3 → v4: healthcare costs added (spending now excludes healthcare)
  if (version < 4) {
    state.plan = { ...state.plan, healthcare: state.plan.healthcare ?? defaultPlan.healthcare }
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
    }
    state.plan = { ...rest, incomeStreams: annualPension > 0 ? [pension] : [] }
  }
  return state
}

/** Bump when the saved plan shape changes, and add a step to migratePlanState. */
export const PLAN_VERSION = 5

type UndoAction = 'cleared' | 'example' | 'imported'

interface PlanState {
  plan: Plan
  /** Plan before the last Clear / Load example, so it can be undone. Not saved to storage. */
  undo: { plan: Plan; action: UndoAction } | null
  update: (patch: Partial<Plan>) => void
  updateAssumptions: (patch: Partial<Plan['assumptions']>) => void
  updateHealthcare: (patch: Partial<Plan['healthcare']>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  addAccount: () => void
  removeAccount: (id: string) => void
  addIncome: () => void
  updateIncome: (id: string, patch: Partial<IncomeStream>) => void
  removeIncome: (id: string) => void
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
        plan: defaultPlan,
        undo: null,
        update: (patch) => edit((p) => ({ ...p, ...patch })),
        updateAssumptions: (patch) => edit((p) => ({ ...p, assumptions: { ...p.assumptions, ...patch } })),
        updateHealthcare: (patch) => edit((p) => ({ ...p, healthcare: { ...p.healthcare, ...patch } })),
        updateAccount: (id, patch) =>
          edit((p) => ({ ...p, accounts: p.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
        addAccount: () =>
          edit((p) => ({
            ...p,
            accounts: [
              ...p.accounts,
              { id: crypto.randomUUID(), name: 'New account', type: 'taxable', balance: 0, annualContribution: 0, employerMatch: 0 },
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
              },
            ],
          })),
        updateIncome: (id, patch) =>
          edit((p) => ({ ...p, incomeStreams: p.incomeStreams.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
        removeIncome: (id) => edit((p) => ({ ...p, incomeStreams: p.incomeStreams.filter((i) => i.id !== id) })),
        clear: () => set((s) => ({ plan: clearedPlan(s.plan), undo: { plan: s.plan, action: 'cleared' } })),
        loadExample: () => set((s) => ({ plan: defaultPlan, undo: { plan: s.plan, action: 'example' } })),
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
