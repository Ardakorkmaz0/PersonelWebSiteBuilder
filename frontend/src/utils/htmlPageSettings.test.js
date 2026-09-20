// An uploaded page's settings live in its document. The panel reads them from
// there and writes them back — so an edit in Source shows up in the panel, and
// a change in the panel shows up in the document.
import { describe, expect, it } from 'vitest'
import { applyHtmlPageSettings, readHtmlPageSettings } from './htmlPageSettings.js'

const doc = (head = '', attrs = ' lang="en"') =>
  `<!DOCTYPE html>\n<html${attrs}><head><meta charset="utf-8">${head}</head><body><h1>Hi</h1></body></html>`

describe('reading an uploaded page', () => {
  it('reports what the document says', () => {
    const html = doc(
      '<title>About us</title><meta name="description" content="Who we are"><meta name="theme-color" content="#0f172a"><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://example.com/about">',
      ' lang="tr" dir="rtl"',
    )
    expect(readHtmlPageSettings(html)).toEqual({
      language: 'tr',
      direction: 'rtl',
      themeColor: '#0f172a',
      smoothScroll: false,
      noIndex: true,
      canonicalUrl: 'https://example.com/about',
      seoTitle: 'About us',
      seoDescription: 'Who we are',
    })
  })

  it('falls back cleanly for a bare document', () => {
    const settings = readHtmlPageSettings('<html><body>hi</body></html>')
    expect(settings.language).toBe('en')
    expect(settings.direction).toBe('')
    expect(settings.noIndex).toBe(false)
  })

  // The panel is fed by this reader, so a hand edit in Source is what it shows.
  it('follows a hand edit to the document', () => {
    expect(readHtmlPageSettings(doc('', ' lang="de"')).language).toBe('de')
    expect(readHtmlPageSettings(doc('', ' lang="xx-NOPE!"')).language).toBe('en')
  })
})

describe('writing to an uploaded page', () => {
  it('sets the language and the direction on the root', () => {
    const html = applyHtmlPageSettings(doc(), { language: 'ar', direction: 'rtl' })
    expect(html).toContain('lang="ar"')
    expect(html).toContain('dir="rtl"')
    expect(readHtmlPageSettings(html).direction).toBe('rtl')
  })

  it('clears the direction when it is set back to "follow the language"', () => {
    const rtl = applyHtmlPageSettings(doc(), { direction: 'rtl' })
    expect(applyHtmlPageSettings(rtl, { direction: '' })).not.toContain('dir=')
  })

  it('adds, updates and removes the head tags it owns', () => {
    let html = applyHtmlPageSettings(doc(), { themeColor: '#123456', noIndex: true, canonicalUrl: 'https://example.com/x' })
    expect(html).toContain('content="#123456"')
    expect(html).toContain('noindex')
    expect(html).toContain('https://example.com/x')

    html = applyHtmlPageSettings(html, { themeColor: '', noIndex: false, canonicalUrl: '' })
    expect(html).not.toContain('theme-color')
    expect(html).not.toContain('robots')
    expect(html).not.toContain('canonical')
  })

  it('refuses a colour that is not a colour', () => {
    expect(applyHtmlPageSettings(doc(), { themeColor: 'red" onload="x' })).not.toContain('theme-color')
  })

  it('toggles smooth scrolling with its own marked style, never a second one', () => {
    const on = applyHtmlPageSettings(doc(), { smoothScroll: true })
    expect(on).toContain('scroll-behavior: smooth')
    expect(readHtmlPageSettings(on).smoothScroll).toBe(true)

    const again = applyHtmlPageSettings(on, { smoothScroll: true })
    expect(again.match(/scroll-behavior: smooth/g)).toHaveLength(1)

    expect(applyHtmlPageSettings(again, { smoothScroll: false })).not.toContain('scroll-behavior')
  })

  it('writes the search title and description into the head', () => {
    const html = applyHtmlPageSettings(doc(), { seoTitle: 'Portfolio', seoDescription: 'Work and words.' })
    expect(html).toContain('<title>Portfolio</title>')
    expect(readHtmlPageSettings(html).seoDescription).toBe('Work and words.')
  })

  it('touches nothing the patch does not name, and keeps the body', () => {
    const start = applyHtmlPageSettings(doc(), { themeColor: '#abcdef', language: 'fr' })
    const after = applyHtmlPageSettings(start, { noIndex: true })
    expect(after).toContain('content="#abcdef"')
    expect(after).toContain('lang="fr"')
    expect(after).toContain('<h1>Hi</h1>')
    expect(after.startsWith('<!DOCTYPE html>')).toBe(true)
  })
})
