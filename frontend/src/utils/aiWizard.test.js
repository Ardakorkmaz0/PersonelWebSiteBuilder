import { describe, it, expect } from 'vitest'
import {
  buildWizardPrompt,
  wizardMeta,
  DEFAULT_SECTIONS_BY_TYPE,
  WIZARD_SECTIONS,
  WIZARD_SITE_TYPES,
} from './aiWizard.js'

const DISCOVERY_CATEGORIES = [
  'portfolio', 'business', 'blog', 'landing', 'shop', 'personal', 'other',
]

describe('buildWizardPrompt', () => {
  it('carries the brand, recipe, accent, font and ordered sections', () => {
    const prompt = buildWizardPrompt({
      type: 'restaurant',
      brand: 'Mavi Kafe',
      tagline: 'Specialty coffee in Kadıköy',
      description: 'A small café with weekend brunch and its own roastery.',
      email: 'hi@mavikafe.com',
      mood: 'warm',
      accent: '#e8543f',
      font: 'friendly',
      sections: ['hero', 'menu', 'contact'],
    })
    expect(prompt).toContain('restaurant / café')
    expect(prompt).toContain('Mavi Kafe')
    expect(prompt).toContain('Specialty coffee in Kadıköy')
    expect(prompt).toContain('#e8543f')
    expect(prompt).toContain('"Nunito"')
    expect(prompt).toContain('Hero / intro, Menu & prices, Contact')
    expect(prompt).toContain('hi@mavikafe.com')
  })

  it('falls back to the type defaults when nothing is picked', () => {
    const prompt = buildWizardPrompt({ type: 'blog' })
    // Default blog sections resolve to their labels, in order.
    const labels = DEFAULT_SECTIONS_BY_TYPE.blog
      .map((id) => WIZARD_SECTIONS.find((s) => s.id === id).label)
      .join(', ')
    expect(prompt).toContain(labels)
    expect(prompt).toContain('pick a fitting name yourself')
  })

  it('appends extra wishes verbatim', () => {
    const prompt = buildWizardPrompt({ type: 'portfolio', brand: 'X', extra: 'mention weekend workshops' })
    expect(prompt).toContain('mention weekend workshops')
  })
})

describe('wizardMeta', () => {
  it('maps every site type to a valid Explore category', () => {
    for (const t of WIZARD_SITE_TYPES) {
      const meta = wizardMeta({ type: t.id })
      expect(DISCOVERY_CATEGORIES).toContain(meta.category)
    }
  })

  it('uses the brand as the title and falls back to the type label', () => {
    expect(wizardMeta({ type: 'shop', brand: '  Nova Store ' }).title).toBe('Nova Store')
    expect(wizardMeta({ type: 'shop' }).title).toBe('Shop / Product')
  })

  it('keeps tags unique and within the 8-tag limit', () => {
    const meta = wizardMeta({ type: 'portfolio', mood: 'minimal' })
    expect(meta.tags.length).toBeLessThanOrEqual(8)
    expect(new Set(meta.tags).size).toBe(meta.tags.length)
  })
})
