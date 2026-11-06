import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { examplePlan } from '../store/planStore'
import type { SimTask } from './tasks'

const task = (annualSpending: number): SimTask => ({ kind: 'successRate', plan: { ...examplePlan, annualSpending } })
const spendingOf = (t: SimTask) => t.plan.annualSpending

/** One fake worker that remembers what it was sent; `finish` answers the job it's on, so the pool moves on */
class FakeWorker {
  static sent: { id: number; task: SimTask }[] = []
  static current: FakeWorker
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror = null
  constructor() {
    FakeWorker.current = this
  }
  postMessage(message: { id: number; task: SimTask }) {
    FakeWorker.sent.push(message)
  }
  static finish() {
    FakeWorker.current.onmessage!({ data: { id: FakeWorker.sent.at(-1)!.id, result: 0.5 } })
  }
}

describe('worker pool with one worker', () => {
  beforeEach(() => {
    FakeWorker.sent = []
    vi.resetModules()
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('navigator', { hardwareConcurrency: 2 })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('runs ordinary tasks ahead of queued background tasks', async () => {
    const { runSimulation } = await import('./pool')
    void runSimulation(task(1), 'bg:1', true)
    void runSimulation(task(2), 'bg:2', true)
    void runSimulation(task(3), 'bg:3', true)
    void runSimulation(task(4), 'chart')
    expect(FakeWorker.sent.map((m) => spendingOf(m.task))).toEqual([1])
    FakeWorker.finish()
    FakeWorker.finish()
    FakeWorker.finish()
    expect(FakeWorker.sent.map((m) => spendingOf(m.task))).toEqual([1, 4, 2, 3])
  })

  it('cancels queued tasks by group prefix, leaving the one running and other groups', async () => {
    const { cancelQueued, runSimulation, Superseded } = await import('./pool')
    const running = runSimulation(task(1), 'bg:1', true)
    const queued = runSimulation(task(2), 'bg:2', true)
    void runSimulation(task(3), 'chart')
    cancelQueued('bg:')
    await expect(queued).rejects.toBeInstanceOf(Superseded)
    FakeWorker.finish()
    await expect(running).resolves.toBe(0.5)
    expect(FakeWorker.sent.map((m) => spendingOf(m.task))).toEqual([1, 3])
  })
})
