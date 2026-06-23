import { describe, expect, it } from 'vitest'
import { snapDraggedRect } from './snapping.js'

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
