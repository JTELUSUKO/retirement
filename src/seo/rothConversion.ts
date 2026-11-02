import { bracketTop, CONFIG_2026, federalIncomeTax, irmaaPerPersonYearly, stateIncomeTax, type FilingStatus } from '../engine'

const T = CONFIG_2026.federalTax
/** Tax on the growth of money kept in a taxable account, as a share of that growth (simplified long-term rate). */
const TAXABLE_GROWTH_DRAG = 0.15

export interface RothInputs {
  status: FilingStatus
  /** Two-letter state code, '' for none */
  state: string
  /** Your age this year (for married couples, both are treated as this age) */
  age: number
  /** Other ordinary income this year: wages, pension, IRA withdrawals, interest */
  otherIncome: number
  /** Social Security benefits received this year (household) */
  socialSecurity: number
  /** Amount moved from a traditional IRA / 401(k) to a Roth this year */
  conversion: number
  /** Years until the converted money is spent */
  years: number
  /** Expected yearly investment return */
  annualReturn: number
  /** Expected combined federal + state tax rate on withdrawals later */
  futureTaxRate: number
  /** Pay the conversion's tax from other savings, or withhold it from the conversion */
  payTaxFrom: 'savings' | 'conversion'
}

export interface TaxSnapshot {
  federal: number
  state: number
  /** Adjusted gross income, which is also the MAGI Medicare uses for IRMAA */
  magi: number
  taxableOrdinary: number
  taxableSocialSecurity: number
}

export interface RothResult {
  before: TaxSnapshot
  after: TaxSnapshot
  /** Extra federal + state tax caused by the conversion */
  extraFederal: number
  extraState: number
  extraTax: number
  /** extraTax ÷ conversion */
  effectiveRate: number
  /** Federal bracket the last converted dollar falls in (0 when it's all covered by deductions) */
  topBracket: number
  /** Conversion that can still be added before the next federal bracket (Infinity in the top bracket) */
  roomInBracket: number
  /** Costs on top of the bracket rate that this conversion triggers */
  alsoCosts: { socialSecurity: boolean; seniorDeduction: boolean }
  /** Conversion that fills each bracket from this year's other income (0 if already past it) */
  fillTo: { rate: number; amount: number }[]
  /**
   * Medicare income surcharge (IRMAA) two years later, for everyone on the return (only when you'll be 65+ by then).
   * Yearly amounts at 2026 tiers; roomInTier is income that can be added before the next tier (Infinity in the top one).
   */
  irmaa: { applies: boolean; people: number; beforeYearly: number; afterYearly: number; extraYearly: number; roomInTier: number }
  /** After-tax value of the converted money after `years` */
  compare: { convert: number; dontConvert: number; breakEvenRate: number; earlyPenalty: number }
}

const federal = (inputs: RothInputs, conversion: number) =>
  federalIncomeTax({
    ordinaryIncome: inputs.otherIncome + conversion,
    socialSecurity: inputs.socialSecurity,
    age: inputs.age,
    year: CONFIG_2026.year,
    status: inputs.status,
    priceLevel: 1,
  })

