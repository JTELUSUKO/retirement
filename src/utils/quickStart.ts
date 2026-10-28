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
 * type becomes one account holding the new totals (keeping the first account's name and the combined employer match;
 * cost basis is scaled with the balance so the share that is gains stays the same). A type set to zero is removed.
 */
export function applySavings(accounts: Account[], savings: QuickSavings): Account[] {
  const before = savingsFromPlan({ accounts } as Plan)
  let result = accounts
  for (const type of QUICK_ACCOUNT_TYPES) {
    const { balance, annualContribution } = savings[type]
    const old = before[type]
    if (balance === old.balance && annualContribution === old.annualContribution) continue
    const ofType = result.filter((a) => a.type === type)
    const first = ofType[0]
    const merged: Account | null =
      balance <= 0 && annualContribution <= 0
        ? null
        : first
          ? {
              ...first,
              balance,
              annualContribution,
              employerMatch: ofType.reduce((sum, a) => sum + a.employerMatch, 0),
              costBasis: scaledBasis(ofType, old.balance, balance),
            }
          : {
              id: crypto.randomUUID(),
              name: defaultAccountName(type, result.map((a) => a.name)),
              type,
              balance,
              annualContribution,
              employerMatch: 0,
              costBasis: null,
            }
    // The merged account takes the place of the first one of its type (or goes at the end for a new type)
    result = result.flatMap((a) => (a.type !== type ? [a] : a === first && merged ? [merged] : []))
    if (!first && merged) result = [...result, merged]
  }
  return result
}

/** Combined cost basis (null if none of the accounts tracks one), scaled from the old total balance to the new. */
function scaledBasis(ofType: Account[], oldBalance: number, newBalance: number): number | null {
  if (!ofType.some((a) => a.costBasis !== null)) return null
  const basis = ofType.reduce((sum, a) => sum + (a.costBasis ?? a.balance), 0)
  return oldBalance > 0 ? Math.round((basis * newBalance) / oldBalance) : newBalance
}
