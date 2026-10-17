import { payoutRate, type MonteCarloResult, type Plan } from '../engine'
import { formatUSD, formatUSDCompact } from '../utils/format'
import { OutcomeComparison } from './OutcomeComparison'

/** The plan with vs. without its annuity purchase. */
export function AnnuityComparison({ plan, withAnnuity, withoutAnnuity }: { plan: Plan; withAnnuity: MonteCarloResult; withoutAnnuity: MonteCarloResult }) {
  const a = plan.annuityPurchase
  return (
    <OutcomeComparison
      title="Annuity: with vs. without"
      description={
        <>
          Buying {formatUSDCompact(a.amount)} at {a.purchaseAge} for about {formatUSD(a.amount * payoutRate(a, plan.filingStatus))}/yr
          for life (today's dollars). Savings left are in today's dollars; the annuity itself is worth nothing to heirs.
        </>
      }
      planToAge={plan.lifeExpectancy}
      baseLabel="Without"
      changedLabel="With annuity"
      base={withoutAnnuity}
      changed={withAnnuity}
    />
  )
}
