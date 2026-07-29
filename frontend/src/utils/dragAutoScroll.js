// Dragging inside a scrolling canvas.
//
// Two things have to be true at once, and they fight each other:
//
//   1. Reaching past the visible band. Once the artboard scrolls inside a fixed
//      phone screen, an item can only be dragged to where you can see — unless
//      holding the pointer at the edge scrolls the canvas under it.
//   2. The item staying under the pointer. Drag math is pure pointer delta
//      (`clientY - startY`), which ignores the canvas moving beneath it. Scroll
//      the canvas up by 200px mid-drag and the item is suddenly 200px away from
//      the finger that is holding it — it runs off in the opposite direction.
//
// So the scroll distance since the drag began is part of the delta. `scrolled()`
// reports it, in the scroller's own pixels; callers divide by the canvas scale,
// exactly as they do with the pointer delta.

export const AUTO_SCROLL_EDGE = 64
export const AUTO_SCROLL_STEP = 14

export const CANVAS_SCROLLER_ID = 'canvas-scroll'
export const CANVAS_ID = 'free-canvas'

// How much an element is scaled on screen by the transforms above it: its
// painted width over its own layout width. 0 when that cannot be measured.
function boxScale(el) {
  const width = el?.offsetWidth || 0
  if (!width || typeof el.getBoundingClientRect !== 'function') return 0
  const rect = el.getBoundingClientRect()
  return rect && rect.width ? rect.width / width : 0
}

// What one scrolled pixel of the scroller is worth in DESIGN pixels.
//
// The two canvases put the scroller on opposite sides of the zoom, and
// scrollTop is always in the scroller's OWN pixels, so the answer differs:
//
//   desktop  the workspace scrolls and the artboard is scaled inside it, so a
//            scrolled pixel is a screen pixel — worth 1/zoom design pixels
//   phone    the screen scrolls WITH the device, artboard unscaled inside it,
//            so a scrolled pixel already is a design pixel — worth 1
//
// Measuring both boxes against their untransformed width tells the two apart
// without either layout having to announce itself.
export function designScrollFactor(scroller, canvas) {
  const scrollerScale = boxScale(scroller)
  const canvasScale = boxScale(canvas)
  if (!scrollerScale || !canvasScale) return 1
  return scrollerScale / canvasScale
}

// How far to nudge the canvas for a pointer at `y`: positive scrolls the page
// down (content moves up), negative scrolls up, 0 means the pointer is not near
// an edge. Pure, so the edge behaviour is testable without a layout engine.
export function autoScrollStep(rect, y, edge = AUTO_SCROLL_EDGE, step = AUTO_SCROLL_STEP) {
  if (!rect || !Number.isFinite(y)) return 0
  if (rect.height <= edge * 2) return 0 // too short to have two edges
  if (y >= rect.bottom - edge) return step
  if (y <= rect.top + edge) return -step
  return 0
}

// Starts an edge-scroll loop for one drag. `apply` re-runs the caller's layout
// math after a scroll, since the pointer itself has not moved and no
// pointermove event will fire.
export function beginDragScroll(apply) {
  const scroller = typeof document === 'undefined'
    ? null
    : document.getElementById(CANVAS_SCROLLER_ID)
  const startTop = scroller ? scroller.scrollTop : 0
  const factor = designScrollFactor(
    scroller,
    typeof document === 'undefined' ? null : document.getElementById(CANVAS_ID),
  )
  let pointer = null
  let frame = 0

  const tick = () => {
    frame = requestAnimationFrame(tick)
    if (!scroller || !pointer) return
    const step = autoScrollStep(scroller.getBoundingClientRect(), pointer.y)
    if (!step) return
    const before = scroller.scrollTop
    scroller.scrollTop = before + step
    // At either end the scroll does nothing; don't churn the layout for it.
    if (scroller.scrollTop !== before) apply(pointer)
  }

  if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick)

  return {
    // Remember where the pointer is, so the loop can keep scrolling while it
    // rests at the edge.
    track: (event) => { pointer = { x: event.clientX, y: event.clientY } },
    // How far the canvas has travelled under the pointer since the drag began,
    // in DESIGN pixels — the same units the layout is written in, so callers
    // add it to their delta without a second conversion.
    scrolled: () => (scroller ? (scroller.scrollTop - startTop) * factor : 0),
    stop: () => { if (frame) cancelAnimationFrame(frame) },
  }
}
