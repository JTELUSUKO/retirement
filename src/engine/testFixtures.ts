import type { Plan } from './types'

/** Simple plan for tests: age 60, retired, $100k, $10k/yr spending, no growth. */
export const basePlan: Plan = {
  filingStatus: 'single',
  currentAge: 60,
  retirementAge: 60,
  lifeExpectancy: 70,
  accounts: [
    { id: 'a', name: '401k', type: '401k', balance: 100_000, annualContribution: 0, employerMatch: 0 },
  ],
  annualSpending: 10_000,
  socialSecurityAtFRA: 0,
  socialSecurityClaimAge: 67,
  annualPension: 0,
  healthcare: { preMedicareAnnual: 0, medicareAnnual: 0, excessInflation: 0 },
  assumptions: {
    returnPreRetirement: 0,
    returnPostRetirement: 0,
    volatilityPreRetirement: 0,
    volatilityPostRetirement: 0,
    inflation: 0,
  },
}
