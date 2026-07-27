import { describe, expect, it } from 'vitest'
import { buildAiSuggestions } from './aiSuggestions.js'

// A context that matches nothing on its own — each test opts into the one
// condition it is about, so a rule firing here means that rule's own `when`
// matched and not some neighbouring default.
function ctx(overrides = {}) {
  return {
    isHtmlSite: false,
    componentCount: 2,
    types: ['navbar', 'heading'],
    pageCount: 2,
    hasMotion: true,
    hasSeo: true,
    themeIsDefault: false,
    selected: null,
    ...overrides,
  }
}

const ids = (list) => list.map((s) => s.id)

describe('buildAiSuggestions', () => {
  it('offers to build the page when the canvas is empty', () => {
    const out = buildAiSuggestions(ctx({ componentCount: 0, types: [] }))
    expect(out[0].id).toBe('build-page')
  })

  it('does not offer to build a page that already has components', () => {
    expect(ids(buildAiSuggestions(ctx()))).not.toContain('build-page')
  })

  it('suggests a navbar only while the page lacks one', () => {
    expect(ids(buildAiSuggestions(ctx({ types: ['heading'] })))).toContain('add-navbar')
    expect(ids(buildAiSuggestions(ctx({ types: ['navbar'] })))).not.toContain('add-navbar')
  })

  it('surfaces the selection first and fills its name into label and prompt', () => {
    const out = buildAiSuggestions(
      ctx({ types: ['heading'], selected: { type: 'card', label: 'Card', hasMotion: false } }),
    )
    const restyle = out.find((s) => s.id === 'restyle-selected')
    expect(restyle.vars).toEqual({ name: 'Card' })
    expect(restyle.prompt).toContain('card')
    expect(out.findIndex((s) => s.id === 'restyle-selected')).toBeLessThan(
      out.findIndex((s) => s.id === 'add-navbar'),
    )
  })

  it('offers to animate a selection only when it has no entrance yet', () => {
    const without = ctx({ selected: { type: 'card', label: 'Card', hasMotion: false } })
    const already = ctx({ selected: { type: 'card', label: 'Card', hasMotion: true } })
    expect(ids(buildAiSuggestions(without))).toContain('animate-selected')
    expect(ids(buildAiSuggestions(already))).not.toContain('animate-selected')
  })

  it('asks for SEO copy only once the page has something to describe', () => {
    expect(ids(buildAiSuggestions(ctx({ componentCount: 4, hasSeo: false })))).toContain('write-seo')
    expect(ids(buildAiSuggestions(ctx({ componentCount: 1, hasSeo: false })))).not.toContain('write-seo')
  })

  it('never repeats a suggestion the user already acted on', () => {
    const state = ctx({ types: ['heading'] })
    expect(ids(buildAiSuggestions(state))).toContain('add-navbar')
    expect(ids(buildAiSuggestions(state, { exclude: ['add-navbar'] }))).not.toContain('add-navbar')
  })

  it('honours the limit', () => {
    const out = buildAiSuggestions(ctx({ componentCount: 6, types: [], hasMotion: false, hasSeo: false, themeIsDefault: true, pageCount: 1 }), { limit: 3 })
    expect(out).toHaveLength(3)
  })

  it('switches to document-level rules on an HTML page', () => {
    const out = buildAiSuggestions(ctx({ isHtmlSite: true, componentCount: 0, types: [] }))
    expect(ids(out)).toEqual(['html-polish', 'html-responsive', 'html-section', 'html-dark'])
    expect(ids(out)).not.toContain('build-page')
  })

  it('every suggestion carries a translatable label, a reason and a prompt', () => {
    const out = buildAiSuggestions(ctx({ componentCount: 0, types: [] }), { limit: 20 })
    for (const s of out) {
      expect(typeof s.label).toBe('string')
      expect(typeof s.why).toBe('string')
      expect(s.prompt.length).toBeGreaterThan(20)
    }
  })

  it('returns nothing rather than throwing on a missing context', () => {
    expect(buildAiSuggestions(null)).toEqual([])
  })
})
