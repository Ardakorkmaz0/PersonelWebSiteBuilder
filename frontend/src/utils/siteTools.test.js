import { describe, expect, it } from 'vitest'
import { extractSiteContent, updateHtmlContent, updateSchemaContent } from './contentManager.js'
import { analyzeSiteReadiness } from './siteReadiness.js'

describe('site workflow tools', () => {
  it('scores missing publishing essentials', () => {
    const result = analyzeSiteReadiness({
      title: 'Demo',
      pages: [{ id: 'home', name: 'Home', mode: 'html' }],
      pageHtmlMap: { home: '<html><body><img src="x"><a>Empty link</a></body></html>' },
      siteOptions: {},
    })
    expect(result.score).toBeLessThan(50)
    expect(result.missingAlt).toBe(1)
    expect(result.weakLinks).toBe(1)
  })

  it('extracts and updates HTML content', () => {
    const schema = { pages: [{ id: 'home', name: 'Home', mode: 'html' }] }
    const html = '<html><body><h1>Hello</h1><img src="x" alt="Old"></body></html>'
    const entries = extractSiteContent(schema, { home: html })
    expect(entries.map((item) => item.value)).toEqual(['Hello', 'Old'])
    expect(updateHtmlContent(html, entries[0], 'Welcome')).toContain('Welcome')
  })

  it('updates component copy without changing the original schema', () => {
    const schema = { pages: [{ id: 'home', name: 'Home', components: [{ type: 'text', props: { text: 'Old' } }] }] }
    const entry = extractSiteContent(schema)[0]
    const next = updateSchemaContent(schema, entry, 'New')
    expect(next.pages[0].components[0].props.text).toBe('New')
    expect(schema.pages[0].components[0].props.text).toBe('Old')
  })
})
