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
  // After a deploy, an open tab may ask for chart or page files that no longer exist. Reload once to get the new
  // version (the plan is saved in the browser); the flag stops a reload loop if the files are really missing.
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (sessionStorage.getItem('reloaded-for-update')) return
      sessionStorage.setItem('reloaded-for-update', '1')
    } catch {
      return
    }
    event.preventDefault()
    window.location.reload()
  })
  window.addEventListener('load', () =>
    setTimeout(() => {
      try {
        sessionStorage.removeItem('reloaded-for-update')
      } catch {
        // Storage blocked: nothing to clear
      }
    }, 10_000),
  )

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
