import { TAX_CONFIG, type Plan } from '../engine'
import { formatUSD } from '../utils/format'
import { HEAT_NOISE_POINTS, showsClaimingWhileWorking, showsRetiringEarly, type HeatGrid } from '../utils/heatmap'
import { ssaEstimateAssumes, stopsEarningEarly } from '../utils/socialSecurityNotes'

const { fullRetirementAge, earningsLimit, earningsWithholdingRate } = TAX_CONFIG.socialSecurity

/** What the chart's numbers assume and how far to trust them */
export function HeatmapNotes({ plan, grid }: { plan: Plan; grid: HeatGrid }) {
  const married = plan.filingStatus === 'married'
  const hasPay = plan.annualPay > 0 && (!married || plan.spouseSocialSecurityAtFRA <= 0 || plan.spouseAnnualPay > 0)
  // The plan's own ages decide whose estimate the note is about; the grid decides whether it's needed
  const earlyInPlan = stopsEarningEarly(plan, plan.retirementAge)
  return (
    <div className="space-y-1 text-xs text-muted">
      {showsClaimingWhileWorking(grid, plan) && (
        <p>
          <strong className="font-semibold">Claiming while still working:</strong> before {fullRetirementAge}, pay above{' '}
          {formatUSD(earningsLimit)} a year holds back $1 of benefits for every {`$${1 / earningsWithholdingRate}`}, and the months held back raise the benefit
          from {fullRetirementAge}.{' '}
          {hasPay
            ? 'These squares use the pay in your plan.'
            : 'Without pay in your plan, these squares assume those benefits are held back in full; add it under Spending & Social Security.'}{' '}
          Benefits received while working are taxed on top of pay.
        </p>
      )}
      {showsRetiringEarly(grid, plan) && (
        <p>
          <strong className="font-semibold">Stopping work before {fullRetirementAge}:</strong> these squares use the Social
          Security {married ? 'amounts' : 'amount'} in your plan. {ssaEstimateAssumes(married && plan.spouseSocialSecurityAtFRA > 0 ? 'both' : 'you')}{' '}
          Stopping sooner can lower a benefit, so unless your plan already allows for that, the real chance could be lower
          than shown.
          {earlyInPlan &&
            ` If you already lowered ${earlyInPlan === 'spouse' ? 'your spouse’s' : 'your'} amount for stopping early, squares that work until ${fullRetirementAge} or later use that lower amount too, so their real chance could be higher than shown.`}
        </p>
      )}
      <p>
        Each combination is an estimate from 1,000 simulated markets with the rest of your plan unchanged. A number could be
        a few points off, so one near a color boundary could really belong on the other side of it, and a square within{' '}
        {HEAT_NOISE_POINTS} points of your plan is called about the same.
        {married && ` You retire together; your spouse’s claiming age stays at ${plan.spouseClaimAge}.`}
      </p>
    </div>
  )
}
