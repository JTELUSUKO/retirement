import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { ClaimingAgeCalculator } from './ClaimingAgeCalculator'

if (window.location.hostname.endsWith('.github.io')) {
  // Old address: this page lives on willitlast.app now
  window.location.replace('https://willitlast.app/social-security-claiming-age/')
} else {
  createRoot(document.getElementById('calculator')!).render(
    <StrictMode>
      <ClaimingAgeCalculator />
    </StrictMode>,
  )
}
