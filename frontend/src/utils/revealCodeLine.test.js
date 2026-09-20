// The ticker reads the page through one writer and the Source panel may show
// another, so "go to this line" cannot trust the line number alone.
import { describe, expect, it } from 'vitest'
import { lineIndexFor } from './revealCodeLine.js'

const doc = [
  '<!doctype html>',
  '<html lang="en">',
  '<body>',
  '  <h1 id="c1" class="c-c1">Hello</h1>',
  '  <p id="c2" class="c-c2">Text</p>',
  '</body>',
].join('\n')

describe('lineIndexFor', () => {
  it('finds an exact line wherever it sits', () => {
    expect(lineIndexFor(doc, { text: '<body>', line: 999 })).toBe(2)
  })

  it('ignores leading whitespace differences', () => {
    expect(lineIndexFor(doc, { text: '<p id="c2" class="c-c2">Text</p>' })).toBe(4)
  })

  it('follows the element id when the markup itself differs between writers', () => {
    // What the ticker showed (responsive writer) vs what Source holds.
    const shown = '<h1 class="rh-item rh-m0" id="c1" style="flex:1 1 100%">Hello</h1>'
    expect(lineIndexFor(doc, { text: shown, line: 112 })).toBe(3)
  })

  it('falls back to a containing line, then to the raw number', () => {
    expect(lineIndexFor(doc, { text: 'lang="en"' })).toBe(1)
    expect(lineIndexFor(doc, { text: 'nothing like this at all', line: 3 })).toBe(2)
  })

  it('clamps a number past the end and refuses a document it cannot place', () => {
    expect(lineIndexFor(doc, { line: 9999 })).toBe(5)
    expect(lineIndexFor(doc, {})).toBe(-1)
    expect(lineIndexFor('', { line: 4 })).toBe(0)
  })
})
