// Smoke tests over EVERY template variant: each must build a complete,
// self-contained document with no template-literal accidents. A broken
// variant would show up as a blank/garbled thumbnail in the gallery.
import { describe, expect, it } from 'vitest'
import { TEMPLATE_COUNT, TEMPLATE_LIBRARY, TEMPLATE_SITE_CATEGORY_MAP } from './templateLibrary.js'
import { SITE_TEMPLATES } from './htmlTemplates.js'

const ALL = TEMPLATE_LIBRARY.flatMap((c) => c.variants.map((v) => ({ cat: c.id, ...v })))

describe('TEMPLATE_LIBRARY', () => {
  it('ships a 200-template gallery with unique ids', () => {
    expect(TEMPLATE_COUNT).toBe(200)
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

  it('includes a complete Fitness & Wellness collection with ten distinct starters', () => {
    const wellness = TEMPLATE_LIBRARY.find((category) => category.id === 'wellness')
    expect(wellness).toBeTruthy()
    expect(wellness.variants).toHaveLength(10)
    expect(new Set(wellness.variants.map((template) => template.id)).size).toBe(10)
  })

  it('adds ten vertical collections with ten distinct starters each', () => {
    const verticalIds = [
      'property', 'clinic', 'education', 'travel', 'beauty', 'legal-finance',
      'home-services', 'community', 'entertainment', 'mobility',
    ]

    for (const id of verticalIds) {
      const collection = TEMPLATE_LIBRARY.find((category) => category.id === id)
      expect(collection, id).toBeTruthy()
      expect(collection.variants, id).toHaveLength(10)
      expect(new Set(collection.variants.map((template) => template.id)).size, id).toBe(10)
    }
  })

  it('maps every gallery collection to a public site category', () => {
    expect(Object.keys(TEMPLATE_SITE_CATEGORY_MAP)).toHaveLength(TEMPLATE_LIBRARY.length)
    for (const category of TEMPLATE_LIBRARY) {
      expect(TEMPLATE_SITE_CATEGORY_MAP[category.id], category.id).toBeTruthy()
    }
  })
})

describe('shipped templates keep their promises', () => {
  // A nav item that scrolls nowhere is the first thing a visitor clicks. Both
  // the site starters and the component gallery shipped some: the SaaS landing
  // page advertised Pricing with no pricing section, and every blog variant
  // linked About twice (nav + footer) with no About section.
  const dead = (html, label) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const bad = []
    for (const a of doc.querySelectorAll('a[href^="#"]')) {
      const id = a.getAttribute('href').slice(1)
      if (!id || id === 'top') continue
      if (!doc.getElementById(id)) bad.push(`${label}: #${id}`)
    }
    return bad
  }

  // Builds and parses every one of the 200 variants, so it needs more than the
  // 5s default when the machine is busy.
  it('every component template variant', () => {
    expect(ALL.flatMap((tpl) => dead(tpl.build('Smoke Test'), tpl.id))).toEqual([])
  }, 30000)

  it('every HTML site starter', () => {
    expect(SITE_TEMPLATES.flatMap((tpl) => dead(tpl.build('Smoke Test'), tpl.id))).toEqual([])
  })
})
