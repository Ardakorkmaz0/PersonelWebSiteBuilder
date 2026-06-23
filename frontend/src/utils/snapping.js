// Live snap math used by the free-canvas drag handler.
//
// Given a rect that the user is currently dragging and a list of sibling
// layouts on the same canvas, return:
//   { x, y }          → the position after magnetic snap (already nudged
//                       toward the nearest candidate if within THRESHOLD),
//   guides            → an array of { type: 'v' | 'h', pos } describing the
//                       dashed lines the Canvas should render while the drag
//                       is active.
//
// Each axis is considered independently: the left/center/right edges of the
// dragged rect are matched against the left/center/right edges of every
// sibling AND of the artboard. Same for vertical.
//
// We return the FULL match on each axis (i.e. when the dragged centre hits
// the artboard centre we both snap to it AND emit the guide line), so the
// visual reflects exactly what the snap did.

export const SNAP_THRESHOLD = 6 // pixels of slack for the magnetic snap

// Build the candidate axis values (x positions for vertical guides, y for
// horizontal). artboard = { w, h }; siblings = [{ id, x, y, w, h }, ...].
function buildCandidates(siblings, artboard, draggedId) {
  const xs = [0, artboard.w / 2, artboard.w]
  const ys = [0]
  if (artboard.h) ys.push(artboard.h / 2, artboard.h)
  for (const s of siblings) {
    if (!s || s.id === draggedId) continue
    const sx = s.x || 0
    const sy = s.y || 0
    const sw = s.w || 0
    const sh = s.h || 0
    xs.push(sx, sx + sw / 2, sx + sw)
    ys.push(sy, sy + sh / 2, sy + sh)
  }
  return { xs, ys }
}

// Find the best snap candidate for one axis. Tries left/centre/right edges
// of the dragged rect against every candidate; picks the one with the
// smallest delta within THRESHOLD. The delta we return is the shift to add
// to the rect's start coordinate — for any probe (left, centre or right),
// new_start = old_start + (cand - probe) keeps that probe aligned with
// the candidate. Returns { delta, pos } or null.
function snapAxis(start, size, candidates) {
  let best = null
  const tryMatch = (probe) => {
    for (const cand of candidates) {
      const delta = cand - probe
      if (Math.abs(delta) >= SNAP_THRESHOLD) continue
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = { delta, pos: cand }
      }
    }
  }
  tryMatch(start) // left/top edge
  tryMatch(start + size / 2) // centre
  tryMatch(start + size) // right/bottom edge
  return best
}

// `grid` (px, 0 = off): when an axis finds NO sibling/artboard snap, the position
// rounds to the nearest grid line instead — so dragging lands on a tidy grid
// while edge/centre alignment still wins when it's in range.
export function snapDraggedRect(rect, siblings, artboard, grid = 0) {
  const { x, y, w, h, id } = rect
  const cands = buildCandidates(siblings, artboard, id)
  const x2 = snapAxis(x, w, cands.xs)
  const y2 = snapAxis(y, h, cands.ys)
  const guides = []
  let outX = x
  let outY = y
  if (x2) {
    outX = x + x2.delta
    guides.push({ type: 'v', pos: x2.pos })
  } else if (grid > 0) {
    outX = Math.round(x / grid) * grid
  }
  if (y2) {
    outY = y + y2.delta
    guides.push({ type: 'h', pos: y2.pos })
  } else if (grid > 0) {
    outY = Math.round(y / grid) * grid
  }
  return { x: outX, y: outY, guides }
}
