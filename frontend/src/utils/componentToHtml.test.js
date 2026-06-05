// The HTML-mode editor uses these snippets when the user clicks a palette
// item — they have to produce parseable HTML for every type the editor
// exposes, and append correctly to a document with or without a </body>.
import { describe, expect, it } from 'vitest'
import { appendComponentToHtml, componentToHtml } from './componentToHtml.js'

describe('componentToHtml', () => {
  it('returns a non-empty snippet for every common palette type', () => {
    const types = [
      'navbar', 'heading', 'text', 'button', 'linkbutton', 'image',
      'section', 'card', 'list', 'quote', 'badge', 'divider', 'spacer',
      'input', 'select', 'alert', 'accordion', 'container', 'tabs', 'html',
    ]
    for (const t of types) {
      const out = componentToHtml(t)
      expect(out.length, `${t} → empty`).toBeGreaterThan(0)
      expect(out, `${t} → no html tag`).toMatch(/<[a-z]/i)
    }
  })

  it('falls back to a placeholder div for unknown types', () => {
    expect(componentToHtml('made-up-type')).toContain('data-component="made-up-type"')
  })
})

describe('appendComponentToHtml', () => {
  it('inserts the snippet just before </body> when present', () => {
    const before = '<html><body><h1>Hi</h1></body></html>'
    const after = appendComponentToHtml(before, 'heading')
    expect(after).toContain('<h1>Hi</h1>')
    expect(after.indexOf('A new heading')).toBeLessThan(after.indexOf('</body>'))
  })

  it('appends to the end when the input has no </body>', () => {
    const before = '<h1>Fragment</h1>'
    const after = appendComponentToHtml(before, 'text')
    expect(after.startsWith('<h1>Fragment</h1>')).toBe(true)
    expect(after).toContain('Edit this paragraph')
  })

  it('survives an empty / undefined input gracefully', () => {
    const out = appendComponentToHtml('', 'button')
    expect(out).toContain('Click me')
    expect(appendComponentToHtml(undefined, 'button')).toContain('Click me')
  })
})
