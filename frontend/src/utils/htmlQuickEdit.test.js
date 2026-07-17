import { describe, expect, it } from 'vitest'
import {
  listHtmlContentFields,
  updateHtmlHrefAtPath,
  updateHtmlTextAtPath,
} from './htmlQuickEdit.js'

describe('htmlQuickEdit', () => {
  it('lists editable text and links from an HTML fragment', () => {
    const html = '<section><h1>Hello</h1><p>Intro <strong>copy</strong></p><a href="#contact">Contact</a><style>.x{color:red}</style></section>'
    const fields = listHtmlContentFields(html)

    expect(fields.texts.map((field) => field.text)).toEqual(['Hello', 'Intro copy', 'Contact'])
    expect(fields.links).toEqual([
      expect.objectContaining({ label: 'Contact', href: '#contact' }),
    ])
  })

  it('updates text at a stable element path', () => {
    const html = '<section><h1>Hello</h1><a href="#contact">Contact</a></section>'
    const title = listHtmlContentFields(html).texts.find((field) => field.text === 'Hello')
    const next = updateHtmlTextAtPath(html, title.path, 'Welcome')

    expect(next).toContain('<h1>Welcome</h1>')
    expect(next).toContain('href="#contact"')
  })

  it('persists and reloads textarea newlines as br elements', () => {
    const html = '<section><p>First</p></section>'
    const paragraph = listHtmlContentFields(html).texts[0]
    const next = updateHtmlTextAtPath(html, paragraph.path, 'First\nSecond <safe>')

    expect(next).toContain('<p>First<br>Second &lt;safe&gt;</p>')
    expect(listHtmlContentFields(next).texts[0].text).toBe('First\nSecond <safe>')
  })

  it('updates href without changing link text', () => {
    const html = '<section><a href="#old">Open</a></section>'
    const link = listHtmlContentFields(html).links[0]
    const next = updateHtmlHrefAtPath(html, link.path, 'https://example.com')

    expect(next).toContain('href="https://example.com"')
    expect(next).toContain('>Open</a>')
  })

  it('keeps full documents serializable', () => {
    const html = '<!DOCTYPE html><html><head><title>Demo</title></head><body><main><h1>Old</h1></main></body></html>'
    const title = listHtmlContentFields(html).texts[0]
    const next = updateHtmlTextAtPath(html, title.path, 'New')

    expect(next).toContain('<!DOCTYPE html>')
    expect(next).toContain('<title>Demo</title>')
    expect(next).toContain('<h1>New</h1>')
  })
})
