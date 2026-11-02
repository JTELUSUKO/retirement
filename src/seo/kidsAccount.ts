import { CAPITAL_MARKETS, medianReturn, TAX_CONFIG } from '../engine'
import { MAX_YEARS, RUNS, simulatedMarkets } from './moneyLast'

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
  /** Age the child reaches this year */
  ageNow: number
  /** Too old to open one (they must not turn 18 before the end of this year) */
  tooOld: boolean
  depositEligible: boolean
  /** Years of contributions left (this year through the year they turn 17) */
  years: number
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

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

/** Yearly contributions allowed: employer up to its own cap, and the two together up to the yearly cap. */
export function allowedContributions(family: number, employer: number): { family: number; employer: number } {
  const e = Math.min(Math.max(employer, 0), K.employerLimit)
  return { family: Math.min(Math.max(family, 0), K.annualLimit - e), employer: e }
}

export function kidsAccount(inputs: KidsAccountInputs): KidsAccountResult {
  const year = TAX_CONFIG.year
  const ageNow = year - inputs.birthYear
  const tooOld = ageNow >= K.accessAge
  const [firstBirthYear, lastBirthYear] = K.pilotBirthYears
  const depositEligible = inputs.birthYear >= firstBirthYear && inputs.birthYear <= lastBirthYear
  const deposit = depositEligible && inputs.claimDeposit ? K.pilotAmount : 0
  const { family, employer } = allowedContributions(inputs.family, inputs.employer)
  const years = Math.max(0, K.accessAge - ageNow)
  const toLater = Math.max(years, inputs.laterAge - ageNow)

  // Only US stock index funds are allowed while the child is under 18; the same mix is assumed after
  const { mean, volatility } = CAPITAL_MARKETS.stocks
  const afterFee = (real: number) => (1 + real) * (1 - inputs.fee) - 1
  const typicalReal = afterFee((1 + medianReturn(mean, volatility)) / (1 + inputs.inflation) - 1)

  /** Balances at the end of each year from this year, money going in at the start of the year */
  const path = (real: (t: number) => number, added = (t: number) => (t < years ? family + employer : 0) + (t === 0 ? deposit : 0)) => {
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
    const values = simulated.map((b) => at(b, t))
    return { typical: at(typical, t), poor: percentile(values, 0.1), good: percentile(values, 0.9) }
  }

  const depositAlone = path(() => typicalReal, (t) => (t === 0 ? K.pilotAmount : 0))

  return {
    ageNow,
    tooOld,
    depositEligible,
    years,
    totals: { family: family * years, employer: employer * years, deposit: years > 0 ? deposit : 0 },
    atAccess: range(years),
    atLater: range(toLater),
    depositAloneLater: at(depositAlone, toLater),
    schedule: typical.slice(0, years).map((balance, t) => ({
      age: ageNow + t,
      added: family + employer + (t === 0 ? deposit : 0),
      balance,
    })),
  }
}

/** The calculator page starts with these values (the browser tests check results for them too). */
export const KIDS_ACCOUNT_DEFAULTS: KidsAccountInputs = {
  birthYear: TAX_CONFIG.year,
  family: 1_000,
  employer: 0,
  claimDeposit: true,
  fee: 0.0003,
  inflation: 0.025,
  laterAge: 65,
}
