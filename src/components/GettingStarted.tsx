import { missingEssentials, type Plan } from '../engine'

/** Shown instead of results until the essentials are filled in. */
export function GettingStarted({ plan, onPlanTab = true }: { plan: Plan; onPlanTab?: boolean }) {
  const missing = missingEssentials(plan)
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
        Then add your accounts, Social Security estimate and any other income. Or click <strong>Load example</strong> to
        explore with sample numbers.
      </p>
    </section>
  )
}
