import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { RothCalculator } from './RothCalculator'

if (window.location.hostname.endsWith('.github.io')) {
  // Old address: this page lives on willitlast.app now
  window.location.replace('https://willitlast.app/roth-conversion-calculator/')
} else {
  createRoot(document.getElementById('calculator')!).render(
    <StrictMode>
      <RothCalculator />
    </StrictMode>,
  )
}
