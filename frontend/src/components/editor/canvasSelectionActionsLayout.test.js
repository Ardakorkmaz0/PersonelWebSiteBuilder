import { describe, expect, it } from 'vitest'
import {
  selectionActionsCanvasHeight,
  selectionActionsCanvasWidth,
  selectionActionsPosition,
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
