import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { MoneyLastCalculator } from './MoneyLastCalculator'

if (window.location.hostname.endsWith('.github.io')) {
  // Old address: this page lives on willitlast.app now
  window.location.replace('https://willitlast.app/how-long-will-my-money-last/')
} else {
  createRoot(document.getElementById('calculator')!).render(
    <StrictMode>
      <MoneyLastCalculator />
    </StrictMode>,
  )
}
