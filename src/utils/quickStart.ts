import type { Account, AccountType, Plan } from '../engine'
import { defaultAccountName } from './labels'

/** Account types offered in the guided setup, in order. */
export const QUICK_ACCOUNT_TYPES: AccountType[] = ['401k', 'traditional-ira', 'roth', 'hsa', 'taxable', 'cash']

export type QuickSavings = Record<AccountType, { balance: number; annualContribution: number }>

/** True for a plan nobody has started filling in. */
export const isBlankPlan = (plan: Plan) =>
  plan.currentAge === 0 && plan.retirementAge === 0 && plan.annualSpending === 0 && plan.accounts.length === 0

/** Combined balance and yearly contribution for each type (all accounts of that type added together). */
export function savingsFromPlan(plan: Plan): QuickSavings {
  return Object.fromEntries(
    QUICK_ACCOUNT_TYPES.map((type) => {
      const ofType = plan.accounts.filter((a) => a.type === type)
      return [
        type,
        {
          balance: ofType.reduce((sum, a) => sum + a.balance, 0),
          annualContribution: ofType.reduce((sum, a) => sum + a.annualContribution, 0),
        },
      ]
    }),
  ) as QuickSavings
}

/**
 * Write the guided-setup totals into the accounts. A type whose totals didn't change is left as it is. A changed
 * type becomes one account holding the new totals (keeping the first account's name, plus the combined employer
 * match and cost basis); a type set to zero is removed.
 */
export function applySavings(accounts: Account[], savings: QuickSavings): Account[] {
  const before = savingsFromPlan({ accounts } as Plan)
  let result = [...accounts]
  for (const type of QUICK_ACCOUNT_TYPES) {
    const { balance, annualContribution } = savings[type]
    if (balance === before[type].balance && annualContribution === before[type].annualContribution) continue
    const ofType = result.filter((a) => a.type === type)
    const employerMatch = ofType.reduce((sum, a) => sum + a.employerMatch, 0)
    const costBasis = ofType.some((a) => a.costBasis !== null) ? ofType.reduce((sum, a) => sum + (a.costBasis ?? a.balance), 0) : null
    const keep = balance > 0 || annualContribution > 0 || employerMatch > 0
    const merged: Account | null = !keep
      ? null
      : ofType[0]
        ? { ...ofType[0], balance, annualContribution, employerMatch, costBasis }
        : {
            id: crypto.randomUUID(),
            name: defaultAccountName(type, result.map((a) => a.name)),
            type,
            balance,
            annualContribution,
            employerMatch: 0,
            costBasis: null,
          }
    // The merged account takes the place of the first one of its type
    const at = ofType[0] ? result.indexOf(ofType[0]) : result.length
    result = result.filter((a) => a.type !== type || a === ofType[0])
    if (ofType[0]) result.splice(result.indexOf(ofType[0]), 1, ...(merged ? [merged] : []))
    else if (merged) result.splice(at, 0, merged)
  }
  return result
}
