import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fillPage, PAGES, updateDue } from '../../build/taxYearPages'
import { TAX_CONFIG } from '../engine'

const root = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const html = (path: string) => read(`${path}index.html`)

describe('calculator pages and the yearly update', () => {
  it.each(PAGES)('%s page builds with every token filled', (_, path) => {
    const filled = fillPage(html(path))
    expect(filled).not.toMatch(/\{\{|<!--(SOURCE|BRACKETS|IRMAA_TIERS|UNIFORM_TABLE)/)
  })

  it.each(PAGES)('%s page has no hard-coded tax year (they come from TAX_CONFIG)', (_, path) => {
    // Years in links are fine (they're in TAX_CONFIG.sources); "since 2024" is history, not a tax-year figure
    const text = html(path).replace(/https?:\/\/\S+/g, '').replace(/since 2024/g, '')
    expect(text.match(/\b20[2-3]\d\b/g) ?? []).toEqual([])
  })

  it.each(PAGES.filter(([, path]) => path))('%s page is protected from Cloudflare script injection', (_, path) => {
    const rule = new RegExp(`^/${path.replace(/\//g, '\\/')}\\*\\n\\s+Cache-Control: [^\\n]*no-transform`, 'm')
    expect(read('public/_headers')).toMatch(rule)
  })

  it('fills the year, review date and sources from TAX_CONFIG', () => {
    const page = fillPage('{{YEAR}} {{PREV_YEAR}} {{REVIEWED}} <!--SOURCE pub590b: RMD tables-->')
    expect(page).toContain(`${TAX_CONFIG.year} ${TAX_CONFIG.year - 1} `)
    expect(page).toContain(TAX_CONFIG.sources.pub590b.url)
    expect(page).toContain('RMD tables')
  })

  it('fails the build on a misspelled token or unknown source', () => {
    expect(() => fillPage('{{YAER}}')).toThrow('Unknown page token')
    expect(() => fillPage('<!--SOURCE nope: x-->')).toThrow('Unknown source')
  })

  it('says the update is due from November 15 of the tax year', () => {
    expect(updateDue(new Date(Date.UTC(TAX_CONFIG.year, 10, 14)))).toBe(false)
    expect(updateDue(new Date(Date.UTC(TAX_CONFIG.year, 10, 15)))).toBe(true)
    expect(updateDue(new Date(Date.UTC(TAX_CONFIG.year + 1, 0, 2)))).toBe(true)
  })
})
