import { missingEssentials, type Plan } from '../engine'
import { usePlanStore } from '../store/planStore'
import { useUiPrefs } from '../store/uiPrefs'
import { PRIMARY, SECONDARY } from './styles'

/** Shown instead of results until the essentials are filled in. */
export function GettingStarted({ plan, onPlanTab = true }: { plan: Plan; onPlanTab?: boolean }) {
  const missing = missingEssentials(plan)
  const setGuide = useUiPrefs((s) => s.setGuide)
  const loadExample = usePlanStore((s) => s.loadExample)
  return (
    <section className="h-fit rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
      <h2 className="font-medium text-slate-900 dark:text-slate-100">Add your numbers to see results</h2>
      <p className="mt-1">
        {onPlanTab ? 'Still needed:' : 'Fill in your plan on the “My plan” tab first. Still needed:'}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {missing.map((m) => (
          <li key={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</li>
        ))}
      </ul>
      <p className="mt-3">
        Then add your accounts, Social Security estimate and any other income. Or load an example to explore with sample
        numbers.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setGuide('open')
            window.location.hash = '#plan'
          }}
          className={`${PRIMARY} px-4 py-2 text-sm`}
        >
          Use the guided setup
        </button>
        {/* Loads here, so the Compare and Summary tabs show results straight away (Undo is offered on My plan) */}
        <button
          type="button"
          onClick={loadExample}
          className={`${SECONDARY} px-4 py-2 text-sm font-medium`}
        >
          Load example
        </button>
      </div>
    </section>
  )
}
