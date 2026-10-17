import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, Plan } from '../engine'

export const defaultPlan: Plan = {
  currentAge: 55,
  retirementAge: 65,
  lifeExpectancy: 95,
  accounts: [
    { id: '1', name: '401(k)', type: '401k', balance: 450_000, annualContribution: 24_500, employerMatch: 6_000 },
    { id: '2', name: 'Roth IRA', type: 'roth', balance: 80_000, annualContribution: 7_500, employerMatch: 0 },
  ],
  annualSpending: 70_000,
  socialSecurityAtFRA: 2_800,
  socialSecurityClaimAge: 67,
  annualPension: 0,
  assumptions: {
    returnPreRetirement: 0.07,
    returnPostRetirement: 0.05,
    volatilityPreRetirement: 0.15,
    volatilityPostRetirement: 0.1,
    inflation: 0.025,
  },
}

interface PlanState {
  plan: Plan
  update: (patch: Partial<Plan>) => void
  updateAssumptions: (patch: Partial<Plan['assumptions']>) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  addAccount: () => void
  removeAccount: (id: string) => void
  reset: () => void
}

// Saved in the browser's localStorage under "retirement-plan". Nothing leaves the device.
export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: defaultPlan,
      update: (patch) => set((s) => ({ plan: { ...s.plan, ...patch } })),
      updateAssumptions: (patch) =>
        set((s) => ({ plan: { ...s.plan, assumptions: { ...s.plan.assumptions, ...patch } } })),
      updateAccount: (id, patch) =>
        set((s) => ({
          plan: { ...s.plan, accounts: s.plan.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) },
        })),
      addAccount: () =>
        set((s) => ({
          plan: {
            ...s.plan,
            accounts: [
              ...s.plan.accounts,
              { id: crypto.randomUUID(), name: 'New account', type: 'taxable', balance: 0, annualContribution: 0, employerMatch: 0 },
            ],
          },
        })),
      removeAccount: (id) =>
        set((s) => ({ plan: { ...s.plan, accounts: s.plan.accounts.filter((a) => a.id !== id) } })),
      reset: () => set({ plan: defaultPlan }),
    }),
    {
      name: 'retirement-plan',
      version: 2,
      // v1 plans have no volatility assumptions; fill them from the defaults.
      migrate: (persisted, version) => {
        const state = persisted as { plan: Plan }
        if (version < 2) {
          state.plan.assumptions = { ...defaultPlan.assumptions, ...state.plan.assumptions }
        }
        return state as PlanState
      },
    },
  ),
)
