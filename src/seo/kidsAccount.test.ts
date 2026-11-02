import { describe, expect, it } from 'vitest'
import { CAPITAL_MARKETS, medianReturn, TAX_CONFIG } from '../engine'
import { allowedContributions, kidsAccount, KIDS_ACCOUNT_DEFAULTS } from './kidsAccount'

const K = TAX_CONFIG.kidsAccount
const Y = TAX_CONFIG.year
const { mean, volatility } = CAPITAL_MARKETS.stocks
const real = (fee: number, inflation: number) => ((1 + medianReturn(mean, volatility)) / (1 + inflation) - 1 + 1) * (1 - fee) - 1

describe("children's investment account", () => {
  it('a newborn gets 18 years of contributions plus the deposit, matching the annuity-due formula', () => {
    const r = kidsAccount(KIDS_ACCOUNT_DEFAULTS)
    const g = real(KIDS_ACCOUNT_DEFAULTS.fee, KIDS_ACCOUNT_DEFAULTS.inflation)
    const n = K.accessAge
    const contributions = KIDS_ACCOUNT_DEFAULTS.family * (1 + g) * (((1 + g) ** n - 1) / g)
    const deposit = K.pilotAmount * (1 + g) ** n
    expect(r.years).toBe(n)
    expect(r.depositEligible).toBe(true)
    expect(r.atAccess.typical).toBeCloseTo(contributions + deposit, 6)
    expect(r.totals).toEqual({ family: 18_000, employer: 0, deposit: K.pilotAmount })
    expect(r.schedule).toHaveLength(n)
    expect(r.schedule[0]).toMatchObject({ age: 0, added: KIDS_ACCOUNT_DEFAULTS.family + K.pilotAmount })
  })

  it('left invested with nothing more added, it compounds to the later age', () => {
    const r = kidsAccount(KIDS_ACCOUNT_DEFAULTS)
    const g = real(KIDS_ACCOUNT_DEFAULTS.fee, KIDS_ACCOUNT_DEFAULTS.inflation)
    expect(r.atLater.typical).toBeCloseTo(r.atAccess.typical * (1 + g) ** (65 - 18), 4)
    expect(r.depositAloneLater).toBeCloseTo(K.pilotAmount * (1 + g) ** 65, 6)
  })

  it('the simulated range spreads around the typical value', () => {
    const r = kidsAccount(KIDS_ACCOUNT_DEFAULTS)
    expect(r.atAccess.poor).toBeLessThan(r.atAccess.typical)
    expect(r.atAccess.good).toBeGreaterThan(r.atAccess.typical)
    expect(r.atLater.good / r.atLater.poor).toBeGreaterThan(r.atAccess.good / r.atAccess.poor)
  })

  it('only children born in the deposit years get the $1,000, and only if claimed', () => {
    const older = kidsAccount({ ...KIDS_ACCOUNT_DEFAULTS, birthYear: K.pilotBirthYears[0] - 1 })
    expect(older.depositEligible).toBe(false)
    expect(older.totals.deposit).toBe(0)
    expect(kidsAccount({ ...KIDS_ACCOUNT_DEFAULTS, claimDeposit: false }).totals.deposit).toBe(0)
  })

  it('a 17-year-old has one year left; an 18-year-old is too old', () => {
    expect(kidsAccount({ ...KIDS_ACCOUNT_DEFAULTS, birthYear: Y - 17 }).years).toBe(1)
    const r = kidsAccount({ ...KIDS_ACCOUNT_DEFAULTS, birthYear: Y - 18 })
    expect(r.tooOld).toBe(true)
    expect(r.years).toBe(0)
    expect(r.atAccess.typical).toBe(0)
  })

  it('caps the employer at its limit and the total at the yearly limit', () => {
    expect(allowedContributions(4_000, 3_000)).toEqual({ family: K.annualLimit - K.employerLimit, employer: K.employerLimit })
    expect(allowedContributions(6_000, 0)).toEqual({ family: K.annualLimit, employer: 0 })
    expect(allowedContributions(1_000, 1_000)).toEqual({ family: 1_000, employer: 1_000 })
  })
})
