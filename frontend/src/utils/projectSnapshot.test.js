import { describe, expect, it } from 'vitest'
import { projectSnapshot, splitPageHtml } from './projectSnapshot.js'

describe('splitPageHtml', () => {
  it('lifts each page document out of the schema into a map', () => {
    const { schema, htmlMap } = splitPageHtml({
      theme: { a: 1 },
      pages: [{ id: 'a', html: '<p>A</p>' }, { id: 'b', html: '   ' }, { id: 'c' }],
    })
    expect(htmlMap).toEqual({ a: '<p>A</p>' })
    expect(schema.theme).toEqual({ a: 1 })
    for (const page of schema.pages) expect(page).not.toHaveProperty('html')
  })

  it('puts a legacy site-level document on the first page only when it has none', () => {
    expect(splitPageHtml({ pages: [{ id: 'a' }, { id: 'b' }] }, '<p>old</p>').htmlMap).toEqual({ a: '<p>old</p>' })
    expect(splitPageHtml({ pages: [{ id: 'a', html: '<p>new</p>' }] }, '<p>old</p>').htmlMap).toEqual({ a: '<p>new</p>' })
  })
})

describe('projectSnapshot', () => {
  it('folds the map back into every page and mirrors the home page', () => {
    const { schema, homeHtml } = projectSnapshot(
      { theme: {}, pages: [{ id: 'home', components: [] }, { id: 'b', components: [] }] },
      { home: '<p>H</p>' },
    )
    expect(schema.pages.map((p) => p.html)).toEqual(['<p>H</p>', ''])
    expect(homeHtml).toBe('<p>H</p>')
  })

  it('is the inverse of splitPageHtml', () => {
    const original = { theme: {}, pages: [{ id: 'x', html: '<p>X</p>', components: [] }, { id: 'y', html: '', components: [] }] }
    const { schema, htmlMap } = splitPageHtml(original)
    expect(projectSnapshot(schema, htmlMap).schema).toEqual(original)
  })
})
