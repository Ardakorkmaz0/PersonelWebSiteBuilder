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

  it('keeps line breaks when HTML content is edited from the control center', () => {
    const schema = { pages: [{ id: 'home', name: 'Home', mode: 'html' }] }
    const html = '<html><body><p>First</p></body></html>'
    const entry = extractSiteContent(schema, { home: html })[0]
    const next = updateHtmlContent(html, entry, 'First\nSecond')

    expect(next).toContain('<p>First<br>Second</p>')
    expect(extractSiteContent(schema, { home: next })[0].value).toBe('First\nSecond')
  })

  it('updates component copy without changing the original schema', () => {
    const schema = { pages: [{ id: 'home', name: 'Home', components: [{ type: 'text', props: { text: 'Old' } }] }] }
    const entry = extractSiteContent(schema)[0]
    const next = updateSchemaContent(schema, entry, 'New')
    expect(next.pages[0].components[0].props.text).toBe('New')
    expect(schema.pages[0].components[0].props.text).toBe('Old')
  })
})

describe('readiness: links on the component canvas', () => {
  const page = (components) => ({ id: 'home', name: 'Home', components })
  const layout = { x: 0, y: 0, w: 100, h: 40 }
  const run = (components, extraPages = []) => analyzeSiteReadiness({
    title: 'Demo', pages: [page(components), ...extraPages], siteOptions: {},
  }).weakLinks

  it('counts a link button with no destination (the "link" type it looked for does not exist)', () => {
    expect(run([{ id: 'lb', type: 'linkbutton', props: { text: 'Read', href: '' }, layout, mobileLayout: layout }])).toBe(1)
  })

  it('counts navbar links that point at no block on the page — the default #about / #contact', () => {
    const nav = {
      id: 'nav', type: 'navbar', layout, mobileLayout: layout,
      props: { links: [{ label: 'Home', href: '#' }, { label: 'About', href: '#about' }, { label: 'Work', href: '#work_1' }, { label: 'Page 2', href: '#p2' }] },
    }
    const work = { id: 'work_1', type: 'region', props: {}, layout, mobileLayout: layout }
    // #about is dead; '#', a real block and another page are fine.
    expect(run([nav, work], [{ id: 'p2', name: 'Two', components: [work] }])).toBe(1)
  })

  it('counts a dead anchor on a button and on a section button', () => {
    expect(run([
      { id: 'b', type: 'button', props: { href: '#nowhere' }, layout, mobileLayout: layout },
      { id: 's', type: 'section', props: { buttonHref: '#gone' }, layout, mobileLayout: layout },
    ])).toBe(2)
  })
})
