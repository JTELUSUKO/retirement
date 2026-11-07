export type Theme = 'system' | 'light' | 'dark'

// public/theme-init.js reads the same key and attribute before the first paint
const KEY = 'retirement-theme'

export function savedTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

/** Light or Dark overrides the device (see the dark variant in index.css); System removes the override. */
export function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Storage blocked: the choice lasts until the page is left
  }
}
