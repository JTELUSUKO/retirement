/** The site's logo: the browser-tab icon itself (public/favicon.svg), so there's one file to redesign. Decorative. */
export function Logo({ size = 28 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={size} height={size} className="shrink-0" />
}
