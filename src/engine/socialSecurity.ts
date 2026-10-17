import { CONFIG_2026 } from './config/2026'

const { fullRetirementAge, earliestClaimAge, latestClaimAge } = CONFIG_2026.socialSecurity

/**
 * Monthly benefit when claiming at `claimAge`, given the benefit at full retirement age.
 * Early: -5/9% per month for the first 36 months, -5/12% per month beyond that.
 * Delayed: +8% per year (2/3% per month) up to age 70.
 */
export function benefitAtClaimAge(benefitAtFRA: number, claimAge: number): number {
  const age = Math.min(Math.max(claimAge, earliestClaimAge), latestClaimAge)
  const months = Math.round((age - fullRetirementAge) * 12)

  if (months < 0) {
    const early = -months
    const reduction = Math.min(early, 36) * (5 / 900) + Math.max(early - 36, 0) * (5 / 1200)
    return benefitAtFRA * (1 - reduction)
  }
  return benefitAtFRA * (1 + months * (2 / 300))
}
