// The spotlight preview is only worth having if it tells the truth: the page's
// own CSS, none of the editor's chrome, and a viewport width that actually
// makes the media queries fire.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  cleanElementHtml,
  elementSpotlightDocument,
  pageStyleHead,
} from './elementSpotlight.js'

beforeEach(() => {
  document.head.innerHTML = `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
    <style id="page">.nav-link { color: rebeccapurple; }</style>
    <style data-pwb-chrome>[data-pwb-selected] { outline: 2px solid blue; }</style>
    <style data-pwb-edit-chrome>[data-pwb-hover] { outline: 1px dashed; }</style>
    <style data-pwb-responsive-overrides>@media (max-width: 767px) { [data-pwb-mobile-font-size] { font-size: var(--pwb-mobile-font-size) !important; } }</style>
  `
  document.body.innerHTML = `
    <nav id="nav" class="menu" data-pwb-selected data-pwb-drag draggable="true">
      <a class="nav-link" href="#home" data-pwb-hover>Home</a>
      <div data-pwb-resize-overlay>chrome</div>
    </nav>
  `
})

describe('cleanElementHtml', () => {
  it('keeps the design and drops the editor markers', () => {
    const html = cleanElementHtml(document.getElementById('nav'))

    expect(html).toContain('class="menu"')
    expect(html).toContain('class="nav-link"')
    expect(html).toContain('Home')

    expect(html).not.toContain('data-pwb-selected')
    expect(html).not.toContain('data-pwb-hover')
    expect(html).not.toContain('data-pwb-drag')
    expect(html).not.toContain('draggable')
    expect(html).not.toContain('data-pwb-resize-overlay')
  })

  it('does not leave the preview editable', () => {
    const nav = document.getElementById('nav')
    nav.setAttribute('contenteditable', 'true')
    expect(cleanElementHtml(nav)).not.toContain('contenteditable')
  })

  it('leaves the real element alone — it only ever clones', () => {
    const nav = document.getElementById('nav')
    cleanElementHtml(nav)
    expect(nav.hasAttribute('data-pwb-selected')).toBe(true)
    expect(nav.querySelector('[data-pwb-resize-overlay]')).not.toBeNull()
  })

  it('returns nothing for a non-element', () => {
    expect(cleanElementHtml(null)).toBe('')
    expect(cleanElementHtml(document.createTextNode('x'))).toBe('')
  })
})

describe('pageStyleHead', () => {
  it('carries the page stylesheets, fonts and the responsive rule', () => {
    const head = pageStyleHead(document)
    expect(head).toContain('fonts.googleapis.com')
    expect(head).toContain('rebeccapurple')
    // Previewing at phone width is only honest if the phone values apply.
    expect(head).toContain('data-pwb-responsive-overrides')
  })

  it('leaves the editor chrome behind', () => {
    const head = pageStyleHead(document)
    expect(head).not.toContain('data-pwb-chrome')
    expect(head).not.toContain('data-pwb-edit-chrome')
    expect(head).not.toContain('outline: 2px solid blue')
  })
})

describe('elementSpotlightDocument', () => {
  it('builds a standalone document around the one element', () => {
    const html = elementSpotlightDocument(document, document.getElementById('nav'))
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('name="viewport"')
    expect(html).toContain('class="nav-link"')
    expect(html).toContain('rebeccapurple')
    expect(html).toContain('</html>')
    // Nothing of the rest of the page comes with it.
    expect(html).not.toContain('data-pwb-selected')
  })

  it('sets the width the element is measured against', () => {
    expect(elementSpotlightDocument(document, document.getElementById('nav'), { width: 390 }))
      .toContain('width:390px')
    // A width too small to render anything is refused.
    expect(elementSpotlightDocument(document, document.getElementById('nav'), { width: 10 }))
      .toContain('width:240px')
    expect(elementSpotlightDocument(document, document.getElementById('nav'), { width: 'wide' }))
      .toContain('width:960px')
  })

  it('previews on the page’s own background, not an assumed white', () => {
    document.body.style.backgroundColor = 'rgb(10, 12, 22)'
    expect(elementSpotlightDocument(document, document.getElementById('nav')))
      .toContain('background: rgb(10, 12, 22)')
  })
})
