import type { Plan } from './types'

/** Simple plan for tests: age 60, retired, $100k, $10k/yr spending, no growth. */
export const basePlan: Plan = {
  filingStatus: 'single',
  state: '',
  stateRetirementExclusion: 0,
  currentAge: 60,
  retirementAge: 60,
  lifeExpectancy: 70,
  accounts: [
    { id: 'a', name: '401k', type: '401k', balance: 100_000, annualContribution: 0, employerMatch: 0, costBasis: null },
  ],
  annualSpending: 10_000,
  socialSecurityAtFRA: 0,
  spouseSocialSecurityAtFRA: 0,
  spouseCurrentAge: 60,
  spouseClaimAge: 67,
  survivor: { enabled: false, whoDies: 'you', firstDeathAge: 0, spendingShare: 0.75 },
  socialSecurityClaimAge: 67,
  incomeStreams: [],
  annuityPurchase: {
    enabled: false,
    amount: 0,
    purchaseAge: 65,
    payoutRate: null,
    inflationAdjusted: false,
    fundedFrom: 'pretax',
  },
  scenarios: [],
  healthcare: { preMedicareAnnual: 0, medicareAnnual: 0, excessInflation: 0 },
  assumptions: {
    returnPreRetirement: 0,
    returnPostRetirement: 0,
    volatilityPreRetirement: 0,
    volatilityPostRetirement: 0,
    inflation: 0,
  },
}
