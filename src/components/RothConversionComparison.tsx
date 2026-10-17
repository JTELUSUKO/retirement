import type { MonteCarloResult, Plan, ProjectionResult } from '../engine'
import { formatUSDCompact } from '../utils/format'
import { endLabel } from '../utils/labels'
import { OutcomeComparison } from './OutcomeComparison'

const real = (p: ProjectionResult, pick: (y: ProjectionResult['years'][number]) => number) =>
  p.years.reduce((sum, y) => sum + pick(y) / y.priceLevel, 0)

/** The plan with vs. without its Roth conversions. */
export function RothConversionComparison(props: {
  plan: Plan
  withConversions: MonteCarloResult
  without: MonteCarloResult
  withProjection: ProjectionResult
  withoutProjection: ProjectionResult
}) {
  const { plan, withConversions, without, withProjection, withoutProjection } = props
  const c = plan.rothConversion
  const converted = real(withProjection, (y) => y.rothConversion)
  const lastRoth = (p: ProjectionResult) => p.years.at(-1)!.startByBucketReal.roth
  // Money left after the tax still owed on pre-tax savings, estimated at the bracket being filled
  const afterTaxLeft = (p: ProjectionResult) => {
    const b = p.years.at(-1)!.startByBucketReal
    return b.roth + b.taxable + b.cash + b.hsa + b.pretax * (1 - c.fillToRate)
  }
  return (
    <OutcomeComparison
      title="Roth conversions: with vs. without"
      description={
        <>
          Filling the {Math.round(c.fillToRate * 100)}% bracket converts about {formatUSDCompact(converted)} in total
          (today's dollars). Paying that tax early can lower the simulated totals, because pre-tax money left over still
          owes tax that the totals don't show; the after-tax row compares like with like. Rows from “Income tax” down
          use typical returns.
        </>
      }
      endAge={endLabel(plan)}
      baseLabel="Without"
      changedLabel="With conversions"
      base={without}
      changed={withConversions}
      extraRows={[
        {
          label: 'Income tax + Medicare surcharges over retirement',
          base: real(withoutProjection, (y) => y.tax + y.irmaa),
          changed: real(withProjection, (y) => y.tax + y.irmaa),
          format: formatUSDCompact,
          lowerIsBetter: true,
        },
        {
          label: `Left at ${endLabel(plan)} after tax on pre-tax money (at ${Math.round(c.fillToRate * 100)}%), typical returns`,
          base: afterTaxLeft(withoutProjection),
          changed: afterTaxLeft(withProjection),
          format: formatUSDCompact,
        },
        {
          label: `Roth savings at ${endLabel(plan)}, typical returns`,
          base: lastRoth(withoutProjection),
          changed: lastRoth(withProjection),
          format: formatUSDCompact,
        },
      ]}
    />
  )
}
