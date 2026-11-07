import { useEffect, useState } from 'react'
import { applyTheme, savedTheme, saveTheme, type Theme } from '../utils/theme'
import { Icon, type IconName } from './Icons'
import { tabClass } from './styles'

const OPTIONS: { value: Theme; label: string; title: string; icon: IconName }[] = [
  { value: 'system', label: 'System', title: 'System: match this device', icon: 'monitor' },
  { value: 'light', label: 'Light', title: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', title: 'Dark', icon: 'moon' },
]

/**
 * System, Light or Dark. Real radio buttons, so arrow keys and screen readers work without extra code. 96×32px: the
 * calculator pages' placeholder (#theme-switch) reserves the same size, so nothing moves when this loads.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(savedTheme)

  const choose = (next: Theme) => {
    setTheme(next)
    applyTheme(next)
    saveTheme(next)
  }

  // Changed in another tab, or back on a page restored as it was left before the choice changed
  useEffect(() => {
    const sync = () => {
      const saved = savedTheme()
      setTheme(saved)
      applyTheme(saved)
    }
    window.addEventListener('storage', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])

  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex print:hidden">
      {OPTIONS.map(({ value, label, title, icon }) => (
        <label key={value} title={title} className="relative cursor-pointer">
          <input
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => choose(value)}
            className="peer sr-only"
          />
          <span className={`inline-flex h-8 w-8 items-center justify-center peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-600 ${tabClass(theme === value)}`}>
            <Icon name={icon} size={16} />
          </span>
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </div>
  )
}
