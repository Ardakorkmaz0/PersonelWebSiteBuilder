import { describe, expect, it } from 'vitest'
import { SNAP_THRESHOLD, snapDraggedRect, snapThresholdFor } from './snapping.js'

const artboard = { w: 1000, h: 0 }

describe('snapDraggedRect', () => {
  it('snaps to a sibling edge within threshold and emits a guide', () => {
    const siblings = [{ id: 'a', x: 100, y: 0, w: 50, h: 50 }]
    const out = snapDraggedRect({ id: 'b', x: 103, y: 300, w: 50, h: 50 }, siblings, artboard)
    expect(out.x).toBe(100) // left edge snapped to sibling's left
    expect(out.guides).toContainEqual({ type: 'v', pos: 100 })
  })

  it('rounds to the grid on an axis with no sibling/artboard snap', () => {
    const out = snapDraggedRect({ id: 'b', x: 47, y: 83, w: 50, h: 50 }, [], { w: 1000, h: 0 }, 10)
    expect(out.x).toBe(50)
    expect(out.y).toBe(80)
    expect(out.guides).toHaveLength(0)
  })

  it('lets an edge/centre snap win over the grid', () => {
    const siblings = [{ id: 'a', x: 200, y: 0, w: 50, h: 50 }]
    const out = snapDraggedRect({ id: 'b', x: 203, y: 11, w: 50, h: 50 }, siblings, artboard, 10)
    expect(out.x).toBe(200) // sibling snap, not grid (would be 200 too, so use y)
    expect(out.y).toBe(10) // no sibling on y → grid rounds 11 → 10
  })
})

describe('snap threshold follows the zoom', () => {
  const siblings = [{ id: 'a', x: 100, y: 0, w: 50, h: 50 }]
  const artboard = { w: 1000, h: 0 }

  it('is a constant distance on screen, not in design pixels', () => {
    expect(snapThresholdFor(1)).toBe(SNAP_THRESHOLD)
    expect(snapThresholdFor(0.25)).toBe(SNAP_THRESHOLD * 4)
    expect(snapThresholdFor(4)).toBe(SNAP_THRESHOLD / 4)
    expect(snapThresholdFor(0)).toBe(SNAP_THRESHOLD)
    expect(snapThresholdFor(undefined)).toBe(SNAP_THRESHOLD)
  })

  it('still reaches a nearby edge when the canvas is zoomed far out', () => {
    // 12 design px away = 3 screen px at 25%: close enough to snap there.
    const out = snapDraggedRect({ id: 'b', x: 112, y: 300, w: 50, h: 50 }, siblings, artboard, 0, snapThresholdFor(0.25))
    expect(out.x).toBe(100)
  })

  it('does not grab from across the screen when zoomed far in', () => {
    // 4 design px away = 16 screen px at 400%: a deliberate placement, left alone.
    const out = snapDraggedRect({ id: 'b', x: 104, y: 300, w: 50, h: 50 }, siblings, artboard, 0, snapThresholdFor(4))
    expect(out.x).toBe(104)
  })
})
