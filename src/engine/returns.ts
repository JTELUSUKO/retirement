/**
 * Typical (median) yearly return for an average (arithmetic) return with the given volatility, under the
 * same lognormal model the Monte Carlo uses. With 15% volatility it is about 1 point below the average:
 * money compounds at the median rate, not the average one.
 */
export function medianReturn(mean: number, volatility: number): number {
  return (1 + mean) / Math.sqrt(1 + volatility ** 2 / (1 + mean) ** 2) - 1
}
