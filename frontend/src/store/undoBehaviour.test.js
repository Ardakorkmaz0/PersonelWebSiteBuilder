// Undo has to behave like undo: one Ctrl+Z should take back a sentence's worth
// of typing, not a whole session's. The coalescing window used to extend on
// every keystroke, so a run of edits with no half-second pause never produced a
// second history entry — twenty seconds of writing collapsed into one step, and
// a single undo reverted the component to its default text.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useEditorStore, selectCurrentPage } from './editorStore.js'

const s = () => useEditorStore.getState()
const page = () => selectCurrentPage(s())
const first = () => page().components[0]

beforeEach(() => {
  s().loadSchema({ theme: {}, pages: [{ id: 'p1', name: 'Home', components: [], background: '#fff' }] })
  s().addComponent('heading')
})

describe('undo coalescing', () => {
  it('a quick burst of edits is still a single step', () => {
    vi.useFakeTimers()
    const id = first().id
    s().updateProps(id, { text: 'a' })
    const depth = s().past.length
    for (const text of ['ab', 'abc', 'abcd']) {
      vi.advanceTimersByTime(80)
      s().updateProps(id, { text })
    }
    expect(s().past.length, 'a 240ms burst should not add history').toBe(depth)
    vi.useRealTimers()
  })

  it('continuous typing stops collapsing once the burst ceiling is passed', () => {
    vi.useFakeTimers()
    const id = first().id
    s().updateProps(id, { text: 'START' })
    const depth = s().past.length
    // 100 keystrokes 100ms apart: no gap ever reaches COALESCE_MS, so the old
    // window would have absorbed all ten seconds into one entry.
    for (let i = 0; i < 100; i += 1) {
      vi.advanceTimersByTime(100)
      s().updateProps(id, { text: `typed ${i}` })
    }
    expect(s().past.length, 'ten seconds of typing needs more than one step').toBeGreaterThan(depth + 2)
    vi.useRealTimers()
  })

  it('one undo after a long run gives back a recent state, not the beginning', () => {
    vi.useFakeTimers()
    const id = first().id
    s().updateProps(id, { text: 'START' })
    for (let i = 0; i < 100; i += 1) {
      vi.advanceTimersByTime(100)
      s().updateProps(id, { text: `typed ${i}` })
    }
    s().undo()
    const after = first().props.text
    vi.useRealTimers()
    expect(after, 'should not fall all the way back to the default text').not.toBe('Welcome to my site')
    expect(after).toMatch(/^typed /)
  })

  it('edits to different components never share a step', () => {
    const a = first().id
    s().addComponent('text')
    const b = page().components[1].id
    s().updateProps(a, { text: 'A' })
    const depth = s().past.length
    s().updateProps(b, { text: 'B' })
    expect(s().past.length).toBeGreaterThan(depth)
  })

  it('loading a schema clears the coalescing state', () => {
    const id = first().id
    s().updateProps(id, { text: 'x' })
    s().loadSchema({ theme: {}, pages: [{ id: 'p2', name: 'Other', components: [], background: '#fff' }] })
    expect(s().past).toEqual([])
  })
})

describe('a group gesture obeys the same edges as a single one', () => {
  // setLayout clamps to the artboard ("a drag/resize can never push the box
  // past its container's right/bottom edge") but setLayoutMany did not, so
  // dragging or arrow-nudging a MULTI selection walked components off the
  // canvas, where they are invisible and unclickable until an undo or reload.
  const place = (id, patch) => s().setLayout(id, patch)

  it('arrow-nudging a selection stops at the right edge', () => {
    const id = first().id
    place(id, { x: 900, y: 10, w: 200, h: 50 })
    s().selectMany([id])
    for (let i = 0; i < 50; i += 1) s().nudgeSelection(20, 0)
    const l = first().layout
    expect(l.x + l.w, 'box should stay on the artboard').toBeLessThanOrEqual(page().canvasWidth)
  })

  it('the same is true for a two-component selection', () => {
    const a = first().id
    s().addComponent('text')
    const b = page().components[1].id
    place(a, { x: 800, y: 0, w: 200, h: 50 })
    place(b, { x: 800, y: 80, w: 200, h: 50 })
    s().selectMany([a, b])
    for (let i = 0; i < 30; i += 1) s().nudgeSelection(25, 0)
    for (const id of [a, b]) {
      const l = page().components.find((c) => c.id === id).layout
      expect(l.x + l.w, id).toBeLessThanOrEqual(page().canvasWidth)
    }
  })

  it('setLayoutMany clamps a direct write too', () => {
    const id = first().id
    place(id, { x: 0, y: 0, w: 200, h: 50 })
    s().setLayoutMany({ [id]: { x: 5000 } })
    expect(first().layout.x + first().layout.w).toBeLessThanOrEqual(page().canvasWidth)
  })

  it('nudging up and left still stops at zero', () => {
    const id = first().id
    place(id, { x: 50, y: 50, w: 100, h: 40 })
    s().selectMany([id])
    for (let i = 0; i < 20; i += 1) s().nudgeSelection(-20, -20)
    expect(first().layout.x).toBeGreaterThanOrEqual(0)
    expect(first().layout.y).toBeGreaterThanOrEqual(0)
  })
})
