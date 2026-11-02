import type { BigExpense, Plan } from './types'

/** Your age when an expense starts (a child's expense is timed by the child's age) */
export function expenseStartAge(plan: Plan, e: BigExpense): number {
  return e.childAgeNow === null ? e.startAge : plan.currentAge + (e.atChildAge - e.childAgeNow)
}

/** Cost of `e` at your `age`, in today's dollars before its extra growth (0 outside the years it's paid) */
export function expenseAt(plan: Plan, e: BigExpense, age: number): number {
  const start = expenseStartAge(plan, e)
  return age >= start && age < start + Math.max(e.years, 1) ? e.annualAmount : 0
}

/** Total cost of every big expense in today's dollars (no extra growth), for summaries */
export function bigExpensesTotal(plan: Plan): number {
  return plan.bigExpenses.reduce((sum, e) => sum + e.annualAmount * Math.max(e.years, 1), 0)
}
