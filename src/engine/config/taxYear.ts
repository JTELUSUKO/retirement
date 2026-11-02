// US limits and rules for one tax year. This is the file to update each year (see YEARLY_UPDATE.md): the planner,
// the calculators and the year, dates, tax tables and source links on the calculator pages all read from it.
// Verified 2026-10-17 against:
//   IR-2025-111 (401k/IRA limits), Rev. Proc. 2025-19 (HSA), Rev. Proc. 2025-32 (brackets, standard and
//   65+ deductions), Schedule 1-A Part V (senior deduction), Pub. 590-B Table III (RMD divisors),
//   IRS Social Security taxation thresholds, SSA early/late claiming rules.

import { STATE_RULES_YEAR } from './stateRules.ts'

export const TAX_CONFIG = {
  year: 2026,
  /** When these figures were last checked against the sources (ISO date; shown on the pages as "last reviewed"). */
  reviewed: '2026-11-01',
  /**
   * Official sources for this year's figures, linked from the planner footer and the calculator pages.
   * Several URLs name the year (e.g. Rev. Proc. 2025-32, the CMS 2026 fact sheet): replace them each year.
   */
  sources: {
    revProc: { url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf', name: 'IRS Revenue Procedure 2025-32 (PDF)', short: 'IRS Rev. Proc. 2025-32' },
    seniorDeduction: {
      url: 'https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors',
      name: 'IRS: Tax deductions for working Americans and seniors',
    },
    planLimits: {
      url: 'https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500',
      name: 'IRS: 2026 retirement plan limits',
    },
    rmdFaq: { url: 'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs', name: 'IRS: Required minimum distributions FAQs' },
    rmdTopics: {
      url: 'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds',
      name: 'IRS: Retirement topics, required minimum distributions',
    },
    pub590a: { url: 'https://www.irs.gov/publications/p590a', name: 'IRS Publication 590-A' },
    pub590b: { url: 'https://www.irs.gov/publications/p590b', name: 'IRS Publication 590-B' },
    pub915: { url: 'https://www.irs.gov/publications/p915', name: 'IRS Publication 915' },
    rothIras: { url: 'https://www.irs.gov/retirement-plans/roth-iras', name: 'IRS: Roth IRAs' },
    earlyDistributions: {
      url: 'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions',
      name: 'IRS: Exceptions to tax on early distributions',
    },
    estimatedTaxes: { url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes', name: 'IRS: Estimated taxes' },
    medicarePremiums: {
      url: 'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles',
      name: 'CMS: 2026 Medicare Parts A & B premiums and deductibles',
    },
    ssaMedicare: { url: 'https://www.ssa.gov/benefits/medicare/medicare-premiums.html', name: 'Social Security Administration: Medicare premiums' },
    ssaEarly: { url: 'https://www.ssa.gov/benefits/retirement/planner/agereduction.html', name: 'SSA: Retirement age and benefit reduction' },
    ssaDelayed: { url: 'https://www.ssa.gov/benefits/retirement/planner/delayret.html', name: 'SSA: Delayed retirement credits' },
    mySocialSecurity: { url: 'https://www.ssa.gov/myaccount/', name: 'my Social Security' },
    lifeExpectancy: { url: 'https://www.ssa.gov/oact/population/longevity.html', name: 'SSA: Life expectancy calculator' },
    ssaPlanning: {
      url: 'https://www.ssa.gov/benefits/retirement/planner/otherthings.html',
      name: 'SSA: Important things to consider when planning for retirement',
    },
    cpi: { url: 'https://www.bls.gov/cpi/', name: 'U.S. Bureau of Labor Statistics: Consumer Price Index' },
    acaIncome: { url: 'https://www.healthcare.gov/income-and-household-information/income/', name: 'HealthCare.gov: What income to include' },
    // Follows the state rules' own year (stateRules.ts), which is regenerated when the Tax Foundation table is out
    stateTax: {
      url: `https://taxfoundation.org/data/all/state/state-income-tax-rates-${STATE_RULES_YEAR}/`,
      name: `Tax Foundation: ${STATE_RULES_YEAR} state income tax rates and brackets`,
    },
  },
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
    seniorDeduction: { amount: 6_000, firstYear: 2025, lastYear: 2028, phaseOutStart: { single: 75_000, married: 150_000 }, phaseOutRate: 0.06 },
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

/** The review date as shown on the pages: "November 1, 2026" */
export const REVIEWED_DATE = new Date(`${TAX_CONFIG.reviewed}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
