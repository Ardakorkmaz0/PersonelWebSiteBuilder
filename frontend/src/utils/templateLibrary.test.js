// Smoke tests over EVERY template variant: each must build a complete,
// self-contained document with no template-literal accidents. A broken
// variant would show up as a blank/garbled thumbnail in the gallery.
import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_COUNT,
  TEMPLATE_LIBRARY,
  TEMPLATE_SITE_CATEGORY_MAP,
  VERTICAL_FAMILY_IDS,
  buildVerticalVariant,
} from './templateLibrary.js'
import { FAMILY_DESCRIPTIONS, VERTICAL_CATEGORY_SEEDS } from './templateCatalogData.js'
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

// A gallery of 200 is only worth 200 if they are not the same page in different
// paint. Each vertical is built from CATEGORY (copy) × PACK (palette) ×
// FAMILY (page architecture) — and it was the third axis that had collapsed:
// ten "Real Estate" templates rendered three skeletons between them, so the
// picker felt like a colour wheel. These are the ratchets on that.
describe('the gallery offers real structural choice', () => {
  const SIGNATURES = {
    sidebar: '.rail',
    magazine: '.river',
    showcase: '.zig',
    directory: '.rows',
    onepage: '.tiers',
  }

  it('every vertical category spans at least five page architectures', () => {
    for (const seed of VERTICAL_CATEGORY_SEEDS) {
      const families = new Set(seed.variants.map((v) => v.family))
      expect(families.size, `${seed.id} offers ${families.size} layout(s)`).toBeGreaterThanOrEqual(5)
    }
  })

  it('every family a category asks for actually exists, with a description', () => {
    const declared = new Set(VERTICAL_CATEGORY_SEEDS.flatMap((s) => s.variants.map((v) => v.family)))
    for (const family of declared) {
      expect(VERTICAL_FAMILY_IDS, family).toContain(family)
      expect(FAMILY_DESCRIPTIONS[family], family).toBeTruthy()
    }
  })

  it('each new family renders its own structure and nobody else’s', () => {
    const seed = VERTICAL_CATEGORY_SEEDS[0]
    const built = {}
    for (const [family, marker] of Object.entries(SIGNATURES)) {
      const variant = { id: 'probe', pack: 'indigo', family, name: { en: 'Probe', tr: 'Probe' } }
      const html = buildVerticalVariant(seed, variant, 'Probe Site')
      built[family] = html
      const doc = new DOMParser().parseFromString(html, 'text/html')
      expect(doc.querySelector(marker), `${family} is missing ${marker}`).toBeTruthy()
      for (const [other, otherMarker] of Object.entries(SIGNATURES)) {
        if (other === family) continue
        expect(doc.querySelector(otherMarker), `${family} should not contain ${otherMarker}`).toBeNull()
      }
    }
    // Same copy, same palette — so any two that match are the same page twice.
    const bodies = Object.values(built)
    expect(new Set(bodies).size).toBe(bodies.length)
  })

  it('no family overflows a phone', () => {
    // The gallery is judged on a 390px thumbnail before it is judged anywhere
    // else, and a layout that spills sideways looks broken there first.
    const seed = VERTICAL_CATEGORY_SEEDS[0]
    for (const family of VERTICAL_FAMILY_IDS) {
      const html = buildVerticalVariant(seed, { id: 'probe', pack: 'slate', family, name: { en: 'P', tr: 'P' } }, 'Probe')
      // jsdom does no layout, so this is the static half: nothing may FIX a
      // width wider than the narrowest phone we support. A max-width caps and
      // a min-width is checked by the media queries, so both are allowed.
      const wide = [...html.matchAll(/(?<!max-|min-)width:\s*(\d{3,})px/g)]
        .map((m) => Number(m[1]))
        .filter((n) => n > 360)
      expect(wide, `${family} hard-codes ${wide.join(', ')}px`).toEqual([])
    }
  })
})
