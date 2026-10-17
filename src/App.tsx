import { Dashboard } from './pages/Dashboard'

export default function App() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Retirement Planner</h1>
        <p className="text-sm text-slate-500">
          A planning aid, not financial advice. Your data stays in this browser.
        </p>
      </header>
      <Dashboard />
    </div>
  )
}
