const SCREEN_WIDTH = 164

export function normalizedSelectionActionsScale(value) {
  return Math.max(0.35, Math.min(1, Number(value) || 1))
}

// Positioning works in design pixels, while the toolbar should keep a
// comfortable physical size when a large artboard is scaled down.
export function selectionActionsCanvasWidth(canvasScale = 1) {
  return Math.ceil(SCREEN_WIDTH / normalizedSelectionActionsScale(canvasScale))
}
