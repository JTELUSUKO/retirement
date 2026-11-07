import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { mountThemeSwitch } from './mountThemeSwitch'
import { FourPercentCalculator } from './FourPercentCalculator'

if (window.location.hostname.endsWith('.github.io')) {
  // Old address: this page lives on willitlast.app now
  window.location.replace('https://willitlast.app/4-percent-rule-calculator/')
} else {
  mountThemeSwitch()
  createRoot(document.getElementById('calculator')!).render(
    <StrictMode>
      <FourPercentCalculator />
    </StrictMode>,
  )
}
