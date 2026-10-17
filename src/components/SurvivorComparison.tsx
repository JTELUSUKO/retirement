import type { MonteCarloResult, Plan } from '../engine'
import { OutcomeComparison } from './OutcomeComparison'

/** Couples: both living to the plan age vs. one dying at the chosen age. */
export function SurvivorComparison({ plan, withDeath, bothLive }: { plan: Plan; withDeath: MonteCarloResult; bothLive: MonteCarloResult }) {
  const s = plan.survivor
  return (
    <OutcomeComparison
      title="If one of you dies first"
      description={
        <>
          One of you dies at {s.firstDeathAge}: the survivor keeps the larger Social Security benefit, spends{' '}
          {Math.round(s.spendingShare * 100)}% of what you spend together, and files as single from the next year.
        </>
      }
      planToAge={plan.lifeExpectancy}
      baseLabel="Both live"
      changedLabel={`One dies at ${s.firstDeathAge}`}
      base={bothLive}
      changed={withDeath}
    />
  )
}
