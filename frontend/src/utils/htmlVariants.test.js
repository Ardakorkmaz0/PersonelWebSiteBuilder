import { describe, expect, it } from 'vitest'
import { HTML_BLOCKS, htmlVariantsFor } from './htmlVariants.js'
import { htmlSnippetSize } from './htmlSnippetSizing.js'

describe('htmlVariants', () => {
  it('ships a broader section block library', () => {
    expect(HTML_BLOCKS.length).toBeGreaterThanOrEqual(18)

    const ids = new Set(HTML_BLOCKS.map((block) => block.id))
    expect(ids.size).toBe(HTML_BLOCKS.length)

    for (const id of ['about', 'services', 'portfolio', 'gallery', 'newsletter', 'video']) {
      expect(ids.has(id)).toBe(true)
    }

    for (const block of HTML_BLOCKS) {
      expect(block.html).toMatch(/<\w+/)
    }
  })

  it('has curated variants for advanced component types', () => {
    for (const type of ['linkbutton', 'select', 'alert', 'accordion', 'tabs', 'container', 'icon', 'html', 'spacer']) {
      expect(htmlVariantsFor(type).length).toBeGreaterThan(0)
    }
  })

  it('renders icon variants as frame-filling snippets', () => {
    for (const variant of htmlVariantsFor('icon')) {
      expect(variant.html).toContain('width:100%')
      expect(variant.html).toContain('height:100%')
      expect(variant.html).toContain('font-size:clamp')
    }
  })

  it('keeps palette and properties snippet sizes on the same table', () => {
    expect(htmlSnippetSize('icon')).toEqual({ w: 90, h: 90 })
    expect(htmlSnippetSize('navbar', 'vertical')).toEqual({ w: 220, h: 320 })
  })

  it('ships interactive tabs snippets for View/export runtime', () => {
    for (const variant of htmlVariantsFor('tabs')) {
      expect(variant.html).toContain('data-builder-tabs')
      expect(variant.html).toContain('role="tab"')
      expect(variant.html).toContain('role="tabpanel"')
      expect(variant.html).toContain('data-builder-panel')
    }
  })
})
