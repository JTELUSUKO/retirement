import type { TaxBucket } from '../engine'

export const BUCKET_LABEL: Record<TaxBucket, string> = {
  pretax: 'Pre-tax (401k / IRA)',
  roth: 'Roth',
  taxable: 'Taxable',
  cash: 'Cash',
  hsa: 'HSA',
}

export const BUCKET_COLOR: Record<TaxBucket, string> = {
  pretax: 'var(--series-pretax)',
  roth: 'var(--series-roth)',
  taxable: 'var(--series-taxable)',
  cash: 'var(--series-cash)',
  hsa: 'var(--series-hsa)',
}

/** Scenario comparison colors: slot 0 = your plan, 1–3 = scenarios (fixed per scenario). */
export const scenarioColor = (slot: number) => `var(--scenario-${slot})`
