import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { RmdCalculator } from './RmdCalculator'

if (window.location.hostname.endsWith('.github.io')) {
  // Old address: this page lives on willitlast.app now
  window.location.replace('https://willitlast.app/rmd-calculator/')
} else {
  createRoot(document.getElementById('calculator')!).render(
    <StrictMode>
      <RmdCalculator />
    </StrictMode>,
  )
}
