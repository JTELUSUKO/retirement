import { CONFIG_2026, requiredMinimumDistribution, rmdStartAge } from '../engine'
import { extraIncomeTax, type ExtraIncomeTax, type Household } from './incomeTax'

const YEAR = CONFIG_2026.year
const TABLE = CONFIG_2026.rmd.uniformLifetimeTable

export interface RmdInputs extends Omit<Household, 'age'> {
  birthYear: number
  /** Traditional IRA / 401(k) balance on December 31 of last year */
  balance: number
  /** Expected yearly investment return, for the projection */
  annualReturn: number
}

export interface RmdYear {
  year: number
  /** Age reached during the year (the one the RMD divisor uses) */
  age: number
  startBalance: number
  divisor: number
  rmd: number
}

export interface RmdResult {
  /** Age reached in 2026 */
  age: number
  startAge: number
  /** Year of the first RMD */
  firstYear: number
  /** RMD for 2026 (0 before the start age) */
  rmd: number
  divisor: number | null
  /** RMD as a share of the balance */
  rate: number
  /** The first RMD can wait until April 1 of the next year (then two RMDs fall in one year) */
  firstYearGrace: boolean
  /** Deadline for this year's RMD */
  deadline: string
  /** RMDs from the first one (or this year) for up to 25 years, growing at annualReturn after each withdrawal */
  schedule: RmdYear[]
  /** Extra tax and Medicare surcharge from this year's RMD (null when there isn't one) */
  tax: ExtraIncomeTax | null
}

export function rmdCalculator(inputs: RmdInputs): RmdResult {
  const age = YEAR - inputs.birthYear
  const startAge = rmdStartAge(inputs.birthYear)
  const firstYear = inputs.birthYear + startAge
  const rmd = requiredMinimumDistribution(age, inputs.birthYear, inputs.balance)
  const divisor = age >= startAge ? (TABLE[Math.min(age, 110)] ?? null) : null

  // Grow the balance to the first RMD year, then withdraw each year's RMD before growth
  const schedule: RmdYear[] = []
  let balance = inputs.balance
  for (let year = YEAR; year < Math.max(firstYear, YEAR) + 25; year++) {
    const yearAge = year - inputs.birthYear
    if (yearAge > 110) break
    if (yearAge >= startAge) {
      const yearRmd = requiredMinimumDistribution(yearAge, inputs.birthYear, balance)
      schedule.push({ year, age: yearAge, startBalance: balance, divisor: TABLE[Math.min(yearAge, 110)], rmd: yearRmd })
      balance -= yearRmd
    }
    balance *= 1 + inputs.annualReturn
  }

  const firstYearGrace = firstYear === YEAR
  return {
    age,
    startAge,
    firstYear,
    rmd,
    divisor,
    rate: inputs.balance > 0 ? rmd / inputs.balance : 0,
    firstYearGrace,
    deadline: firstYearGrace ? `April 1, ${YEAR + 1}` : `December 31, ${YEAR}`,
    schedule,
    tax: rmd > 0 ? extraIncomeTax({ ...inputs, age }, rmd) : null,
  }
}
