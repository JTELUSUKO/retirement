import { TAX_CONFIG, federalIncomeTax, irmaaPerPersonYearly, stateIncomeTax, type FilingStatus } from '../engine'

// Shared by the calculator pages: the extra 2026 federal and state tax (and Medicare surcharge) caused by adding
// retirement income such as a Roth conversion or an RMD to a household's other income.

const T = TAX_CONFIG.federalTax

export interface Household {
  status: FilingStatus
  /** Two-letter state code, '' for none */
  state: string
  /** Age this year (for married couples, both are treated as this age) */
  age: number
  /** Other ordinary income this year: wages, pension, IRA withdrawals, interest */
  otherIncome: number
  /** Social Security benefits received this year (household) */
  socialSecurity: number
}

export interface TaxSnapshot {
  federal: number
  state: number
  /** Adjusted gross income, which is also the MAGI Medicare uses for IRMAA */
  magi: number
  taxableOrdinary: number
  taxableSocialSecurity: number
}

export interface ExtraIncomeTax {
  before: TaxSnapshot
  after: TaxSnapshot
  extraFederal: number
  extraState: number
  extraTax: number
  /** extraTax ÷ the added income */
  effectiveRate: number
  /** Federal bracket of the last added dollar (0 when deductions cover it all) */
  topBracket: number
  /** Income that can still be added before the next federal bracket (Infinity in the top bracket) */
  roomInBracket: number
  /** Costs on top of the bracket rate that the added income triggers */
  alsoCosts: { socialSecurity: boolean; seniorDeduction: boolean }
  /**
   * Medicare income surcharge (IRMAA) two years later, for everyone on the return (only when they'll be 65+ by then).
   * Yearly amounts at 2026 tiers; roomInTier is income that can be added before the next tier (Infinity in the top one).
   */
  irmaa: { applies: boolean; people: number; beforeYearly: number; afterYearly: number; extraYearly: number; roomInTier: number }
}

export const federalTax = (h: Household, extra: number) =>
  federalIncomeTax({
    ordinaryIncome: h.otherIncome + extra,
    socialSecurity: h.socialSecurity,
    age: h.age,
    year: TAX_CONFIG.year,
    status: h.status,
    priceLevel: 1,
  })

/** Federal and state tax with `extra` retirement income (an IRA distribution) added to the household's income. */
export function taxSnapshot(h: Household, extra: number): TaxSnapshot {
  const ordinaryIncome = h.otherIncome + extra
  const fed = federalTax(h, extra)
  // No capital gains here, so AGI is ordinary income plus taxable Social Security
  const taxableSs = fed.agi - ordinaryIncome
  const state = stateIncomeTax({
    state: h.state,
    status: h.status,
    age: h.age,
    ordinaryIncome,
    // An IRA distribution is retirement income, so states that exempt it at this age exempt it here too
    retirementIncome: extra,
    taxableSocialSecurity: taxableSs,
    retirementExclusionPerPerson: 0,
    priceLevel: 1,
  })
  return { federal: fed.tax, state, magi: fed.agi, taxableOrdinary: fed.taxableOrdinary, taxableSocialSecurity: taxableSs }
}

/** Within this many dollars of a bracket's top still counts as that bracket ("fill" amounts are rounded up). */
const ROUNDING = 2

/** Federal bracket of the last dollar of taxable ordinary income; rate 0 (top 0) while deductions cover it all. */
function bracketOf(taxableOrdinary: number, status: FilingStatus): { rate: number; top: number } {
  if (taxableOrdinary <= ROUNDING) return { rate: 0, top: 0 }
  for (const [top, rate] of T.brackets[status]) if (taxableOrdinary <= top + ROUNDING) return { rate, top }
  return { rate: 0.37, top: Infinity }
}

/** Smallest added income that brings taxable ordinary income above `target` (0 if `baseTaxable` already is). */
export function incomeToReach(h: Household, target: number, baseTaxable: number): number {
  if (baseTaxable >= target) return 0
  let lo = 0
  let hi = target + h.socialSecurity + 100_000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (federalTax(h, mid).taxableOrdinary >= target) hi = mid
    else lo = mid
  }
  return Math.ceil(lo)
}

/** Whether income from `before` to `after` falls in the senior deduction's phase-out range (65+, 2025–2028). */
function shrinksSeniorDeduction(h: Household, before: number, after: number): boolean {
  const { amount, lastYear, phaseOutStart, phaseOutRate } = T.seniorDeduction
  const start = phaseOutStart[h.status]
  const fullyPhasedOut = start + amount / phaseOutRate
  return h.age >= TAX_CONFIG.medicare.eligibilityAge && TAX_CONFIG.year <= lastYear && after > start && before < fullyPhasedOut
}

/** The extra tax and Medicare surcharge from adding `extra` retirement income this year. */
export function extraIncomeTax(h: Household, extra: number): ExtraIncomeTax {
  const before = taxSnapshot(h, 0)
  const after = taxSnapshot(h, extra)
  const extraFederal = after.federal - before.federal
  const extraState = after.state - before.state
  const extraTax = extraFederal + extraState

  const { rate: topBracket, top } = bracketOf(after.taxableOrdinary, h.status)
  // At 0%, the room is what's left of the deductions (until the first taxable dollar)
  const roomInBracket = top === Infinity ? Infinity : Math.max(incomeToReach(h, Math.max(top, 1), before.taxableOrdinary) - extra, 0)

  const alsoCosts = {
    socialSecurity: after.taxableSocialSecurity > before.taxableSocialSecurity + 1,
    seniorDeduction: shrinksSeniorDeduction(h, before.magi, after.magi),
  }

  // Medicare premiums use income from two years earlier: income at 63 counts at 65
  const people = h.status === 'married' ? 2 : 1
  const applies = h.age >= TAX_CONFIG.medicare.eligibilityAge - 2
  const yearly = (magi: number) => (applies ? irmaaPerPersonYearly(magi, h.status, 1) * people : 0)
  const nextTier = TAX_CONFIG.irmaa.map(([single, joint]) => (h.status === 'married' ? joint : single)).find((upper) => after.magi <= upper)
  const irmaa = {
    applies,
    people,
    beforeYearly: yearly(before.magi),
    afterYearly: yearly(after.magi),
    extraYearly: yearly(after.magi) - yearly(before.magi),
    roomInTier: nextTier === undefined || nextTier === Infinity ? Infinity : nextTier - after.magi,
  }

  return {
    before,
    after,
    extraFederal,
    extraState,
    extraTax,
    effectiveRate: extra > 0 ? extraTax / extra : 0,
    topBracket,
    roomInBracket,
    alsoCosts,
    irmaa,
  }
}
