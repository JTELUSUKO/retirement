/**
 * Typical (median) yearly return for an average (arithmetic) return with the given volatility, under the
 * same lognormal model the Monte Carlo uses. With 15% volatility it is about 1 point below the average:
 * money compounds at the median rate, not the average one.
 */
export function medianReturn(mean: number, volatility: number): number {
  return (1 + mean) / Math.sqrt(1 + volatility ** 2 / (1 + mean) ** 2) - 1
}

/**
 * Illustrative long-run capital market assumptions (nominal, arithmetic averages) used by the investment-mix
 * presets. Users can override the resulting return and volatility.
 */
export const CAPITAL_MARKETS = {
  stocks: { mean: 0.085, volatility: 0.17 },
  bonds: { mean: 0.045, volatility: 0.06 },
  correlation: 0.1,
}

/** Average return and volatility of a stock/bond mix (stockShare 0–1). */
export function mixReturns(stockShare: number): { mean: number; volatility: number } {
  const { stocks: s, bonds: b, correlation } = CAPITAL_MARKETS
  const w = stockShare
  const mean = w * s.mean + (1 - w) * b.mean
  const variance = (w * s.volatility) ** 2 + ((1 - w) * b.volatility) ** 2 + 2 * w * (1 - w) * correlation * s.volatility * b.volatility
  return { mean, volatility: Math.sqrt(variance) }
}

/** Investment-mix presets offered in the form (stock share). */
export const MIX_PRESETS = [1, 0.8, 0.6, 0.4, 0.2]
