import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { runSimulation, Superseded } from './pool'
import type { SimResult, SimTask } from './tasks'

export interface SimState<T> {
  /** Latest finished result (kept while a newer one runs), or null before the first one */
  data: T | null
  /** A newer result is being computed */
  pending: boolean
  error: string | null
}

/**
 * Run simulation tasks in the worker pool whenever `tasks` changes (pass a memoized array). Results are
 * returned in the same order once all of them finish; earlier results stay visible meanwhile.
 * A `null` entry is skipped and yields `null`.
 */
export function useSimulations<T extends SimTask>(tasks: (T | null)[]): SimState<(SimResult<T> | null)[]> {
  const group = useId()
  const latest = useRef(0)
  // Results remember which task list produced them, so "pending" is derived instead of stored
  const [state, setState] = useState<{ data: (SimResult<T> | null)[] | null; forTasks: unknown; error: string | null }>({
    data: null,
    forTasks: null,
    error: null,
  })

  useEffect(() => {
    const run = ++latest.current
    Promise.all(tasks.map((task, i) => (task ? runSimulation(task, `${group}:${i}`) : Promise.resolve(null))))
      .then((data) => {
        if (run === latest.current) setState({ data, forTasks: tasks, error: null })
      })
      .catch((err) => {
        if (err instanceof Superseded || run !== latest.current) return
        setState((s) => ({ ...s, forTasks: tasks, error: err instanceof Error ? err.message : String(err) }))
      })
  }, [tasks, group])

  return { data: state.data, pending: state.forTasks !== tasks, error: state.error }
}

/** Single-task version of useSimulations (pass a memoized task). */
export function useSimulation<T extends SimTask>(task: T | null): SimState<SimResult<T> | null> {
  const tasks = useMemo(() => [task], [task])
  const { data, pending, error } = useSimulations(tasks)
  return { data: data ? data[0] : null, pending, error }
}
