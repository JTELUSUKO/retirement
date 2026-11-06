import { runTask, type SimResult, type SimTask } from './tasks'

interface Job {
  id: number
  task: SimTask
  /** Jobs in the same group replace each other while still queued (e.g. one per chart) */
  group: string
  /** Waits for every other queued job, so a big batch never holds up the results on screen */
  background: boolean
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

interface Slot {
  worker: Worker
  job: Job | null
}

const SIZE = Math.min(4, Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1))
const canUseWorkers = typeof Worker !== 'undefined'

let slots: Slot[] | null = null
const queue: Job[] = []
let nextId = 1

/** Error used when a queued job is replaced by a newer one in its group. */
export class Superseded extends Error {
  constructor() {
    super('superseded')
  }
}

function createSlots(): Slot[] {
  return Array.from({ length: SIZE }, () => {
    const slot: Slot = {
      worker: new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }),
      job: null,
    }
    slot.worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const job = slot.job
      slot.job = null
      if (job && job.id === event.data.id) {
        if (event.data.error !== undefined) job.reject(new Error(event.data.error))
        else job.resolve(event.data.result)
      }
      dispatch()
    }
    slot.worker.onerror = (event) => {
      const job = slot.job
      slot.job = null
      job?.reject(new Error(event.message))
      dispatch()
    }
    return slot
  })
}

function dispatch() {
  slots ??= createSlots()
  for (const slot of slots) {
    if (slot.job || queue.length === 0) continue
    const next = queue.findIndex((job) => !job.background)
    const job = queue.splice(Math.max(next, 0), 1)[0]
    slot.job = job
    slot.worker.postMessage({ id: job.id, task: job.task })
  }
}

/**
 * Run a simulation task off the main thread. A newer task in the same `group` replaces any of its queued
 * (not yet started) tasks, which reject with `Superseded`. A `background` task waits for every other queued task.
 * Without Worker support, runs on the main thread.
 */
export function runSimulation<T extends SimTask>(task: T, group: string, background = false): Promise<SimResult<T>> {
  if (!canUseWorkers) {
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(runTask(task) as SimResult<T>)
        } catch (err) {
          reject(err)
        }
      }, 0),
    )
  }
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].group === group) queue.splice(i, 1)[0].reject(new Superseded())
  }
  return new Promise((resolve, reject) => {
    queue.push({ id: nextId++, task, group, background, resolve: resolve as (v: unknown) => void, reject })
    dispatch()
  })
}

/** Drop the queued tasks whose group starts with `prefix` (they reject with `Superseded`); running ones finish. */
export function cancelQueued(prefix: string) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].group.startsWith(prefix)) queue.splice(i, 1)[0].reject(new Superseded())
  }
}
