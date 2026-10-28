import { useRef, useState } from 'react'
import { backupFileName, MAX_FILE_BYTES, parsePlanFile, serializePlan } from '../store/planFile'
import { usePlanStore } from '../store/planStore'
import { useUiPrefs } from '../store/uiPrefs'

const button =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'

const undoMessage = { cleared: 'Plan reset to blank.', example: 'Example plan loaded.', imported: 'Plan imported.' }

/** "Plan reset to blank. Undo" after the last Reset / Load example / Import. Also shown above the guided setup. */
export function UndoBar() {
  const { undo, undoLast } = usePlanStore()
  if (!undo) return null
  return (
    <div role="status" className="flex items-center justify-between rounded-md bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900">
      <span>{undoMessage[undo.action]}</span>
      <button type="button" onClick={undoLast} className="font-medium underline underline-offset-2">Undo</button>
    </div>
  )
}

/** Reset / Load example / Export / Import / Guided setup, with an Undo bar and import errors. */
export function PlanToolbar() {
  const { plan, clear, loadExample, importPlan } = usePlanStore()
  const setGuide = useUiPrefs((s) => s.setGuide)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const exportPlan = () => {
    const url = URL.createObjectURL(new Blob([serializePlan(plan)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName()
    link.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is too large to be a plan backup.')
      return
    }
    const result = parsePlanFile(await file.text())
    if (result.ok) importPlan(result.plan)
    else setError(result.error)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            clear()
            setGuide('auto') // a blank plan opens the guided setup again
          }}
          className={button}
          title="Start over with a blank plan (you can undo)"
        >
          Reset
        </button>
        <button type="button" onClick={loadExample} className={button}>Load example</button>
        <button type="button" onClick={exportPlan} className={button}>Export</button>
        <button type="button" onClick={() => fileInput.current?.click()} className={button}>Import</button>
        <button type="button" onClick={() => setGuide('open')} className={button} title="Walk through the basics step by step">
          Guided setup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = '' // allow picking the same file again
          }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Your plan is saved only in this browser. Use Export to keep a backup or move it to another device.
      </p>
      <UndoBar />
      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-l-4 border-slate-200 border-l-red-600 px-3 py-2 text-sm dark:border-slate-800 dark:border-l-red-500">
          <span>✕ Couldn’t import: {error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}
    </div>
  )
}
