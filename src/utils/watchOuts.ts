import type { Plan, ProjectionResult, YearResult } from '../engine'
import { formatUSD } from './format'

export interface WatchOut {
  key: 'penalty' | 'rmd-bracket' | 'roth-window' | 'irmaa' | 'big-expense-early'
  /** Age it starts, for ordering */
  age: number
  /** A cost to look at, or an opportunity */
  tone: 'warn' | 'info'
  text: string
}

const rate = (r: number) => `${Math.round(r * 100)}%`
const ages = (from: number, to: number) => (from === to ? `age ${from}` : `ages ${from}–${to}`)

/**
 * Tax and Medicare points worth a look in the typical-returns projection: facts about this plan, not advice.
 * Only years while the money lasts count (after that, the projection has nothing to draw on).
 */
export function watchOuts(plan: Plan, result: ProjectionResult): WatchOut[] {
  const lastAge = result.depletionAge ?? Infinity
  const retired = result.years.filter((y) => y.age >= plan.retirementAge && y.age < lastAge)
  const at = (age: number) => retired.find((y) => y.age === age)
  const out: WatchOut[] = []

  // Big expenses before retiring that reach retirement accounts (pre-tax or Roth), with their taxes and penalty
  const early = result.years.filter(
    (y) => y.age < plan.retirementAge && y.age < lastAge && y.bigExpenses > 0 && fromRetirementAccounts(y) > 0,
  )
  if (early.length > 0) {
    const fromRetirement = early.reduce((sum, y) => sum + fromRetirementAccounts(y) / y.priceLevel, 0)
    const taxes = early.reduce((sum, y) => sum + y.tax / y.priceLevel, 0)
    out.push({
      key: 'big-expense-early',
      age: early[0].age,
      tone: 'warn',
      text: `Big expenses at ${ages(early[0].age, early.at(-1)!.age)} take about ${formatUSD(fromRetirement)} out of retirement accounts before you retire${taxes > 0 ? `, costing about ${formatUSD(taxes)} in taxes and penalties` : ''} (today’s dollars). Saving for them in cash, a brokerage account or a 529 avoids that.`,
    })
  }

  const penalized = retired.filter((y) => y.earlyWithdrawalPenalty > 0)
  if (penalized.length > 0) {
    const total = penalized.reduce((sum, y) => sum + y.earlyWithdrawalPenalty / y.priceLevel, 0)
    out.push({
      key: 'penalty',
      age: penalized[0].age,
      tone: 'warn',
      text: `You pay the 10% early-withdrawal penalty on pre-tax savings at ${ages(penalized[0].age, penalized.at(-1)!.age)}, about ${formatUSD(total)} in today’s dollars. Savings in cash or a taxable account cover those years without it, and some IRS exceptions apply (for example, leaving your employer at 55 or later).`,
    })
  }

  // RMDs push income up: compare the first RMD year with the year before. Only when the RMD is what changed: more
  // pre-tax withdrawals, no new income (a pension starting, Social Security) and the same filing status
  const start = result.rmdStartAge
  const before = at(start - 1)
  const first = at(start)
  const real = (y: YearResult, n: number) => n / y.priceLevel
  const rmdCaused =
    before !== undefined &&
    first !== undefined &&
    first.rmd > 0 &&
    first.widowed === before.widowed &&
    first.withdrawalsByBucket.pretax > before.withdrawalsByBucket.pretax &&
    real(first, first.income) <= real(before, before.income) * 1.01
  if (rmdCaused && first.federalBracket > before.federalBracket) {
    out.push({
      key: 'rmd-bracket',
      age: start,
      tone: 'warn',
      text: `Required minimum distributions start at ${start} and move you from the ${rate(before.federalBracket)} to the ${rate(first.federalBracket)} federal tax bracket.`,
    })
  }

  // Lower-bracket years before RMDs, with pre-tax money still there to convert: room for Roth conversions, if they
  // aren't on already. Compared with the bracket in the first RMD year
  if (!plan.rothConversion.enabled && first && first.rmd > 0 && first.federalBracket > 0) {
    const candidates = retired.filter((y) => y.age < start && y.startByBucketReal.pretax > 0)
    const window = lowRun(candidates, first.federalBracket)
    if (window) {
      const top = Math.max(...window.map((y) => y.federalBracket))
      out.push({
        key: 'roth-window',
        age: window[0].age,
        tone: 'info',
        text: `At ${ages(window[0].age, window.at(-1)!.age)} your federal tax bracket is ${top === 0 ? '0%' : `${rate(top)} or lower`}, below the ${rate(first.federalBracket)} when RMDs start at ${start}. Converting some pre-tax savings to Roth in those years could lower later taxes. Try it under Tax strategy.`,
      })
    }
  }

  const surcharged = retired.find((y) => y.irmaa > 0)
  if (surcharged) {
    out.push({
      key: 'irmaa',
      age: surcharged.age,
      tone: 'warn',
      text: `Medicare income surcharges (IRMAA) start at ${surcharged.age}: about ${formatUSD(surcharged.irmaa / surcharged.priceLevel)} that year in today’s dollars, based on your income two years earlier.`,
    })
  }

  return out.sort((a, b) => a.age - b.age)
}

/** Pre-tax (beyond any RMD), Roth and HSA money taken out in a year */
const fromRetirementAccounts = (y: YearResult) => y.withdrawalsByBucket.pretax - y.rmd + y.withdrawalsByBucket.roth + y.withdrawalsByBucket.hsa

/** The first run of consecutive years in a bracket below `rate`, or null. */
function lowRun(years: YearResult[], rate: number): YearResult[] | null {
  const startAt = years.findIndex((y) => y.federalBracket < rate)
  if (startAt < 0) return null
  const run: YearResult[] = []
  for (const y of years.slice(startAt)) {
    if (y.federalBracket >= rate || (run.length > 0 && y.age !== run.at(-1)!.age + 1)) break
    run.push(y)
  }
  return run
}
