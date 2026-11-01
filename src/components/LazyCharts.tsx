import { lazy, Suspense, type ComponentProps } from 'react'

// The charting library is the largest part of the app, so charts load after the first paint.
// Each placeholder has the chart's height, so the page doesn't jump when the chart arrives.
const Probability = lazy(() => import('./ProbabilityChart').then((m) => ({ default: m.ProbabilityChart })))
const Bucket = lazy(() => import('./BucketChart').then((m) => ({ default: m.BucketChart })))

const placeholder = (height: string) => <div className={`${height} w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800`} aria-label="Loading chart" />

export function ProbabilityChart(props: ComponentProps<typeof Probability>) {
  return (
    <Suspense fallback={placeholder('h-80')}>
      <Probability {...props} />
    </Suspense>
  )
}

export function BucketChart(props: ComponentProps<typeof Bucket>) {
  return (
    <Suspense fallback={placeholder('h-72')}>
      <Bucket {...props} />
    </Suspense>
  )
}
