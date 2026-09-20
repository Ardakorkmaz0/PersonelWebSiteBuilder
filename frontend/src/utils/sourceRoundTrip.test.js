// Editing a component page in Source and applying it hands the document to the
// HTML editor. That conversion is the only path from the generated project back
// into a real page, so it has to arrive whole: styles inlined, the interactive
// runtime present exactly once, and the page's own settings still in the head.
import { describe, expect, it } from 'vitest'
import { schemaToFiles } from './schemaToFiles.js'
import { inlineProjectHtml } from './exportFiles.js'

const schema = {
  theme: {},
  customCss: '.hand-written { color: red }',
  customJs: 'window.__hand = 1',
  pages: [{
    id: 'p1',
    name: 'Home',
    language: 'tr',
    themeColor: '#0f172a',
    smoothScroll: true,
    seoDescription: 'A page about things.',
    components: [
      { id: 'c1', type: 'heading', props: { text: 'Merhaba' }, layout: { x: 0, y: 0, w: 600, h: 70 } },
      { id: 'c2', type: 'navbar', props: { brand: 'Site', links: [{ label: 'Home', href: '#' }] }, layout: { x: 0, y: 90, w: 1000, h: 70 } },
    ],
  }],
}

const applied = () => {
  const files = schemaToFiles(schema)
  const index = files.find((file) => file.name.endsWith('index.html'))
  return inlineProjectHtml(index.content, files)
}

describe('applying edited source to a page', () => {
  it('inlines the project stylesheet instead of leaving a dead link', () => {
    const html = applied()
    expect(html).not.toMatch(/<link[^>]+styles\.css/)
    expect(html).toContain('data-pwb-project-styles')
    expect(html).toContain('.hand-written')
  })

  it('keeps the interactive runtime, exactly once', () => {
    const html = applied()
    expect(html).not.toMatch(/<script[^>]+src=["']runtime\.js/)
    const runtimes = html.match(/data-builder-runtime|data-pwb-project-runtime/g) || []
    expect(runtimes.length).toBeGreaterThan(0)
    expect(html.match(/data-pwb-project-runtime/g)?.length ?? 0).toBeLessThan(2)
  })

  it('carries the page settings over with the document', () => {
    const html = applied()
    expect(html).toContain('lang="tr"')
    expect(html).toContain('content="#0f172a"')
    expect(html).toContain('scroll-behavior: smooth')
    expect(html).toContain('A page about things.')
  })

  it('keeps the content itself', () => {
    const html = applied()
    expect(html).toContain('Merhaba')
    expect(html).toContain('Site')
  })
})
