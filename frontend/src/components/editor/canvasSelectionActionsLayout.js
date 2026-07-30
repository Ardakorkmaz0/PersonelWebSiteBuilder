// Keep the action bar the same *physical* size while the artboard is fitted
// down. These values mirror CanvasSelectionActions: 28px buttons, 2px gaps,
// 4px padding and a 1px border on each side.
const SCREEN_BUTTON = 28
const SCREEN_GAP = 2
const SCREEN_PADDING = 4
const SCREEN_BORDER = 1
const SCREEN_HEIGHT = SCREEN_BUTTON + SCREEN_PADDING * 2 + SCREEN_BORDER * 2
const SCREEN_EDGE_GAP = 8

export const DEFAULT_SELECTION_ACTION_COUNT = 7

export function normalizedSelectionActionsScale(value) {
  return Math.max(0.35, Math.min(1, Number(value) || 1))
}

// Positioning works in design pixels, while the toolbar should keep a
// comfortable physical size when a large artboard is scaled down.
export function selectionActionsCanvasWidth(canvasScale = 1, actionCount = DEFAULT_SELECTION_ACTION_COUNT) {
  const count = Math.max(1, Number(actionCount) || DEFAULT_SELECTION_ACTION_COUNT)
  const screenWidth =
    count * SCREEN_BUTTON +
    Math.max(0, count - 1) * SCREEN_GAP +
    SCREEN_PADDING * 2 +
    SCREEN_BORDER * 2
  return Math.ceil(screenWidth / normalizedSelectionActionsScale(canvasScale))
}

export function selectionActionsCanvasHeight(canvasScale = 1) {
  return Math.ceil(SCREEN_HEIGHT / normalizedSelectionActionsScale(canvasScale))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, Math.max(min, max)))
}

// Return coordinates in the canvas' design-pixel space. The bar is centred on
// the selected DOM box rather than on the page, then clamped only if that
// centred position would run beyond the artboard. Near the top edge it flips
// below the selected element so it remains fully reachable.
export function selectionActionsPosition({
  canvasWidth,
  canvasHeight,
  targetX,
  targetY,
  targetWidth,
  targetHeight,
  canvasScale = 1,
  actionCount = DEFAULT_SELECTION_ACTION_COUNT,
}) {
  const scale = normalizedSelectionActionsScale(canvasScale)
  const edge = Math.ceil(SCREEN_EDGE_GAP / scale)
  const gap = Math.ceil(SCREEN_EDGE_GAP / scale)
  const width = selectionActionsCanvasWidth(scale, actionCount)
  const height = selectionActionsCanvasHeight(scale)
  const safeCanvasWidth = Math.max(1, Number(canvasWidth) || 1)
  const safeCanvasHeight = Math.max(1, Number(canvasHeight) || 1)
  const x = Number(targetX) || 0
  const y = Number(targetY) || 0
  const targetW = Math.max(0, Number(targetWidth) || 0)
  const targetH = Math.max(0, Number(targetHeight) || 0)
  const centredLeft = x + (targetW - width) / 2
  const left = clamp(centredLeft, edge, safeCanvasWidth - edge - width)
  const aboveTop = y - height - gap
  const belowTop = y + targetH + gap
  const canPlaceAbove = aboveTop >= edge
  const canPlaceBelow = belowTop + height <= safeCanvasHeight - edge

  if (canPlaceAbove || !canPlaceBelow) {
    return { left: Math.round(left), top: Math.round(Math.max(edge, aboveTop)), placement: 'above' }
  }
  return { left: Math.round(left), top: Math.round(belowTop), placement: 'below' }
}
