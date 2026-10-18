import { CONFIG_2026 } from './config/2026'
import { benefitAtClaimAge } from './socialSecurity'
import type { FilingStatus, Plan } from './types'

const FRA = CONFIG_2026.socialSecurity.fullRetirementAge
/** Survivor benefits can start at 60, reduced to 71.5% (28.5% less) and rising to 100% at full retirement age. */
const SURVIVOR_EARLIEST_AGE = 60
const SURVIVOR_MAX_REDUCTION = 0.285
/** If the deceased claimed early, the survivor still gets at least 82.5% of their full benefit. */
const SURVIVOR_FLOOR = 0.825

const isCouple = (plan: Plan) => plan.filingStatus === 'married'

/** Spouse's age minus yours. */
export const spouseOffset = (plan: Plan): number => (isCouple(plan) ? plan.spouseCurrentAge - plan.currentAge : 0)

/** Your age in the final year: couples plan until the younger spouse reaches the plan-to age. */
export const planEndAge = (plan: Plan): number =>
  isCouple(plan) && plan.spouseCurrentAge > 0
    ? plan.currentAge + plan.lifeExpectancy - Math.min(plan.currentAge, plan.spouseCurrentAge)
    : plan.lifeExpectancy

/** Your age in the year of the first death (Infinity when not modeled). */
export const survivorFromAge = (plan: Plan): number => {
  if (!isCouple(plan) || !plan.survivor.enabled || plan.survivor.firstDeathAge <= 0) return Infinity
  return plan.survivor.whoDies === 'you' ? plan.survivor.firstDeathAge : plan.survivor.firstDeathAge - spouseOffset(plan)
}

export interface HouseholdYear {
  /** One spouse has died */
  widowed: boolean
  /** Filing status for taxes this year (single from the year after the death) */
  taxStatus: FilingStatus
  /** Ages of the people alive this year (healthcare, 65+ deductions) */
  livingAges: number[]
  /** Spouse's age this year (couples), else null */
  spouseAge: number | null
}

/** The household in the year you are `age`. */
export function householdAt(plan: Plan, age: number): HouseholdYear {
  if (!isCouple(plan)) return { widowed: false, taxStatus: plan.filingStatus, livingAges: [age], spouseAge: null }
  const from = survivorFromAge(plan)
  const spouseAge = age + spouseOffset(plan)
  const widowed = age >= from
  const livingAges = !widowed ? [age, spouseAge] : plan.survivor.whoDies === 'you' ? [spouseAge] : [age]
  return { widowed, taxStatus: age > from ? 'single' : 'married', livingAges, spouseAge }
}

interface Person {
  pia: number
  claimAge: number
  /** Age when you are the timeline age */
  ageAt: (yourAge: number) => number
}

function people(plan: Plan): { you: Person; spouse: Person } {
  const offset = spouseOffset(plan)
  return {
    you: { pia: plan.socialSecurityAtFRA, claimAge: plan.socialSecurityClaimAge, ageAt: (a) => a },
    spouse: { pia: plan.spouseSocialSecurityAtFRA, claimAge: plan.spouseClaimAge, ageAt: (a) => a + offset },
  }
}

const ownBenefit = (p: Person, age: number) => (age >= p.claimAge ? benefitAtClaimAge(p.pia, p.claimAge) : 0)

/**
 * Share of the spousal benefit paid when it starts at `startAge`: reduced 25/36 of 1% per month for the first
 * 36 months before full retirement age and 5/12 of 1% per month beyond (65% at 62). No delayed credits.
 */
export function spousalFactor(startAge: number): number {
  const months = Math.max(0, Math.round((FRA - Math.min(startAge, FRA)) * 12))
  return 1 - (Math.min(months, 36) * 25) / 3600 - (Math.max(months - 36, 0) * 5) / 1200
}

/**
 * A spouse's own benefit plus any spousal top-up: if their full benefit is under half of the other spouse's,
 * they get the difference (reduced for starting before 67) once both have claimed.
 */
function withSpousal(p: Person, other: Person, yourAge: number): number {
  const own = ownBenefit(p, p.ageAt(yourAge))
  const excess = Math.max(0.5 * other.pia - p.pia, 0)
  if (excess === 0 || p.ageAt(yourAge) < p.claimAge || other.ageAt(yourAge) < other.claimAge) return own
  // Spousal starts when both have filed: the later of their own claim and the other spouse's claim
  const ageWhenOtherFiles = other.claimAge + (p.ageAt(0) - other.ageAt(0))
  return own + excess * spousalFactor(Math.max(p.claimAge, ageWhenOtherFiles))
}

/** Monthly benefit the deceased's record supports for a survivor (before the survivor's own age reduction). */
export function deceasedBasis(pia: number, claimAge: number, deathAge: number): number {
  if (deathAge >= claimAge) {
    // Already claiming: their actual benefit, but at least 82.5% of the full benefit if they claimed early
    const paid = benefitAtClaimAge(pia, claimAge)
    return claimAge < FRA ? Math.max(paid, SURVIVOR_FLOOR * pia) : paid
  }
  // Died before claiming: full benefit, plus delayed credits earned by waiting past full retirement age
  return deathAge > FRA ? benefitAtClaimAge(pia, Math.min(deathAge, 70)) : pia
}

/** Share of the survivor benefit paid when the survivor starts it at `startAge`. */
export function survivorAgeFactor(startAge: number): number {
  if (startAge >= FRA) return 1
  const early = Math.min(FRA - Math.max(startAge, SURVIVOR_EARLIEST_AGE), FRA - SURVIVOR_EARLIEST_AGE)
  return 1 - (SURVIVOR_MAX_REDUCTION * early) / (FRA - SURVIVOR_EARLIEST_AGE)
}

/**
 * Household Social Security for the year you are `age`, yearly, in today's dollars.
 * Each spouse is paid from their own claiming age, plus a spousal top-up when eligible. After a death the survivor gets the larger of their own benefit
 * and the survivor benefit, which they start at the later of 60, the death, and their own claiming age.
 */
export function socialSecurityAt(plan: Plan, age: number): number {
  const { you, spouse } = people(plan)
  if (!isCouple(plan)) return ownBenefit(you, age) * 12
  const household = householdAt(plan, age)
  if (!household.widowed) return (withSpousal(you, spouse, age) + withSpousal(spouse, you, age)) * 12

  const [deceased, survivor] = plan.survivor.whoDies === 'you' ? [you, spouse] : [spouse, you]
  const deathYearAge = survivorFromAge(plan) // your age in the year of death
  const deceasedDeathAge = deceased.ageAt(deathYearAge)
  const survivorAge = survivor.ageAt(age)
  const startAge = Math.max(SURVIVOR_EARLIEST_AGE, survivor.ageAt(deathYearAge), survivor.claimAge)
  const survivorBenefit =
    survivorAge >= startAge
      ? deceasedBasis(deceased.pia, deceased.claimAge, deceasedDeathAge) * survivorAgeFactor(startAge)
      : 0
  return Math.max(ownBenefit(survivor, survivorAge), survivorBenefit) * 12
}

/** Monthly household benefit once both have claimed (for display, incl. spousal top-ups), today's dollars. */
export function householdSocialSecurityMonthly(plan: Plan): number {
  const { you, spouse } = people(plan)
  if (!isCouple(plan)) return benefitAtClaimAge(you.pia, you.claimAge)
  // A timeline age at which both have claimed
  const both = Math.max(you.claimAge, spouse.claimAge - spouseOffset(plan))
  return withSpousal(you, spouse, both) + withSpousal(spouse, you, both)
}
