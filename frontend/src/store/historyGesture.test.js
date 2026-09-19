// One pointer gesture is one undo step — however long it lasts.
//
// Undo used to rely on time-based coalescing alone: edits with the same key
// within 500ms merge, capped at 2.5s so a minute of typing is not one step. A
// drag rides the same path, so a drag longer than 2.5s — or one where the hand
// paused for half a second — became several steps, and one Ctrl+Z put the item
// only part of the way back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { selectCurrentPage, useEditorStore } from './editorStore.js'

const s = () => useEditorStore.getState()
const page = () => selectCurrentPage(useEditorStore.getState())
const layoutOf = (id) => page().components.find((c) => c.id === id).layout

function load(components) {
  s().loadSchema({ theme: {}, pages: [{ id: 'p1', name: 'Home', canvasWidth: 1000, components }] })
}

const box = (id, x, y, w = 100, h = 40) => ({ id, type: 'button', props: {}, styles: {}, layout: { x, y, w, h } })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})
afterEach(() => {
  s().endHistoryGesture()
  vi.useRealTimers()
})

describe('history gestures', () => {
  it('turns a four-second drag into exactly one undo step', () => {
    load([box('a', 10, 10)])
    s().beginHistoryGesture()
    for (let tick = 1; tick <= 40; tick += 1) {
      vi.advanceTimersByTime(100)
      s().setLayout('a', { x: 10 + tick * 5, y: 10 })
    }
    s().endHistoryGesture()

    expect(s().past).toHaveLength(1)
    expect(layoutOf('a').x).toBe(210)
    s().undo()
    expect(layoutOf('a').x).toBe(10)
  })

  it('does not split when the hand rests mid-drag', () => {
    load([box('a', 10, 10)])
    s().beginHistoryGesture()
    s().setLayout('a', { x: 50, y: 10 })
    vi.advanceTimersByTime(1500) // held still, longer than the 500ms merge window
    s().setLayout('a', { x: 90, y: 10 })
    s().endHistoryGesture()
    expect(s().past).toHaveLength(1)
  })

  it('leaves no empty undo step for a click that never moved', () => {
    load([box('a', 10, 10)])
    s().beginHistoryGesture()
    s().endHistoryGesture()
    expect(s().past).toHaveLength(0)
  })

  it('makes two drags of the same item two steps, even back to back', () => {
    load([box('a', 10, 10)])
    for (const x of [100, 200]) {
      s().beginHistoryGesture()
      s().setLayout('a', { x, y: 10 })
      s().endHistoryGesture()
    }
    expect(s().past).toHaveLength(2)
    s().undo()
    expect(layoutOf('a').x).toBe(100)
  })

  it('still coalesces ordinary same-key edits outside a gesture', () => {
    load([box('a', 10, 10)])
    s().updateStyles('a', { color: '#111111' })
    vi.advanceTimersByTime(100)
    s().updateStyles('a', { color: '#222222' })
    expect(s().past).toHaveLength(1)
  })

  it('does not leak an open gesture into a freshly loaded site', () => {
    load([box('a', 10, 10)])
    s().beginHistoryGesture()
    s().setLayout('a', { x: 50, y: 10 })
    load([box('a', 10, 10)]) // gesture never ended (e.g. navigated away)
    s().setLayout('a', { x: 60, y: 10 })
    vi.advanceTimersByTime(1000)
    s().setLayout('a', { x: 70, y: 10 })
    // Normal coalescing rules again: two edits a second apart are two steps.
    expect(s().past).toHaveLength(2)
  })
})

describe('align / distribute stay on the artboard', () => {
  it('aligning can never push a nested child out of its parent', () => {
    // A selection spanning a page item and a container child mixes two
    // coordinate spaces; the group's right edge (950) is far outside the
    // 300px container, and the child used to be written straight to x=850.
    load([
      box('a', 800, 10, 150, 40),
      {
        id: 'box', type: 'container', props: {}, styles: {},
        layout: { x: 0, y: 100, w: 300, h: 200 },
        children: [box('k', 10, 10, 100, 40)],
      },
    ])
    s().selectMany(['a', 'k'])
    s().alignSelection('right')
    const child = page().components.find((c) => c.id === 'box').children[0].layout
    expect(child.x + child.w).toBeLessThanOrEqual(300)
    expect(layoutOf('a').x + layoutOf('a').w).toBeLessThanOrEqual(1000)
  })

  it('writes whole pixels', () => {
    load([box('a', 0, 0, 101, 40), box('b', 300, 0, 50, 40), box('c', 600, 0, 33, 40)])
    s().selectMany(['a', 'b', 'c'])
    s().distributeSelection('x')
    for (const id of ['a', 'b', 'c']) expect(Number.isInteger(layoutOf(id).x)).toBe(true)
  })
})

describe('pasting again cascades', () => {
  it('each Ctrl+V lands 24px further than the last, never on top of it', () => {
    load([box('a', 100, 100)])
    s().selectComponent('a')
    s().copySelection()
    s().pasteClipboard()
    s().pasteClipboard()
    const xs = page().components.map((c) => c.layout.x)
    expect(xs).toEqual([100, 124, 148])
    expect(new Set(page().components.map((c) => c.id)).size).toBe(3)
  })
})
