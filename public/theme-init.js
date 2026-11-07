// Applies a saved Light or Dark choice before the page first paints, so it never flashes the other theme. A plain file
// because the site's CSP blocks inline scripts. "System" sets nothing: the CSS follows the device. See src/utils/theme.ts.
try {
  const theme = localStorage.getItem('retirement-theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme)
} catch {
  // Storage blocked: follow the device
}
