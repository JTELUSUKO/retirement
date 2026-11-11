import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import type { Plan } from '../engine'
import { useBackgroundSimulations } from '../sim/useSimulation'
import { MAX_SCENARIOS, usePlanStore } from '../store/planStore'
import { claimsWhileWorking, HEAT_BANDS, heatBand, heatCellPatch, heatCheer, heatDelta, heatKey, heatmapGrid, heatPct, heatUndoPatch, nearestStrong, type HeatCell, type HeatCheer } from '../utils/heatmap'
import { VERDICT_WORD, verdictFor, type Verdict } from '../utils/levers'
import { endLabel } from '../utils/labels'
import { HeatmapNotes } from './HeatmapNotes'
import { CheerText, HeatmapSelection, TRADE_OFFS } from './HeatmapSelection'
import { HeatmapTakeaway } from './HeatmapTakeaway'
import { InfoTip } from './InfoTip'
import { ScrollRegion } from './ScrollRegion'

const PLAN_RING = 'ring-2 ring-slate-900 ring-offset-1 ring-offset-white dark:ring-white dark:ring-offset-slate-900'
// The age column stays put while the cells scroll under it; the shadow also covers the gaps between cells
const STICKY = 'sticky left-0 z-20 bg-white shadow-[0_0_0_3px_var(--color-white)] dark:bg-slate-900 dark:shadow-[0_0_0_3px_var(--color-slate-900)]'
const STEP: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

/** The color key, grouped by what the colors mean */
const KEY_GROUPS = (['at-risk', 'borderline', 'strong'] as Verdict[]).map((verdict) => ({
  word: VERDICT_WORD[verdict].charAt(0).toUpperCase() + VERDICT_WORD[verdict].slice(1),
  bands: HEAT_BANDS.filter((band) => verdictFor(band.upTo / 100) === verdict),
}))

/**
 * Keeps an element at least as tall as it has been at this width. The text above the chart gets longer and shorter as
 * numbers arrive; without this, everything below it (Undo, Apply) moves at that moment and a tap can miss. Browsers
 * that anchor scrolling hide the move; Safari doesn't.
 */
function useHeldHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const held = useRef({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.offsetWidth !== held.current.width) {
      el.style.minHeight = ''
      held.current = { width: el.offsetWidth, height: 0 }
    }
    if (el.offsetHeight > held.current.height) {
      held.current.height = el.offsetHeight
      el.style.minHeight = `${el.offsetHeight}px`
    }
  })
  return ref
}

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
  // The plan as Apply or Undo left it: their notes, and Undo itself, last until the saved plan changes again
  const latestPlan = usePlanStore((s) => s.plan)
  const [applied, setApplied] = useState<{ after: Plan; cheer: HeatCheer | null; undo: Partial<Plan> } | null>(null)
  const [undone, setUndone] = useState<Plan | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  // A cell to focus once the grid has it (Undo can return to ages the current grid doesn't show yet)
  const pendingFocus = useRef<string | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const headRef = useHeldHeight()
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
    // With newer edits waiting behind these results, the message might not hold for the plan this lands on
    const latest = usePlanStore.getState().plan
    const upToDate = latest === plan
    const patch = heatCellPatch(latest, plan, cell)
    update(patch)
    setSelectedKey(null)
    setFocusKey(cell.key)
    setUndone(null)
    setApplied({ after: usePlanStore.getState().plan, cheer: upToDate ? cheer : null, undo: heatUndoPatch(patch, latest) })
    focusCell(cell.key)
  }
  const undoApply = (undo: Partial<Plan>) => {
    update(undo)
    setApplied(null)
    setUndone(usePlanStore.getState().plan)
    // The Undo link is going away, so focus moves to the cell you're back on
    const key = heatKey(usePlanStore.getState().plan.retirementAge, usePlanStore.getState().plan.socialSecurityClaimAge)
    setFocusKey(key)
    pendingFocus.current = key
    if (cellButton(key)) {
      focusCell(key)
      pendingFocus.current = null
    }
  }
  useEffect(() => {
    if (pendingFocus.current && cellButton(pendingFocus.current)) {
      focusCell(pendingFocus.current)
      pendingFocus.current = null
    }
    // The grid is what brings the cell into being
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid])
  const compare = (cell: HeatCell) => {
    addScenario({
      name: `What-if: retire ${cell.retirementAge}, SS at ${cell.claimAge}`,
      // Both ages, so the scenario still matches its name if the plan changes later
      overrides: { retirementAge: cell.retirementAge, socialSecurityClaimAge: cell.claimAge },
      stress: 'none',
    })
    window.location.hash = '#compare'
  }

  const describe = (cell: HeatCell, rate: number | undefined) =>
    [
      `Retire at ${cell.retirementAge}, claim at ${cell.claimAge}: ${rate === undefined ? 'calculating' : `${heatPct(rate)}% chance`}`,
      cell.key === planKey && 'your plan',
      claimsWhileWorking(plan, cell.retirementAge, cell.claimAge) && 'benefits start while still working, see the note below',
    ]
      .filter(Boolean)
      .join(', ')

  // While a new batch runs, the selected cell's number may still be the old plan's
  const selectedRate = selected && !updating ? values[selected.key] : undefined
  const planRate = values[planKey]
  const delta = !updating && selectedRate !== undefined && planRate !== undefined ? heatDelta(selectedRate, planRate) : null
  const cheer = delta && selectedRate !== undefined && planRate !== undefined ? heatCheer(heatPct(selectedRate), heatPct(planRate)) : null

  // The takeaway, once every number is in
  const closest = !updating && planRate !== undefined && verdictFor(planRate) !== 'strong' ? nearestStrong(grid, values, plan) : null
  const selectCell = (key: string) => {
    setSelectedKey(key)
    setFocusKey(key)
    setUndone(null)
  }
  // The cell can be off to the side, and its comparison below the fold, on a small screen
  const showCell = (key: string) => {
    flushSync(() => selectCell(key))
    focusCell(key)
    const button = cellButton(key)
    const detail = detailRef.current
    if (!button || !detail) return
    button.scrollIntoView({ inline: 'center', block: 'center' })
    // Bring up as much of the comparison as fits, without losing the cell off the top
    const hidden = detail.getBoundingClientRect().bottom - window.innerHeight
    if (hidden > 0) window.scrollBy(0, Math.min(hidden + 8, button.getBoundingClientRect().top - 8))
  }

  return (
    <div className="mt-3 space-y-3">
      <div ref={headRef} className="space-y-3">
        {!error && (
          <HeatmapTakeaway plan={plan} updating={updating} planRate={planRate} closest={closest} closestRate={closest ? values[closest.key] : undefined} onShow={showCell} />
        )}

        <div className="flex items-start gap-1">
          <p aria-live="polite" className="min-h-5 text-sm text-muted tabular-nums">
            {error ? (
              <span className="text-red-700 dark:text-red-400">✕ The simulation failed: {error}</span>
            ) : updating ? (
              <>
                Calculating… <span aria-hidden="true">{done} of {jobs.length} done</span>
              </>
            ) : (
              'Select a square to compare it with your plan.'
            )}
          </p>
          <InfoTip label="reading this chart">
            <span className="block">
              Each square is your chance of the money lasting if you retire at the age above it and claim Social Security at
              the age beside it. The rest of your plan stays the same.
            </span>
            <span className="mt-1.5 block">
              The square with the bold outline is your plan. Moving right (retiring later) or up (claiming later) usually helps.
            </span>
            <span className="mt-1.5 block">
              A – means your plan’s other settings rule that combination out. Select any square with a number to compare it
              with your plan; nothing changes until you apply it.
            </span>
          </InfoTip>
        </div>

        <p className="text-xs text-muted">Each number is the % chance your money lasts. Further right is retiring later; higher up is claiming later.</p>
      </div>

      <ScrollRegion label="Chance money lasts by retirement age and Social Security claiming age" className="overflow-x-auto pb-1">
        <table ref={tableRef} role="grid" aria-label={`Chance money lasts to ${endLabel(plan)}, by retirement age and Social Security claiming age`} className="w-full border-separate border-spacing-[3px] text-xs select-none">
          <thead>
            <tr>
              <th scope="col" className={`${STICKY} px-1 pb-1 text-left align-bottom font-medium whitespace-nowrap text-muted`}>
                Claim at age ↑
              </th>
              <th scope="colgroup" colSpan={grid.retireAges.length} className="pb-1 text-left font-medium text-muted">
                {/* Stays beside the age column while the cells scroll */}
                <span className="sticky left-28 inline-block">Retire at age →</span>
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
                  const color = rate === undefined ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : heatBand(rate).className
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
                        onClick={() => selectCell(cell.key)}
                        onKeyDown={(event) => onKeyDown(event, cell)}
                        className={`h-9 w-full cursor-pointer rounded font-medium tabular-nums hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600 dark:hover:brightness-125 ${color} ${cell.key === planKey ? PLAN_RING : ''} ${cell.key === selectedKey ? 'outline-2 outline-offset-1 outline-slate-900 outline-dashed dark:outline-white' : ''}`}
                      >
                        {rate === undefined ? '·' : heatPct(rate)}
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
        {KEY_GROUPS.map(({ word, bands }) => (
          <li key={word} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="font-semibold">{word}:</span>
            {bands.map((band) => (
              <span key={band.label} className="flex items-center gap-1">
                <span aria-hidden="true" className={`h-3 w-5 rounded-sm border border-slate-300 dark:border-slate-600 ${band.className}`} />
                {band.label}
              </span>
            ))}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-5 rounded-sm ${PLAN_RING}`} />
          Your plan
        </li>
      </ul>

      <div ref={detailRef} aria-live="polite" className="space-y-2">
        {applied && latestPlan === applied.after && (
          <>
            <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
              ✓ Applied to your plan.
              {applied.cheer && (
                <>
                  {' '}
                  <CheerText cheer={applied.cheer} />
                </>
              )}{' '}
              <button type="button" onClick={() => undoApply(applied.undo)} className="underline underline-offset-2">
                Undo
              </button>
              <InfoTip label="undo">Puts your retirement and claiming ages back to what they were before you applied this, along with an annuity purchase that moved with them. Nothing else in your plan changes.</InfoTip>
            </p>
            {applied.cheer && <p className="text-xs text-muted">{TRADE_OFFS}</p>}
          </>
        )}
        {undone && latestPlan === undone && <p className="text-sm font-medium text-muted">↩ Your plan is back to how it was.</p>}
        {selected && (
          <HeatmapSelection plan={plan} selected={selected} rate={selectedRate} delta={delta} cheer={cheer} compareFull={full} onApply={apply} onCompare={compare} />
        )}
      </div>

      <HeatmapNotes plan={plan} grid={grid} />
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
        <span className="mt-0.5 block text-sm font-normal text-muted">See your chance of the money lasting to {endLabel(plan)}, for each combination</span>
      </summary>
      {open && <Grid plan={plan} />}
    </details>
  )
}
