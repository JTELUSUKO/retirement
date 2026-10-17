import { CONFIG_2026 } from './config/2026'
import type { FilingStatus } from './types'

const TIERS = CONFIG_2026.irmaa

/**
 * Yearly Medicare surcharge for ONE person on Medicare, in today's dollars, given MAGI (nominal) and the
 * price level used to index the income thresholds.
 */
export function irmaaPerPersonYearly(magi: number, status: FilingStatus, priceLevel: number): number {
  for (const [single, joint, partB, partD] of TIERS) {
    const upper = (status === 'married' ? joint : single) * priceLevel
    if (magi <= upper) return (partB + partD) * 12
  }
  return 0
}

/** Highest MAGI (nominal) with no surcharge. */
export const irmaaFirstThreshold = (status: FilingStatus, priceLevel: number): number =>
  (status === 'married' ? TIERS[0][1] : TIERS[0][0]) * priceLevel
