import { describe, expect, it } from 'vitest'
import {
  selectionActionsCanvasHeight,
  selectionActionsCanvasWidth,
  selectionActionsPosition,
  selectionActionsScaleStyle,
} from './canvasSelectionActionsLayout.js'

describe('selection action bar placement', () => {
  it('centres the seven-action bar over the selected element in design coordinates', () => {
    expect(selectionActionsCanvasWidth(1)).toBe(218)
    expect(selectionActionsCanvasHeight(1)).toBe(38)
    expect(selectionActionsPosition({
      canvasWidth: 1000,
      canvasHeight: 800,
      targetX: 450,
      targetY: 200,
      targetWidth: 100,
      targetHeight: 50,
    })).toEqual({ left: 391, top: 154, placement: 'above' })
  })

  it('keeps the counter-scaled toolbar inside the right artboard edge', () => {
    // At 50% canvas fit the 218px physical bar needs 436 design pixels.
    expect(selectionActionsCanvasWidth(0.5)).toBe(436)
    expect(selectionActionsCanvasWidth(0.5, 8)).toBe(496)

    const position = selectionActionsPosition({
      canvasWidth: 600,
      canvasHeight: 700,
      targetX: 560,
      targetY: 180,
      targetWidth: 30,
      targetHeight: 50,
      canvasScale: 1,
    })

    expect(position).toEqual({ left: 374, top: 134, placement: 'above' })
    expect(position.left + selectionActionsCanvasWidth(1)).toBeLessThanOrEqual(600 - 8)
  })

  it('flips below an element near the top edge instead of clipping the bar', () => {
    expect(selectionActionsPosition({
      canvasWidth: 600,
      canvasHeight: 500,
      targetX: 20,
      targetY: 4,
      targetWidth: 100,
      targetHeight: 44,
    })).toEqual({ left: 8, top: 56, placement: 'below' })
  })
})

// How the bar is counter-scaled is a positioning question, not a cosmetic one.
//
// It used to be `zoom`, which resizes an element AND multiplies its left/top.
// So the bar drifted by the very factor that kept it readable: right on a 1:1
// artboard, and further from the selection the more the canvas was fitted down
// — measured at 21% fit, a bar that belonged over its element sat 252px to the
// right of it, and the drift grew with distance from the artboard's origin.
// The old tests could not see it: they asserted the style attribute, which was
// always correct — the browser moved the bar afterwards.
describe('selection action bar counter-scale', () => {
  it('never uses zoom, which would move the bar as well as resize it', () => {
    for (const scale of [1, 0.9, 0.5, 0.35, 0.2]) {
      expect(selectionActionsScaleStyle(scale), `scale ${scale}`).not.toHaveProperty('zoom')
    }
  })

  it('scales with a transform, which leaves layout position alone', () => {
    expect(selectionActionsScaleStyle(0.5)).toEqual({
      transform: 'scale(2)',
      transformOrigin: 'top left',
    })
    expect(selectionActionsScaleStyle(0.4)).toEqual({
      transform: 'scale(2.5)',
      transformOrigin: 'top left',
    })
  })

  it('does nothing at all when the artboard is not scaled', () => {
    expect(selectionActionsScaleStyle(1)).toEqual({})
    expect(selectionActionsScaleStyle(undefined)).toEqual({})
    // Above 1:1 the bar is already the right physical size.
    expect(selectionActionsScaleStyle(2)).toEqual({})
  })

  it('respects the same floor the reservation uses, so the two cannot disagree', () => {
    // Below the floor the bar stops growing; the reserved box stops with it.
    expect(selectionActionsScaleStyle(0.05)).toEqual(selectionActionsScaleStyle(0.35))
    expect(selectionActionsCanvasWidth(0.05)).toBe(selectionActionsCanvasWidth(0.35))
  })

  it('paints exactly the box the layout reserved for it', () => {
    // `top left` origin is only correct while these agree: the reservation is
    // the SCALED size in design pixels, and the transform grows the unscaled
    // box from its top-left corner to precisely that.
    const unscaledWidth = selectionActionsCanvasWidth(1)
    const unscaledHeight = selectionActionsCanvasHeight(1)
    for (const scale of [0.8, 0.5, 0.35]) {
      const factor = Number(selectionActionsScaleStyle(scale).transform.match(/scale\(([\d.]+)\)/)[1])
      expect(Math.ceil(unscaledWidth * factor), `w @ ${scale}`).toBe(selectionActionsCanvasWidth(scale))
      expect(Math.ceil(unscaledHeight * factor), `h @ ${scale}`).toBe(selectionActionsCanvasHeight(scale))
    }
  })
})
