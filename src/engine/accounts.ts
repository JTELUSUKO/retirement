import type { AccountType, BucketAmounts, TaxBucket } from './types'

export const BUCKET_OF: Record<AccountType, TaxBucket> = {
  '401k': 'pretax',
  'traditional-ira': 'pretax',
  roth: 'roth',
  taxable: 'taxable',
  cash: 'cash',
  hsa: 'hsa',
}

/**
 * Order money is withdrawn in retirement (a common tax-aware default):
 * cash and taxable first, then pre-tax, then Roth; HSA last since it is
 * tax-free for medical costs.
 */
export const WITHDRAWAL_ORDER: TaxBucket[] = ['cash', 'taxable', 'pretax', 'roth', 'hsa']

/** Fixed display order (also the chart stacking and color order). */
export const BUCKETS: TaxBucket[] = ['pretax', 'roth', 'taxable', 'cash', 'hsa']

export const emptyBuckets = (): BucketAmounts => ({ pretax: 0, roth: 0, taxable: 0, cash: 0, hsa: 0 })

/**
 * Take up to `amount` from the given balances (indexes into `balances`),
 * proportionally to each balance. Mutates `balances`; returns the amount taken.
 */
export function withdrawProportionally(balances: number[], indexes: number[], amount: number): number {
  const available = indexes.reduce((sum, i) => sum + balances[i], 0)
  if (available <= 0 || amount <= 0) return 0
  const taken = Math.min(amount, available)
  for (const i of indexes) balances[i] -= taken * (balances[i] / available)
  return taken
}
