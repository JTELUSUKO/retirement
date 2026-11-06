import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cancelQueued, runSimulation, Superseded } from './pool'
import type { SimResult, SimTask } from './tasks'

export interface SimState<T, Task = SimTask> {
  /** Latest finished result (kept while a newer one runs), or null before the first one */
  data: T | null
  /** The tasks `data` was computed from (it can lag behind the tasks passed in) */
  dataTasks: (Task | null)[] | null
  /** A newer result is being computed */
  pending: boolean
  error: string | null
}

/**
 * Run simulation tasks in the worker pool whenever `tasks` changes (pass a memoized array). Results are
 * returned in the same order once all of them finish; earlier results stay visible meanwhile.
 * A `null` entry is skipped and yields `null`.
 */
export function useSimulations<T extends SimTask>(tasks: (T | null)[]): SimState<(SimResult<T> | null)[], T> {
  const group = useId()
  const latest = useRef(0)
  // Results remember which task list produced them, so "pending" is derived instead of stored
  const [state, setState] = useState<{
    data: (SimResult<T> | null)[] | null
    dataTasks: (T | null)[] | null
    forTasks: unknown
    error: string | null
  }>({ data: null, dataTasks: null, forTasks: null, error: null })

  useEffect(() => {
    const run = ++latest.current
    Promise.all(tasks.map((task, i) => (task ? runSimulation(task, `${group}:${i}`) : Promise.resolve(null))))
      .then((data) => {
        if (run === latest.current) setState({ data, dataTasks: tasks, forTasks: tasks, error: null })
      })
      .catch((err) => {
        if (err instanceof Superseded || run !== latest.current) return
        setState((s) => ({ ...s, forTasks: tasks, error: err instanceof Error ? err.message : String(err) }))
      })
  }, [tasks, group])

  return { data: state.data, dataTasks: state.dataTasks, pending: state.forTasks !== tasks, error: state.error }
}

export interface BatchState<R> {
  /** Results by key as they arrive; a key not re-run yet keeps its earlier result */
  values: Record<string, R>
  /** How many of the current jobs have finished */
  done: number
  error: string | null
}

/** A batch state after one job of `jobs` finishes, well or not; the first job of a new batch starts the count over */
export function settleJob<R>(
  state: BatchState<R> & { forJobs: unknown },
  jobs: unknown,
  outcome: { key: string; value: R } | { key: string; error: string },
): BatchState<R> & { forJobs: unknown } {
  const same = state.forJobs === jobs
  // A failed job drops its earlier result, which would otherwise pass for this batch's
  const values = { ...state.values }
  if ('value' in outcome) values[outcome.key] = outcome.value
  else delete values[outcome.key]
  return {
    values,
    done: (same ? state.done : 0) + 1,
    error: 'error' in outcome ? outcome.error : same ? state.error : null,
    forJobs: jobs,
  }
}

/**
 * Run a large batch at background priority (pass a memoized array), showing each result as it arrives. Queued jobs are
 * dropped when the jobs change or the component goes away.
 */
export function useBackgroundSimulations<T extends SimTask>(jobs: { key: string; task: T }[]): BatchState<SimResult<T>> {
  const group = useId()
  const [state, setState] = useState<BatchState<SimResult<T>> & { forJobs: unknown }>({ values: {}, done: 0, error: null, forJobs: null })

  useEffect(() => {
    let active = true
    for (const { key, task } of jobs) {
      runSimulation(task, `${group}:${key}`, true)
        .then((value) => {
          if (active) setState((s) => settleJob(s, jobs, { key, value }))
        })
        .catch((err) => {
          if (err instanceof Superseded || !active) return
          setState((s) => settleJob(s, jobs, { key, error: err instanceof Error ? err.message : String(err) }))
        })
    }
    return () => {
      active = false
      cancelQueued(`${group}:`)
    }
  }, [jobs, group])

  const current = state.forJobs === jobs
  return { values: state.values, done: current ? state.done : 0, error: current ? state.error : null }
}

/** Single-task version of useSimulations (pass a memoized task). */
export function useSimulation<T extends SimTask>(task: T | null): SimState<SimResult<T> | null, T> {
  const tasks = useMemo(() => [task], [task])
  const { data, dataTasks, pending, error } = useSimulations(tasks)
  return { data: data ? data[0] : null, dataTasks, pending, error }
}
