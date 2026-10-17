// US limits and rules for tax year 2026.
// Update this file each year. Verified 2026-10-17 against:
//   IR-2025-111 (401k/IRA limits), Rev. Proc. 2025-19 (HSA), Rev. Proc. 2025-32 (brackets, standard and
//   65+ deductions), Schedule 1-A Part V (senior deduction), Pub. 590-B Table III (RMD divisors),
//   IRS Social Security taxation thresholds, SSA early/late claiming rules.

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
    /** RMD start age for people born 1951–1959; 75 for born 1960 or later (SECURE 2.0). */
    startAgeBorn1951to1959: 73,
    startAgeBorn1960Plus: 75,
    /**
     * IRS Uniform Lifetime Table (Pub. 590-B, effective 2022): divisor by age.
     * RMD = prior year-end pre-tax balance / divisor.
     */
    uniformLifetimeTable: {
      72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
      80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
      88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
      96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
      104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
    } as Record<number, number>,
  },
  medicare: {
    /** HSA contributions also stop here (no contributions once on Medicare). */
    eligibilityAge: 65,
  },
  /**
   * Medicare income-related monthly adjustment amounts (IRMAA), CMS 2026 fact sheet: per person per month, by
   * MAGI from two years earlier. [single upper bound, joint upper bound, Part B extra, Part D extra].
   * The last tier has no upper bound.
   */
  irmaa: [
    [109_000, 218_000, 0, 0],
    [137_000, 274_000, 81.2, 14.5],
    [171_000, 342_000, 202.9, 37.5],
    [205_000, 410_000, 324.6, 60.4],
    [500_000, 750_000, 446.3, 83.3],
    [Infinity, Infinity, 487.0, 91.0],
  ] as [number, number, number, number][],
  federalTax: {
    /** Ordinary income brackets: [upper bound of bracket, rate]. Indexed to inflation each year. */
    brackets: {
      single: [[12_400, 0.1], [50_400, 0.12], [105_700, 0.22], [201_775, 0.24], [256_225, 0.32], [640_600, 0.35], [Infinity, 0.37]],
      married: [[24_800, 0.1], [100_800, 0.12], [211_400, 0.22], [403_550, 0.24], [512_450, 0.32], [768_700, 0.35], [Infinity, 0.37]],
    } as Record<'single' | 'married', [number, number][]>,
    standardDeduction: { single: 16_100, married: 32_200 },
    /** Extra standard deduction per person aged 65+. Indexed. */
    additionalDeduction65: { single: 2_050, married: 1_650 },
    /**
     * Temporary senior deduction (OBBBA): $6,000 per person 65+, tax years 2025–2028; each person's
     * $6,000 is reduced by 6% of MAGI above the threshold (Schedule 1-A Part V). Not indexed.
     */
    seniorDeduction: { amount: 6_000, lastYear: 2028, phaseOutStart: { single: 75_000, married: 150_000 }, phaseOutRate: 0.06 },
    /**
     * Long-term capital gains and qualified dividends (Rev. Proc. 2025-32 §3.03): 0% up to the first amount of
     * taxable income, 15% up to the second, 20% above. Indexed.
     */
    capitalGains: { zeroRateTop: { single: 49_450, married: 98_900 }, fifteenRateTop: { single: 545_500, married: 613_700 } },
    /** Net investment income tax: 3.8% above these modified AGIs (not indexed by law). */
    niit: { rate: 0.038, threshold: { single: 200_000, married: 250_000 } },
    /** 10% additional tax on retirement-plan withdrawals before 59½ (Rule of 55 for 401(k)s left at 55+). */
    earlyWithdrawal: { penalty: 0.1, ruleOf55Age: 55 },
    /** Social Security taxation thresholds on provisional income. Not indexed by law. */
    socialSecurityThresholds: { single: [25_000, 34_000], married: [32_000, 44_000] } as Record<'single' | 'married', [number, number]>,
  },
} as const
