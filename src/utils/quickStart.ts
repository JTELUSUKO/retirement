import type { Account, AccountType, Plan } from '../engine'
import { defaultAccountName } from './labels'

/** Account types offered in the guided setup, in order. */
export const QUICK_ACCOUNT_TYPES: AccountType[] = ['401k', 'traditional-ira', 'roth', 'hsa', 'taxable', 'cash']

export type QuickSavings = Record<AccountType, { balance: number; annualContribution: number }>

/** True for a plan nobody has started filling in. */
export const isBlankPlan = (plan: Plan) =>
  plan.currentAge === 0 && plan.retirementAge === 0 && plan.annualSpending === 0 && plan.accounts.length === 0

/** One entry per type, from the first account of that type. */
export function savingsFromPlan(plan: Plan): QuickSavings {
  return Object.fromEntries(
    QUICK_ACCOUNT_TYPES.map((type) => {
      const acc = plan.accounts.find((a) => a.type === type)
      return [type, { balance: acc?.balance ?? 0, annualContribution: acc?.annualContribution ?? 0 }]
    }),
  ) as QuickSavings
}

/** Write the guided-setup savings into the accounts: update the first account of each type, or add one. */
export function applySavings(accounts: Account[], savings: QuickSavings): Account[] {
  const result = [...accounts]
  for (const type of QUICK_ACCOUNT_TYPES) {
    const { balance, annualContribution } = savings[type]
    const i = result.findIndex((a) => a.type === type)
    if (i >= 0) {
      result[i] = { ...result[i], balance, annualContribution }
    } else if (balance > 0 || annualContribution > 0) {
      result.push({
        id: crypto.randomUUID(),
        name: defaultAccountName(type, result.map((a) => a.name)),
        type,
        balance,
        annualContribution,
        employerMatch: 0,
        costBasis: null,
      })
    }
  }
  return result
}
