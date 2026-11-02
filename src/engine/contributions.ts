import { TAX_CONFIG } from './config/taxYear'
import type { Plan } from './types'

const L = TAX_CONFIG.contributionLimits

export interface ContributionWarning {
  accountId: string
  message: string
}

const fmt = (n: number) => `$${n.toLocaleString('en-US')}`

/** Your employee 401(k) limit for the tax year at `age` (catch-up from 50; higher catch-up at 60–63). */
export function k401Limit(age: number): number {
  if (age >= 60 && age <= 63) return L.k401 + L.k401CatchUp60to63
  return L.k401 + (age >= 50 ? L.k401CatchUp50 : 0)
}

/**
 * Accounts whose yearly contributions exceed the tax year's IRS limits. Warnings only: the plan still runs.
 * Each account is checked against one person's limit (accounts have no owner, so couples' accounts are
 * each assumed to belong to one spouse). Roth accounts may be a Roth IRA or a Roth 401(k), so they aren't checked.
 */
export function contributionWarnings(plan: Plan): ContributionWarning[] {
  const age = plan.currentAge
  const warnings: ContributionWarning[] = []
  for (const a of plan.accounts) {
    if (a.type === '401k' && a.annualContribution > k401Limit(age)) {
      warnings.push({
        accountId: a.id,
        message: `Above the ${TAX_CONFIG.year} employee limit of ${fmt(k401Limit(age))} at age ${age}. Employer match is separate.`,
      })
    }
    if (a.type === 'traditional-ira') {
      const limit = L.ira + (age >= 50 ? L.iraCatchUp50 : 0)
      if (a.annualContribution + a.employerMatch > limit) {
        warnings.push({ accountId: a.id, message: `Above the ${TAX_CONFIG.year} IRA limit of ${fmt(limit)} at age ${age} (shared by all your IRAs).` })
      }
    }
    if (a.type === 'hsa') {
      const family = plan.filingStatus === 'married'
      const limit = (family ? L.hsaFamily : L.hsaSelf) + (age >= 55 ? L.hsaCatchUp55 : 0)
      if (a.annualContribution + a.employerMatch > limit) {
        warnings.push({
          accountId: a.id,
          message: `Above the ${TAX_CONFIG.year} HSA limit of ${fmt(limit)} (${family ? 'family' : 'self-only'} coverage${age >= 55 ? ', with catch-up' : ''}), including employer money.`,
        })
      }
    }
  }
  return warnings
}
