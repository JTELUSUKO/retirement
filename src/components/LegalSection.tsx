/** A numbered section of a legal page (terms, privacy policy). */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  )
}
