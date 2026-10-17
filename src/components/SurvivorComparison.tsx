import { type MonteCarloResult, type Plan } from '../engine'
import { endLabel } from '../utils/labels'
import { OutcomeComparison } from './OutcomeComparison'

/** Couples: both living to the plan age vs. one dying at the chosen age. */
export function SurvivorComparison({ plan, withDeath, bothLive }: { plan: Plan; withDeath: MonteCarloResult; bothLive: MonteCarloResult }) {
  const s = plan.survivor
  return (
    <OutcomeComparison
      title="If one of you dies first"
      description={
        <>
          {s.whoDies === 'you' ? 'You die' : 'Your spouse dies'} at {s.firstDeathAge}: the survivor gets the larger of their
          own and a survivor Social Security benefit, spends {Math.round(s.spendingShare * 100)}% of what you spend
          together, and files as single from the next year.
        </>
      }
      endAge={endLabel(plan)}
      baseLabel="Both live"
      changedLabel={`${s.whoDies === 'you' ? 'You die' : 'Spouse dies'} at ${s.firstDeathAge}`}
      base={bothLive}
      changed={withDeath}
    />
  )
}
