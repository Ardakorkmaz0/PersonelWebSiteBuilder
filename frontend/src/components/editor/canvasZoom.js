// How big the edit canvas is drawn, decided by the user instead of by the
// window.
//
// Both canvases used to compute `Math.min(1, area / frame)`: fit, and never
// larger than life. That has two failure modes and people hit both. Pick a
// device wider than the editor area and everything shrinks to fit, so the 16px
// you typed draws at 10 and the page stops looking like the thing you are
// building. Sit at a high resolution with a narrow design and the scale clamps
// at 1, leaving the artboard small in the middle of an empty room with no way
// to bring it closer.
//
// So zoom is its own setting, remembered per surface, and 'fit' stays available
// as one of its values rather than being the only behaviour. The vocabulary
// (steps, the 'fit' sentinel, the storage shape) matches the browser-frame zoom
// that already exists in View, because a second dialect of the same idea is how
// two controls end up disagreeing.

export const ZOOM_STEPS = [25, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 300, 400]

export const MIN_ZOOM = ZOOM_STEPS[0]
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]

/** The stored value for a surface: a step, or 'fit'. Anything unrecognised —
 * a hand-edited key, a value from an older build — reads as 'fit'. */
export function readZoom(key) {
  try {
    const value = localStorage.getItem(key)
    if (value === 'fit') return 'fit'
    const number = Number(value)
    return ZOOM_STEPS.includes(number) ? number : 'fit'
  } catch {
    return 'fit'
  }
}

export function writeZoom(key, zoom) {
  try {
    localStorage.setItem(key, String(zoom))
  } catch {
    /* private mode — remembering the zoom is a nicety, not required */
  }
}

/** The scale to actually draw at.
 *
 * `fitScale` is what the old code computed. Note it is NOT clamped to 1 here:
 * 'fit' means fit, and on a wide screen with a narrow artboard that legitimately
 * means bigger than life — which is the whole point on a high-resolution
 * display. Callers that want the old ceiling can clamp their own fitScale. */
export function zoomScale(zoom, fitScale) {
  const fit = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1
  if (zoom === 'fit') return fit
  const percent = Number(zoom)
  if (!Number.isFinite(percent) || percent <= 0) return fit
  return percent / 100
}

/** What to show in the control: a real percentage, even while on 'fit'. */
export function zoomPercent(zoom, fitScale) {
  return Math.round(zoomScale(zoom, fitScale) * 100)
}

/** Step up or down.
 *
 * Stepping while on 'fit' starts from where fit actually landed, so the first
 * click nudges the size you can see rather than jumping to some remembered
 * number — pressing + on a canvas drawn at 62% should give you a bit more than
 * 62%, not 110%. */
export function nextZoom(zoom, direction, fitScale) {
  const current = zoomPercent(zoom, fitScale)
  if (direction > 0) return ZOOM_STEPS.find((step) => step > current) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((step) => step < current) ?? MIN_ZOOM
}
