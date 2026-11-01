import { lazy, Suspense, useEffect, useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Footer } from './components/Footer'
import { DisclaimerBanner } from './components/Disclaimer'

// Pages other than "My plan" load on first visit, keeping the first download small (Ask holds the Anthropic SDK)
const Scenarios = lazy(() => import('./pages/Scenarios').then((m) => ({ default: m.Scenarios })))
const Summary = lazy(() => import('./pages/Summary').then((m) => ({ default: m.Summary })))
const Terms = lazy(() => import('./pages/Terms').then((m) => ({ default: m.Terms })))
const Ask = lazy(() => import('./pages/Ask').then((m) => ({ default: m.Ask })))

type Page = 'plan' | 'compare' | 'summary' | 'ask' | 'terms'

const PAGES: Page[] = ['plan', 'compare', 'summary', 'ask', 'terms']
const pageFromHash = (): Page => PAGES.find((p) => window.location.hash === `#${p}`) ?? 'plan'

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash)

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const tab = (value: Page, label: string, hash: string) => (
    <a
      href={hash}
      aria-current={page === value ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        page === value
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </a>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 print:p-0">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Retirement Planner</h1>
          <p className="text-sm text-slate-500">Everything you enter stays in this browser.</p>
        </div>
        <nav className="flex flex-wrap gap-1">
          {tab('plan', 'My plan', '#plan')}
          {tab('compare', 'Compare scenarios', '#compare')}
          {tab('summary', 'Print summary', '#summary')}
          {/* Ask Claude is hidden from the menu; it still opens at #ask */}
          {page === 'ask' && tab('ask', 'Ask Claude', '#ask')}
        </nav>
      </header>
      <div className="mb-8">
        <DisclaimerBanner />
      </div>
      {page === 'plan' && <Dashboard />}
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        {page === 'compare' && <Scenarios />}
        {page === 'summary' && <Summary />}
        {page === 'terms' && <Terms />}
        {page === 'ask' && <Ask />}
      </Suspense>
      <Footer />
    </div>
  )
}
