// Brush constants + helpers shared by both editor modes (the component canvas
// and the HTML-upload workspace). Kept out of the BrushControls component file
// so fast-refresh stays happy (a file may only export components for HMR).

export const BRUSH_BASIC_COLORS = [
  '#111827', '#ffffff', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#14b8a6', '#2563eb', '#7c3aed', '#ec4899',
]

export const BRUSH_TARGETS = [
  ['smart', 'Smart'],
  ['fill', 'Fill'],
  ['text', 'Text'],
  ['border', 'Border'],
]

export const BRUSH_RECENTS_KEY = 'pwb_brush_recent_colors'

export function normalizeBrushColor(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim())
    ? color.trim().toLowerCase()
    : ''
}

export function readBrushRecents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BRUSH_RECENTS_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed
        .map(normalizeBrushColor)
        .filter((color) => color && !BRUSH_BASIC_COLORS.includes(color))
        .slice(0, 8)
      : []
  } catch {
    return []
  }
}
