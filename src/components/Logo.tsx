import { logoSvg } from './logoSvg'

/** The site's logo mark (see logoSvg.ts). */
export function Logo({ size = 28 }: { size?: number }) {
  // Static markup we write ourselves, not user content
  return <span className="inline-flex shrink-0" dangerouslySetInnerHTML={{ __html: logoSvg(size) }} />
}
