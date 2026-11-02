import { describe, expect, it } from 'vitest'
import { ALL_STATES, matchStates } from './states'

const names = (q: string) => matchStates(q).map((s) => s.name)

describe('matchStates', () => {
  it('lists every state for empty text', () => {
    expect(matchStates('  ')).toHaveLength(ALL_STATES.length)
  })

  it('puts names starting with the text first, then names with a word starting with it', () => {
    expect(names('nor')).toEqual(['North Carolina', 'North Dakota'])
    expect(names('carolina')).toEqual(['North Carolina', 'South Carolina'])
    expect(names('new')).toEqual(['New Hampshire', 'New Jersey', 'New Mexico', 'New York'])
  })

  it('ignores case and finds a two-letter code', () => {
    expect(names('TEX')).toEqual(['Texas'])
    expect(names('nc')).toEqual(['North Carolina'])
  })

  it('finds nothing for text no state has', () => {
    expect(matchStates('xyz')).toEqual([])
  })
})
