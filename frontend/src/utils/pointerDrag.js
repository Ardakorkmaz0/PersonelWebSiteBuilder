// Follow one pointer from its pointerdown to the end of the gesture.
//
// Every drag in the editor used to listen for exactly pointermove + pointerup
// on window. A gesture does not always end in pointerup: on a touch screen the
// browser ends it with pointercancel when it takes the touch over (a scroll, a
// system gesture, an incoming call), and a mouse released outside the browser
// window may deliver nothing at all. Either way the listeners stayed bound,
// the item kept following the pointer on the next touch, and the drag's undo
// gesture never closed. This helper ends the drag on pointerup, pointercancel,
// lostpointercapture and window blur alike — once — and captures the pointer
// so a release outside the window is still delivered.

export function trackPointerDrag(startEvent, { onMove, onEnd } = {}) {
  const pointerId = startEvent?.pointerId
  const captureTarget = startEvent?.currentTarget
  let finished = false

  const move = (event) => {
    if (pointerId != null && event.pointerId != null && event.pointerId !== pointerId) return
    onMove?.(event)
  }

  const end = (event) => {
    if (finished) return
    if (event?.pointerId != null && pointerId != null && event.pointerId !== pointerId) return
    finished = true
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    window.removeEventListener('blur', end)
    captureTarget?.removeEventListener?.('lostpointercapture', end)
    try {
      if (pointerId != null && captureTarget?.hasPointerCapture?.(pointerId)) {
        captureTarget.releasePointerCapture(pointerId)
      }
    } catch { /* already released */ }
    onEnd?.(event)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  window.addEventListener('blur', end)
  try {
    if (pointerId != null && captureTarget?.setPointerCapture) {
      captureTarget.setPointerCapture(pointerId)
      captureTarget.addEventListener('lostpointercapture', end)
    }
  } catch { /* the pointer is already gone, or the target cannot capture */ }

  // Ending it early (e.g. the component unmounts mid-drag) goes through the
  // same single exit.
  return () => end()
}
