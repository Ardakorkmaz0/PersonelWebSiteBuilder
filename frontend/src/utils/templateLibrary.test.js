// Smoke tests over EVERY template variant: each must build a complete,
// self-contained document with no template-literal accidents. A broken
// variant would show up as a blank/garbled thumbnail in the gallery.
import { describe, expect, it } from 'vitest'
import { TEMPLATE_COUNT, TEMPLATE_LIBRARY } from './templateLibrary.js'

const ALL = TEMPLATE_LIBRARY.flatMap((c) => c.variants.map((v) => ({ cat: c.id, ...v })))

describe('TEMPLATE_LIBRARY', () => {
  it('ships a large gallery (90+ variants) with unique ids', () => {
    expect(TEMPLATE_COUNT).toBeGreaterThanOrEqual(90)
    expect(ALL.length).toBe(TEMPLATE_COUNT)
    const ids = new Set(ALL.map((v) => v.id))
    expect(ids.size).toBe(ALL.length)
  })

  it('every variant builds a complete standalone document', () => {
    for (const tpl of ALL) {
      const html = tpl.build('Smoke Test')
      expect(html, tpl.id).toMatch(/^<!DOCTYPE html>/)
      expect(html, tpl.id).toContain('name="viewport"')
      expect(html, tpl.id).toContain('fonts.googleapis.com')
      expect(html, tpl.id).toContain('</html>')
      expect(html, tpl.id).toContain('Smoke Test')
      // Template-literal accidents
      expect(html, tpl.id).not.toContain('undefined')
      expect(html, tpl.id).not.toContain('[object Object]')
      expect(html, tpl.id).not.toContain('NaN')
    }
  })

  it('escapes HTML-sensitive characters in the site title', () => {
    const html = ALL[0].build('A <b> & Co')
    expect(html).not.toContain('A <b> & Co')
    expect(html).toContain('A &lt;b&gt; &amp; Co')
  })

  it('every category has a name, icon, and at least 8 variants', () => {
    for (const cat of TEMPLATE_LIBRARY) {
      expect(cat.name, cat.id).toBeTruthy()
      expect(cat.icon, cat.id).toBeTruthy()
      expect(cat.variants.length, cat.id).toBeGreaterThanOrEqual(8)
    }
  })
})
