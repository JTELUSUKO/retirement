import { lazy, Suspense, useEffect, useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Footer } from './components/Footer'
import { DisclaimerBanner } from './components/Disclaimer'
import { tabClass } from './components/styles'

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

  const tabStyle = (value: Page) => tabClass(page === value)

  const tab = (value: Page, label: string, hash: string) => (
    <a href={hash} aria-current={page === value ? 'page' : undefined} className={`px-3 py-1.5 text-sm font-medium ${tabStyle(value)}`}>
      {label}
    </a>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 print:p-0">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Retirement Planner</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Everything you enter stays in this browser.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {tab('plan', 'My plan', '#plan')}
          {tab('compare', 'Compare scenarios', '#compare')}
          {/* The summary is the printable report, so it's a printer icon rather than another tab */}
          <a
            href="#summary"
            aria-current={page === 'summary' ? 'page' : undefined}
            aria-label="Printable summary"
            title="Printable summary"
            className={`inline-flex items-center px-2.5 py-1.5 ${tabStyle('summary')}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="7" />
            </svg>
          </a>
          {/* Ask Claude is hidden from the menu; it still opens at #ask */}
          {page === 'ask' && tab('ask', 'Ask Claude', '#ask')}
        </nav>
      </header>
      <div className="mb-8">
        <DisclaimerBanner />
      </div>
      <main>
        {page === 'plan' && <Dashboard />}
        <Suspense fallback={<p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}>
          {page === 'compare' && <Scenarios />}
          {page === 'summary' && <Summary />}
          {page === 'terms' && <Terms />}
          {page === 'ask' && <Ask />}
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
