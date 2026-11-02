import { TAX_CONFIG } from './config/taxYear'
import type { BigExpense, Plan } from './types'

/** Your age when an expense starts (a child's expense is timed by the child's age) */
export function expenseStartAge(plan: Plan, e: BigExpense): number {
  return e.childAgeNow === null ? e.startAge : plan.currentAge + (e.atChildAge - e.childAgeNow)
}

/** Years it's paid (at least one) */
export const expenseYears = (e: BigExpense) => Math.max(e.years, 1)

/** Cost per year in today's dollars: a college preset follows the current yearly figures, otherwise your amount */
export const expenseAmount = (e: BigExpense) =>
  e.kind === 'college' && e.collegeType ? TAX_CONFIG.bigExpenses.college[e.collegeType] : e.annualAmount

/** Cost of `e` at your `age`, in today's dollars before its extra growth (0 outside the years it's paid) */
export function expenseAt(plan: Plan, e: BigExpense, age: number): number {
  const start = expenseStartAge(plan, e)
  return age >= start && age < start + expenseYears(e) ? expenseAmount(e) : 0
}

/** One expense's total in today's dollars (no extra growth) */
export const expenseTotal = (e: BigExpense) => expenseAmount(e) * expenseYears(e)

/** Total cost of every big expense in today's dollars (no extra growth), for summaries */
export function bigExpensesTotal(plan: Plan): number {
  return plan.bigExpenses.reduce((sum, e) => sum + expenseTotal(e), 0)
}
