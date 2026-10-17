import { useEffect, useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Scenarios } from './pages/Scenarios'

type Page = 'plan' | 'compare'

const pageFromHash = (): Page => (window.location.hash === '#compare' ? 'compare' : 'plan')

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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Retirement Planner</h1>
          <p className="text-sm text-slate-500">A planning aid, not financial advice. Your data stays in this browser.</p>
        </div>
        <nav className="flex gap-1">
          {tab('plan', 'My plan', '#plan')}
          {tab('compare', 'Compare scenarios', '#compare')}
        </nav>
      </header>
      {page === 'plan' ? <Dashboard /> : <Scenarios />}
    </div>
  )
}
