// The site's logo: the same teal mark as the browser-tab icon (public/favicon.svg). One source for the planner header
// (Logo.tsx) and the calculator pages (the {{LOGO}} token in build/taxYearPages.ts).

/** Inline SVG markup for the logo at `size` pixels. Decorative: the name next to it is the accessible text. */
export const logoSvg = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="6" fill="#0f766e"/><path d="M6 24 L13 15 L18 19 L26 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
