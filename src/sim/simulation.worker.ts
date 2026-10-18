/// <reference lib="webworker" />
import { runTask, type SimTask } from './tasks'

// One task at a time; the pool on the main thread queues work and drops superseded tasks.
self.onmessage = (event: MessageEvent<{ id: number; task: SimTask }>) => {
  const { id, task } = event.data
  try {
    self.postMessage({ id, result: runTask(task) })
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
