import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Plan } from '../engine'
import { useBackgroundSimulations } from '../sim/useSimulation'
import { MAX_SCENARIOS, usePlanStore } from '../store/planStore'
import { HEAT_BANDS, HEAT_FLOOR, heatBand, heatCellPatch, heatDelta, heatKey, heatmapGrid, heatPct, isHeatFloor, type HeatCell } from '../utils/heatmap'
import { endLabel } from '../utils/labels'
import { Icon } from './Icons'
import { ScrollRegion } from './ScrollRegion'
import { PRIMARY, SECONDARY } from './styles'

const PLAN_RING = 'ring-2 ring-slate-900 ring-offset-1 ring-offset-white dark:ring-white dark:ring-offset-slate-900'
// The age column stays put while the cells scroll under it; the shadow also covers the gaps between cells
const STICKY = 'sticky left-0 z-20 bg-white shadow-[0_0_0_3px_var(--color-white)] dark:bg-slate-900 dark:shadow-[0_0_0_3px_var(--color-slate-900)]'
const STEP: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

function Grid({ plan }: { plan: Plan }) {
  const update = usePlanStore((s) => s.update)
  const addScenario = usePlanStore((s) => s.addScenario)
  const full = usePlanStore((s) => s.plan.scenarios.length >= MAX_SCENARIOS)
  const grid = useMemo(() => heatmapGrid(plan), [plan])
  const jobs = useMemo(
    () => grid.cells.flatMap((c) => (c.plan ? [{ key: c.key, task: { kind: 'successRate' as const, plan: c.plan } }] : [])),
    [grid],
  )
  const { values, done, error } = useBackgroundSimulations(jobs)
  const updating = done < jobs.length

  const planKey = heatKey(plan.retirementAge, plan.socialSecurityClaimAge)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(planKey)
  // The plan before and after Apply: the "applied" note lasts until the plan changes again
  const [applied, setApplied] = useState<{ before: Plan; after: Plan } | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const cellsByKey = useMemo(() => new Map(grid.cells.map((c) => [c.key, c])), [grid])
  const cellAt = (key: string | null) => (key === null ? null : (cellsByKey.get(key) ?? null))
  // A plan edit can rule out the selected combination
  const selected = cellAt(selectedKey)?.plan ? cellAt(selectedKey) : null
  // One tab stop for the whole chart; the arrow keys move inside it
  const tabStop = cellAt(focusKey)?.plan ? focusKey : planKey
  const cellButton = (key: string) => tableRef.current?.querySelector<HTMLButtonElement>(`[data-key="${key}"]`)
  const focusCell = (key: string) => cellButton(key)?.focus()

  // On a narrow screen, open on your plan rather than on the earliest ages
  useLayoutEffect(() => {
    const box = tableRef.current?.parentElement
    const button = cellButton(planKey)
    if (!box || !button) return
    const offset = button.getBoundingClientRect().left - box.getBoundingClientRect().left
    box.scrollLeft += offset - (box.clientWidth - button.offsetWidth) / 2
    // Only when the chart opens; after that the scroll position is the reader's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (event: KeyboardEvent, cell: HeatCell) => {
    const step = STEP[event.key]
    if (!step) return
    event.preventDefault()
    let row = grid.claimAges.indexOf(cell.claimAge)
    let column = grid.retireAges.indexOf(cell.retirementAge)
    // Skip over combinations that can't be tested, and stay put at the edge
    for (;;) {
      row += step[0]
      column += step[1]
      if (grid.claimAges[row] === undefined || grid.retireAges[column] === undefined) return
      const next = heatKey(grid.retireAges[column], grid.claimAges[row])
      if (cellAt(next)?.plan) {
        setFocusKey(next)
        focusCell(next)
        return
      }
    }
  }

  const apply = (cell: HeatCell) => {
    update(heatCellPatch(usePlanStore.getState().plan, plan, cell))
    setSelectedKey(null)
    setFocusKey(cell.key)
    setApplied({ before: plan, after: usePlanStore.getState().plan })
    focusCell(cell.key)
  }
  const compare = (cell: HeatCell) => {
    addScenario({
      name: `What-if: retire ${cell.retirementAge}, SS at ${cell.claimAge}`,
      // Both ages, so the scenario still matches its name if the plan changes later
      overrides: { retirementAge: cell.retirementAge, socialSecurityClaimAge: cell.claimAge },
      stress: 'none',
    })
    window.location.hash = '#compare'
  }

  const floorOf = (cell: HeatCell | null, rate: number | undefined) => cell !== null && rate !== undefined && isHeatFloor(cell, rate)
  const describe = (cell: HeatCell, rate: number | undefined) =>
    [
      `Retire at ${cell.retirementAge}, claim at ${cell.claimAge}: ${rate === undefined ? 'calculating' : `${floorOf(cell, rate) ? 'at least ' : ''}${heatPct(rate, floorOf(cell, rate))}% chance`}`,
      cell.key === planKey && 'your plan',
      floorOf(cell, rate) && 'benefits start before retiring, see the note below',
    ]
      .filter(Boolean)
      .join(', ')

  // While a new batch runs, the selected cell's number may still be the old plan's
  const selectedRate = selected && !updating ? values[selected.key] : undefined
  const selectedIsFloor = floorOf(selected, selectedRate)
  const planRate = values[planKey]
  const delta =
    !updating && selectedRate !== undefined && planRate !== undefined
      ? heatDelta(selectedRate, selectedIsFloor, planRate, floorOf(cellAt(planKey), planRate))
      : null

  return (
    <div className="mt-3 space-y-3">
      <p aria-live="polite" className="min-h-5 text-sm text-muted tabular-nums">
        {error ? (
          <span className="text-red-700 dark:text-red-400">✕ The simulation failed: {error}</span>
        ) : updating ? (
          <>
            Calculating… <span aria-hidden="true">{done} of {jobs.length} done</span>
          </>
        ) : (
          `All ${jobs.length} combinations ready. Select one to see what it would change.`
        )}
      </p>

      <ScrollRegion label="Chance money lasts by retirement age and Social Security claiming age" className="overflow-x-auto pb-1">
        <table ref={tableRef} role="grid" aria-label={`Chance money lasts to ${endLabel(plan)}, by retirement age and Social Security claiming age`} className="w-full border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th scope="col" className={`${STICKY} px-1 pb-1 text-left align-bottom font-medium whitespace-nowrap text-muted`}>
                Claim at ↑
              </th>
              <th scope="colgroup" colSpan={grid.retireAges.length} className="pb-1 text-left font-medium text-muted">
                Retire at →
              </th>
            </tr>
            <tr>
              <td className={STICKY} />
              {grid.retireAges.map((age) => (
                <th key={age} scope="col" className={`min-w-9 pb-0.5 tabular-nums ${age === plan.retirementAge ? 'font-bold' : 'font-medium text-muted'}`}>
                  {age}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.claimAges.map((claimAge) => (
              <tr key={claimAge}>
                <th scope="row" className={`${STICKY} pr-1 text-right tabular-nums ${claimAge === plan.socialSecurityClaimAge ? 'font-bold' : 'font-medium text-muted'}`}>
                  {claimAge}
                </th>
                {grid.retireAges.map((retirementAge) => {
                  const cell = cellAt(heatKey(retirementAge, claimAge))!
                  if (!cell.plan) {
                    return (
                      <td key={cell.key} className="h-9 rounded text-center text-muted" title={`Retire at ${retirementAge}, claim at ${claimAge}: your plan’s other settings rule this out`}>
                        <span aria-hidden="true">–</span>
                        <span className="sr-only">Not available</span>
                      </td>
                    )
                  }
                  const rate = values[cell.key]
                  const color =
                    rate === undefined
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : isHeatFloor(cell, rate)
                        ? HEAT_FLOOR
                        : heatBand(rate).className
                  const label = describe(cell, rate)
                  return (
                    <td key={cell.key} className="p-0">
                      <button
                        type="button"
                        data-key={cell.key}
                        tabIndex={cell.key === tabStop ? 0 : -1}
                        aria-label={label}
                        aria-pressed={cell.key === selectedKey}
                        title={label}
                        onClick={() => {
                          setSelectedKey(cell.key)
                          setFocusKey(cell.key)
                          setApplied(null)
                        }}
                        onKeyDown={(event) => onKeyDown(event, cell)}
                        className={`h-9 w-full cursor-pointer rounded font-medium tabular-nums hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600 dark:hover:brightness-125 ${color} ${cell.key === planKey ? PLAN_RING : ''} ${cell.key === selectedKey ? 'outline-2 outline-offset-1 outline-slate-900 outline-dashed dark:outline-white' : ''}`}
                      >
                        {rate === undefined ? '·' : heatPct(rate, isHeatFloor(cell, rate))}
                        {floorOf(cell, rate) && '+'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>

      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted" aria-label="Color key">
        {HEAT_BANDS.map((band) => (
          <li key={band.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-3 w-5 rounded-sm border border-slate-300 dark:border-slate-600 ${band.className}`} />
            {band.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-5 rounded-sm ${PLAN_RING}`} />
          Your plan
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-5 rounded-sm ${HEAT_FLOOR}`} />
          65+ means at least 65%
        </li>
      </ul>

      <div aria-live="polite">
        {applied && (plan === applied.before || plan === applied.after) && !selected && <p className="text-sm font-medium text-teal-700 dark:text-teal-300">✓ Applied to your plan</p>}
        {selected && (
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p>
              <strong className="font-semibold">
                Retire at {selected.retirementAge}, claim Social Security at {selected.claimAge}:
              </strong>{' '}
              {selectedRate === undefined ? (
                'calculating…'
              ) : (
                <span className="tabular-nums">
                  {selectedIsFloor && 'at least '}
                  {heatPct(selectedRate, selectedIsFloor)}% chance your money lasts to {endLabel(plan)}
                </span>
              )}
              {selected.key !== planKey && delta !== null && (
                <span className={`ml-1 font-medium tabular-nums ${delta.points > 0 ? 'text-teal-700 dark:text-teal-300' : delta.points < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted'}`}>
                  {delta.points === 0 ? 'No change' : `${delta.points > 0 ? '▲' : '▼'} ${delta.atLeast ? 'at least ' : ''}${Math.abs(delta.points)} ${Math.abs(delta.points) === 1 ? 'point' : 'points'}`} vs your plan
                </span>
              )}
              {selected.key === planKey && <span className="ml-1 text-muted">This is your plan.</span>}
            </p>
            {selectedIsFloor && (
              <p className="mt-1 text-xs text-muted">Benefits start before you retire, so the real chance may be higher. See the note below.</p>
            )}
            {selected.key !== planKey && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => apply(selected)} className={`${PRIMARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}>
                  <Icon name="check" size={15} />
                  Apply to my plan
                </button>
                <button
                  type="button"
                  onClick={() => compare(selected)}
                  disabled={full}
                  title={full ? `Compare holds up to ${MAX_SCENARIOS} scenarios; remove one first` : undefined}
                  className={`${SECONDARY} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}
                >
                  <Icon name="columns" size={15} />
                  Compare side by side
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted">
        <p>
          <strong className="font-semibold">Outlined cells with a +:</strong>{' '}
          {plan.filingStatus === 'married' ? 'you or your spouse would claim' : 'you’d claim'} before you retire. The lower
          benefit for claiming early is counted, but the checks that arrive before you retire aren’t, so the number is a
          floor and the real chance may be higher. Before full retirement age, the Social Security earnings limit can also
          withhold some of the checks of someone still working.
        </p>
        <p>
          Each combination runs 1,000 simulated markets with the rest of your plan unchanged.
          {plan.filingStatus === 'married' && ` You retire together; your spouse’s claiming age stays at ${plan.spouseClaimAge}.`}
        </p>
      </div>
    </div>
  )
}

/** The chance of success for every retirement and claiming age. The simulations only run while it's open. */
export function HeatmapPanel({ plan, open, onOpenChange }: { plan: Plan; open: boolean; onOpenChange: (open: boolean) => void }) {
  // Claiming age doesn't matter without a benefit of your own (the what-if slider hides too)
  if (plan.socialSecurityAtFRA <= 0) return null
  return (
    <details
      open={open}
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">
        Try every retirement and Social Security age
        <span className="mt-0.5 block text-sm font-normal text-muted">See your chance of success for every combination</span>
      </summary>
      {open && <Grid plan={plan} />}
    </details>
  )
}
