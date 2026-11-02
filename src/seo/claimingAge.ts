import { benefitAtClaimAge, TAX_CONFIG } from '../engine'

const { earliestClaimAge, latestClaimAge, fullRetirementAge } = TAX_CONFIG.socialSecurity
/** Break-even searches stop here; later than this reads as "never" */
const OLDEST_AGE = 110

export interface ClaimingInputs {
  /** Monthly benefit at full retirement age (67), from the SSA statement */
  benefitAtFRA: number
  /** Age the totals run to */
  planToAge: number
  /** Yearly return after inflation on money you'd have sooner (0 = simply add up the payments) */
  realReturn: number
}

export interface ClaimOption {
  age: number
  /** Monthly benefit, today's dollars (it rises with inflation each year) */
  monthly: number
  /** Monthly benefit as a share of the full-retirement-age benefit */
  shareOfFull: number
  /** Total collected from claiming to planToAge, today's dollars, valued at age 62 with `realReturn` */
  lifetime: number
}

export interface ClaimingResult {
  options: ClaimOption[]
  /** The claiming age with the largest total to planToAge (the earliest if tied) */
  best: ClaimOption
  /** Age from which claiming later has paid more in total (null: not by age 110) */
  breakEven: { from62to67: number | null; from67to70: number | null; from62to70: number | null }
}

/**
 * Benefits collected from `claimAge` up to `toAge` (fractional months count), each valued at age 62 at a monthly rate
 * matching `realReturn` a year.
 */
export function collected(monthly: number, claimAge: number, toAge: number, realReturn: number): number {
  const months = Math.max(0, (toAge - claimAge) * 12)
  if (realReturn === 0) return monthly * months
  const v = (1 + realReturn) ** (-1 / 12)
  return monthly * v ** ((claimAge - earliestClaimAge) * 12) * ((1 - v ** months) / (1 - v))
}

/** First age at which claiming at `later` has collected as much as claiming at `earlier`, or null before 110. */
export function breakEvenAge(benefitAtFRA: number, earlier: number, later: number, realReturn: number): number | null {
  const a = benefitAtClaimAge(benefitAtFRA, earlier)
  const b = benefitAtClaimAge(benefitAtFRA, later)
  const ahead = (age: number) => collected(b, later, age, realReturn) - collected(a, earlier, age, realReturn)
  if (benefitAtFRA <= 0 || ahead(OLDEST_AGE) < 0) return null
  // Behind until `later`, then the gap only closes (the later benefit is bigger), so bisect
  let lo = later
  let hi = OLDEST_AGE
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (ahead(mid) >= 0) hi = mid
    else lo = mid
  }
  return hi
}

export function claimingAge(inputs: ClaimingInputs): ClaimingResult {
  const { benefitAtFRA, planToAge, realReturn } = inputs
  const options: ClaimOption[] = []
  for (let age = earliestClaimAge; age <= latestClaimAge; age++) {
    const monthly = benefitAtClaimAge(benefitAtFRA, age)
    options.push({
      age,
      monthly,
      shareOfFull: benefitAtFRA > 0 ? monthly / benefitAtFRA : 0,
      lifetime: collected(monthly, age, planToAge, realReturn),
    })
  }
  const best = options.reduce((a, b) => (b.lifetime > a.lifetime + 0.5 ? b : a))
  return {
    options,
    best,
    breakEven: {
      from62to67: breakEvenAge(benefitAtFRA, earliestClaimAge, fullRetirementAge, realReturn),
      from67to70: breakEvenAge(benefitAtFRA, fullRetirementAge, latestClaimAge, realReturn),
      from62to70: breakEvenAge(benefitAtFRA, earliestClaimAge, latestClaimAge, realReturn),
    },
  }
}

/** The calculator page starts with these values (the browser tests check results for them too). */
export const CLAIMING_DEFAULTS: ClaimingInputs = {
  benefitAtFRA: 2000,
  planToAge: 90,
  realReturn: 0,
}
