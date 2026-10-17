import { CONFIG_2026 } from './config/2026'

const { startAgeBorn1951to1959, startAgeBorn1960Plus, uniformLifetimeTable } = CONFIG_2026.rmd

/** Age RMDs start (SECURE 2.0): 73 if born 1951–1959, 75 if born 1960 or later. */
export function rmdStartAge(birthYear: number): number {
  return birthYear >= 1960 ? startAgeBorn1960Plus : startAgeBorn1951to1959
}

/** Required minimum distribution for the year, from the prior year-end pre-tax balance. */
export function requiredMinimumDistribution(age: number, birthYear: number, pretaxBalance: number): number {
  if (age < rmdStartAge(birthYear) || pretaxBalance <= 0) return 0
  const divisor = uniformLifetimeTable[Math.min(age, 110)]
  return divisor ? pretaxBalance / divisor : 0
}