function taxes(inputs: RothInputs, conversion: number): TaxSnapshot {
  const ordinaryIncome = inputs.otherIncome + conversion
  const fed = federal(inputs, conversion)
  // No capital gains here, so AGI is ordinary income plus taxable Social Security
  const taxableSs = fed.agi - ordinaryIncome
  const state = stateIncomeTax({
    state: inputs.state,
    status: inputs.status,
    age: inputs.age,
    ordinaryIncome,
    // A conversion is an IRA distribution, so states that exempt retirement income at this age exempt it too
    retirementIncome: conversion,
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

/** Smallest conversion that brings taxable ordinary income above `target` (0 if `baseTaxable` already is). */
function conversionToReach(inputs: RothInputs, target: number, baseTaxable: number): number {
  if (baseTaxable >= target) return 0
  let lo = 0
  let hi = target + inputs.socialSecurity + 100_000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (federal(inputs, mid).taxableOrdinary >= target) hi = mid
    else lo = mid
  }
  return Math.ceil(lo)
}

/** Whether income from `before` to `after` falls in the senior deduction's phase-out range (65+, 2025–2028). */
function shrinksSeniorDeduction(inputs: RothInputs, before: number, after: number): boolean {
  const { amount, lastYear, phaseOutStart, phaseOutRate } = T.seniorDeduction
  const start = phaseOutStart[inputs.status]
  const fullyPhasedOut = start + amount / phaseOutRate
  return inputs.age >= CONFIG_2026.medicare.eligibilityAge && CONFIG_2026.year <= lastYear && after > start && before < fullyPhasedOut
}

export function rothConversion(inputs: RothInputs): RothResult {
  const before = taxes(inputs, 0)
  const after = taxes(inputs, inputs.conversion)
  const extraFederal = after.federal - before.federal
  const extraState = after.state - before.state
  const extraTax = extraFederal + extraState

  const { rate: topBracket, top } = bracketOf(after.taxableOrdinary, inputs.status)
  // At 0%, the room is what's left of the deductions (until the first taxable dollar)
  const roomInBracket =
    top === Infinity ? Infinity : Math.max(conversionToReach(inputs, Math.max(top, 1), before.taxableOrdinary) - inputs.conversion, 0)

  const fillTo = [0.12, 0.22, 0.24].map((rate) => ({
    rate,
    amount: conversionToReach(inputs, bracketTop(rate, inputs.status, 1), before.taxableOrdinary),
  }))

  const alsoCosts = {
    socialSecurity: after.taxableSocialSecurity > before.taxableSocialSecurity + 1,
    seniorDeduction: shrinksSeniorDeduction(inputs, before.magi, after.magi),
  }

  // Medicare premiums use income from two years earlier: a conversion at 63 counts at 65
  const people = inputs.status === 'married' ? 2 : 1
  const applies = inputs.age >= CONFIG_2026.medicare.eligibilityAge - 2
  const yearly = (magi: number) => (applies ? irmaaPerPersonYearly(magi, inputs.status, 1) * people : 0)
  const nextTier = CONFIG_2026.irmaa.map(([single, joint]) => (inputs.status === 'married' ? joint : single)).find((upper) => after.magi <= upper)
  const irmaa = {
    applies,
    people,
    beforeYearly: yearly(before.magi),
    afterYearly: yearly(after.magi),
    extraYearly: yearly(after.magi) - yearly(before.magi),
    roomInTier: nextTier === undefined || nextTier === Infinity ? Infinity : nextTier - after.magi,
  }

  const growth = (1 + inputs.annualReturn) ** inputs.years
  const taxableGrowth = (1 + inputs.annualReturn * (1 - TAXABLE_GROWTH_DRAG)) ** inputs.years
  const c = inputs.conversion
  let compare: RothResult['compare']
  if (inputs.payTaxFrom === 'savings') {
    // Converting spends `extraTax` of savings now; not converting keeps it growing in a taxable account
    const dontConvert = c * growth * (1 - inputs.futureTaxRate) + extraTax * taxableGrowth
    compare = { convert: c * growth, dontConvert, breakEvenRate: c > 0 ? (extraTax * taxableGrowth) / (c * growth) : 0, earlyPenalty: 0 }
  } else {
    // Tax withheld from the conversion never reaches the Roth; before 59½ it also owes the 10% early-withdrawal penalty
    const earlyPenalty = inputs.age < 59.5 ? T.earlyWithdrawal.penalty * extraTax : 0
    const lost = Math.min(extraTax + earlyPenalty, c)
    compare = {
      convert: (c - lost) * growth,
      dontConvert: c * growth * (1 - inputs.futureTaxRate),
      breakEvenRate: c > 0 ? lost / c : 0,
      earlyPenalty,
    }
  }

  return {
    before,
    after,
    extraFederal,
    extraState,
    extraTax,
    effectiveRate: c > 0 ? extraTax / c : 0,
    topBracket,
    roomInBracket,
    alsoCosts,
    fillTo,
    irmaa,
    compare,
  }
}
