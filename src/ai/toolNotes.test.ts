import { describe, expect, it } from 'vitest'
import { describeToolCall } from './toolNotes'

describe('describeToolCall', () => {
  it('describes a what-if in plain language', () => {
    expect(describeToolCall('run_what_if', { retirementAge: 63, stress: 'crash' }, false)).toBe(
      'Ran a what-if: retire at 63, market crash at retirement',
    )
  })
  it('describes plan checks and failed calls', () => {
    expect(describeToolCall('get_plan_results', {}, false)).toBe('Checked your plan’s results')
    expect(describeToolCall('run_what_if', { x: 1 }, true)).toMatch(/invalid/)
  })
})
