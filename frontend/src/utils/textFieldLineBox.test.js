// jsdom has no layout engine, so every measurement here comes back as zero —
// what these tests pin is the contract around it: the guards, the range checks
// and that a measurement never throws or leaves its mirror behind in the page.
import { describe, expect, it } from 'vitest'
import { lineBoxIn } from './textFieldLineBox.js'

const field = (value) => {
  const element = document.createElement('textarea')
  element.value = value
  document.body.append(element)
  return element
}

describe('lineBoxIn', () => {
  it('refuses what it cannot measure', () => {
    expect(lineBoxIn(null, 'a\nb', 1)).toBeNull()
    expect(lineBoxIn(field('a\nb'), 'a\nb', 0)).toBeNull()
    expect(lineBoxIn(field('a\nb'), 'a\nb', 9)).toBeNull()
  })

  it('answers for a line inside the document', () => {
    const box = lineBoxIn(field('a\nb\nc'), 'a\nb\nc', 2)
    expect(box).not.toBeNull()
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.height).toBeGreaterThanOrEqual(0)
  })

  it('cleans up after itself', () => {
    const before = document.body.children.length
    lineBoxIn(field('a\nb'), 'a\nb', 2, 1)
    // The field itself is still there; the hidden mirror is not.
    expect(document.body.children.length).toBe(before + 1)
  })
})
