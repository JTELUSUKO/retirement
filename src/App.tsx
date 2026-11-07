import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Footer } from './components/Footer'
import { DisclaimerBanner } from './components/Disclaimer'
import { Logo } from './components/Logo'
import { CalculatorsMenu } from './components/Calculators'
import { Icon, type IconName } from './components/Icons'
import { ThemeSwitch } from './components/ThemeSwitch'
import { tabClass } from './components/styles'

// Pages other than "My plan" load on first visit, keeping the first download small (Ask holds the Anthropic SDK)
const Scenarios = lazy(() => import('./pages/Scenarios').then((m) => ({ default: m.Scenarios })))
const Summary = lazy(() => import('./pages/Summary').then((m) => ({ default: m.Summary })))
const Terms = lazy(() => import('./pages/Terms').then((m) => ({ default: m.Terms })))
const Ask = lazy(() => import('./pages/Ask').then((m) => ({ default: m.Ask })))

type Page = 'plan' | 'compare' | 'summary' | 'ask' | 'terms'

const PAGES: Page[] = ['plan', 'compare', 'summary', 'ask', 'terms']
const pageFromHash = (): Page => {
  // #print was briefly the printer icon's address; old links and bookmarks open the summary
  if (window.location.hash === '#print') history.replaceState(null, '', '#summary')
  return PAGES.find((p) => window.location.hash === `#${p}`) ?? 'plan'
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash)
  // The printer icon: print from the summary page, opening it first if needed
  const [printRequested, setPrintRequested] = useState(false)
  const printDone = useCallback(() => setPrintRequested(false), [])
  // Set by the summary page: prints right away (inside the click, which some browsers require) if it's ready
  const printNow = useRef<(() => boolean) | null>(null)
  const requestPrint = () => {
    if (page === 'summary' && printNow.current?.()) return
    setPrintRequested(true)
    if (page !== 'summary') window.location.hash = '#summary'
  }

  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash()
      setPage(next)
      // Leaving the summary cancels a print that was still waiting for the results
      if (next !== 'summary') setPrintRequested(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const tabStyle = (value: Page) => tabClass(page === value)

  const tab = (value: Page, label: string, hash: string, icon?: IconName) => (
    <a href={hash} aria-current={page === value ? 'page' : undefined} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${tabStyle(value)}`}>
      {icon && <Icon name={icon} size={15} />}
      {label}
    </a>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 print:p-0">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          {/* Beside the title, not in the nav, so the nav still fits on one row next to this block on a laptop */}
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            {/* The logo and name go back to your plan (home) from any page */}
            <h1 className="text-2xl font-semibold">
              <a href="#plan" className="inline-flex items-center gap-2 rounded-md hover:text-teal-800 dark:hover:text-teal-300">
                <Logo />
                Retirement Planner
              </a>
            </h1>
            <ThemeSwitch />
          </div>
          <p className="text-sm text-muted">Everything you enter stays in this browser, unless you use Ask Claude.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {tab('plan', 'My plan', '#plan', 'home')}
          {tab('compare', 'Compare scenarios', '#compare', 'columns')}
          <CalculatorsMenu />
          {/* The summary is the printable report, so it's a printer icon rather than another tab. It's an action, so
              no aria-current; it looks selected on the summary, and the page's heading says where you are */}
          <button
            type="button"
            onClick={requestPrint}
            aria-label="Print or save as PDF"
            title="Print or save as PDF"
            className={`inline-flex items-center px-2.5 py-1.5 ${tabStyle('summary')}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="7" />
            </svg>
          </button>
          {/* Beta: needs the visitor's own Anthropic API key, and (unlike the rest of the app) sends the plan to Anthropic */}
          <a
            href="#ask"
            aria-current={page === 'ask' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${tabStyle('ask')}`}
          >
            <Icon name="sparkles" size={15} />
            Ask Claude
            <span className="rounded-full bg-teal-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-teal-900 uppercase dark:bg-teal-900 dark:text-teal-100">
              Beta
            </span>
          </a>
        </nav>
      </header>
      <div className="mb-8">
        <DisclaimerBanner />
      </div>
      <main>
        {page === 'plan' && <Dashboard />}
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          {page === 'compare' && <Scenarios />}
          {page === 'summary' && (
            <Summary print={printRequested} onPrintDone={printDone} printNowRef={printNow} />
          )}
          {page === 'terms' && <Terms />}
          {page === 'ask' && <Ask />}
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
