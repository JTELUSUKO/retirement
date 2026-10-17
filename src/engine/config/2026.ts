// US limits and rules for tax year 2026.
// Update this file each year. Sources: irs.gov (contribution limits), ssa.gov.

export const CONFIG_2026 = {
  year: 2026,
  contributionLimits: {
    k401: 24_500,
    k401CatchUp50: 8_000,
    /** "Super catch-up" for ages 60–63 (replaces the regular catch-up). */
    k401CatchUp60to63: 11_250,
    ira: 7_500,
    iraCatchUp50: 1_100,
    hsaSelf: 4_400,
    hsaFamily: 8_750,
    hsaCatchUp55: 1_000,
  },
  socialSecurity: {
    fullRetirementAge: 67,
    earliestClaimAge: 62,
    latestClaimAge: 70,
  },
  rmd: {
    /** RMD start age for people born 1951–1959; 75 for born 1960 or later. */
    startAgeBorn1951to1959: 73,
    startAgeBorn1960Plus: 75,
  },
  medicare: {
    eligibilityAge: 65,
  },
} as const
