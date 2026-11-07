import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeSwitch } from '../components/ThemeSwitch'

/** Calculator pages' headers are plain HTML: fills their #theme-switch placeholder. */
export function mountThemeSwitch() {
  createRoot(document.getElementById('theme-switch')!).render(
    <StrictMode>
      <ThemeSwitch />
    </StrictMode>,
  )
}
