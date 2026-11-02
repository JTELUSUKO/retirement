import { CAPITAL_MARKETS, medianReturn, TAX_CONFIG } from '../engine'
import { MAX_YEARS, percentile, RUNS, simulatedMarkets } from './moneyLast'

const K = TAX_CONFIG.kidsAccount

export interface KidsAccountInputs {
  /** Child's birth year */
  birthYear: number
  /** Yearly contributions from family and friends, today's dollars */
  family: number
  /** Yearly contributions from a parent's employer, today's dollars */
  employer: number
  /** Ask for the one-time federal deposit (only paid for eligible birth years) */
  claimDeposit: boolean
  /** Fund's yearly expense ratio */
  fee: number
  inflation: number
  /** The later age to show, if the money stays invested after 18 */
  laterAge: number
}

export interface Range {
  /** With typical (median) stock returns every year */
  typical: number
  /** 10th and 90th percentile across the simulated markets */
  poor: number
  good: number
}

export interface KidsAccountYear {
  /** The age the child reaches this year */
  age: number
  /** Put in this year (family + employer + any deposit), today's dollars */
  added: number
  /** Value at the end of the year with typical returns, today's dollars */
  balance: number
}

export interface KidsAccountResult {
  /** First year of the account: this year, or the birth year for a child not born yet */
  startYear: number
  /** Age the child reaches in the start year */
  ageNow: number
  /** Too old to open one (they must not turn 18 before the end of this year) */
  tooOld: boolean
  depositEligible: boolean
  /** Years of contributions left (the start year through the year they turn 17) */
  years: number
  /** Contributions allowed in the first year (within the limits), today's dollars */
  firstYear: { family: number; employer: number }
  /** Totals put in, today's dollars */
  totals: { family: number; employer: number; deposit: number }
  /** When withdrawals open (January 1 of the year they turn 18) */
  atAccess: Range
  /** At `laterAge`, left invested with nothing more added */
  atLater: Range
  /** The federal deposit alone, left invested to `laterAge` (typical returns) */
  depositAloneLater: number
  schedule: KidsAccountYear[]
}

/**
 * Yearly contributions allowed: employer up to its own cap, and the two together up to the yearly cap. `scale` is the
 * caps' value in today's dollars that year (the dollar limits are fixed for a while before they follow inflation).
 */
export function allowedContributions(family: number, employer: number, scale = 1): { family: number; employer: number } {
  const e = Math.min(Math.max(employer, 0), K.employerLimit * scale)
  return { family: Math.min(Math.max(family, 0), K.annualLimit * scale - e), employer: e }
}

export function kidsAccount(inputs: KidsAccountInputs): KidsAccountResult {
  const year = TAX_CONFIG.year
  const tooOld = year - inputs.birthYear >= K.accessAge
  // A child not born yet starts in their birth year (the deposit years run ahead of the tax year)
  const startYear = Math.max(year, inputs.birthYear)
  const ageNow = startYear - inputs.birthYear
  const [firstBirthYear, lastBirthYear] = K.pilotBirthYears
  const depositEligible = inputs.birthYear >= firstBirthYear && inputs.birthYear <= lastBirthYear
  const deposit = depositEligible && inputs.claimDeposit ? K.pilotAmount : 0
  const years = tooOld ? 0 : K.accessAge - ageNow
  const toLater = Math.max(years, inputs.laterAge - ageNow)

  // Amounts are in today's dollars: a limit fixed in dollars shrinks with inflation until it starts following it
  const scale = (t: number) => (1 + inputs.inflation) ** -Math.max(0, Math.min(startYear + t, K.limitsFixedThrough) - year)
  const contributions = Array.from({ length: years }, (_, t) => allowedContributions(inputs.family, inputs.employer, scale(t)))

  // Only US stock index funds are allowed while the child is under 18; the same mix is assumed after
  const { mean, volatility } = CAPITAL_MARKETS.stocks
  const afterFee = (real: number) => (1 + real) * (1 - inputs.fee) - 1
  const typicalReal = afterFee((1 + medianReturn(mean, volatility)) / (1 + inputs.inflation) - 1)

  const added = (t: number) => (t < years ? contributions[t].family + contributions[t].employer : 0) + (t === 0 && years > 0 ? deposit : 0)
  /** Balances at the end of each year from the start year, money going in at the start of the year */
  const path = (real: (t: number) => number) => {
    const balances: number[] = []
    let balance = 0
    for (let t = 0; t < toLater; t++) {
      balance = (balance + added(t)) * (1 + real(t))
      balances.push(balance)
    }
    return balances
  }
  // After `years` years it's January 1 of the year they turn 18; after `toLater`, of the year they reach laterAge
  const at = (balances: number[], t: number) => (t > 0 ? balances[t - 1] : 0)

  const typical = path(() => typicalReal)
  const markets = simulatedMarkets(mean, volatility, inputs.inflation, MAX_YEARS)
  const simulated = markets.slice(0, RUNS).map((m) => path((t) => afterFee(m[t])))
  const range = (t: number): Range => {
    const values = simulated.map((b) => at(b, t)).sort((x, y) => x - y)
    return { typical: at(typical, t), poor: percentile(values, 0.1), good: percentile(values, 0.9) }
  }
  const sum = (key: 'family' | 'employer') => contributions.reduce((total, c) => total + c[key], 0)

  return {
    startYear,
    ageNow,
    tooOld,
    depositEligible,
    years,
    firstYear: contributions[0] ?? { family: 0, employer: 0 },
    totals: { family: sum('family'), employer: sum('employer'), deposit: years > 0 ? deposit : 0 },
    atAccess: range(years),
    atLater: range(toLater),
    depositAloneLater: K.pilotAmount * (1 + typicalReal) ** toLater,
    schedule: typical.slice(0, years).map((balance, t) => ({ age: ageNow + t, added: added(t), balance })),
  }
}

/** The calculator page starts with these values (the browser tests check results for them too). */
export const KIDS_ACCOUNT_DEFAULTS: KidsAccountInputs = {
  // A child born this year, or the youngest with the deposit once those birth years are past
  birthYear: Math.min(Math.max(TAX_CONFIG.year, TAX_CONFIG.kidsAccount.pilotBirthYears[0]), TAX_CONFIG.kidsAccount.pilotBirthYears[1]),
  family: 1_000,
  employer: 0,
  claimDeposit: true,
  fee: 0.0003,
  inflation: 0.025,
  laterAge: 65,
}
