import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { movedUrl, planFromMove } from './store/move'
import { usePlanStore } from './store/planStore'
import { isBlankPlan } from './utils/quickStart'

if (window.location.hostname.endsWith('.github.io')) {
  // Old address: send the visitor (and their saved plan) to willitlast.app
  let saved: string | null = null
  try {
    saved = localStorage.getItem('retirement-plan')
  } catch {
    // Storage blocked: move without the plan
  }
  window.location.replace(movedUrl(saved, window.location.hash))
} else {
  const moved = planFromMove(window.location.hash)
  if (moved) {
    // Only fill an empty planner, so an old bookmark never overwrites a plan made here
    const { plan, importPlan } = usePlanStore.getState()
    if (moved.ok && !isBlankPlan(moved.plan) && isBlankPlan(plan)) importPlan(moved.plan)
    // Take the plan out of the address bar
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
