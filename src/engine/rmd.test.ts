import { describe, expect, it } from 'vitest'
import { requiredMinimumDistribution, rmdStartAge } from './rmd'

describe('RMDs', () => {
  it('start at 73 for people born 1951–1959 and 75 for 1960+', () => {
    expect(rmdStartAge(1955)).toBe(73)
    expect(rmdStartAge(1959)).toBe(73)
    expect(rmdStartAge(1960)).toBe(75)
  })

  it('use the Uniform Lifetime Table divisor', () => {
    expect(requiredMinimumDistribution(73, 1953, 265_000)).toBeCloseTo(10_000)
    expect(requiredMinimumDistribution(75, 1961, 246_000)).toBeCloseTo(10_000)
  })

  it('are zero before the start age', () => {
    expect(requiredMinimumDistribution(74, 1962, 500_000)).toBe(0)
  })
})
