// Where a tour card goes next to the thing it is talking about.
//
// Below the target when there is room, above it when there is not, and beside
// it when the target is tall — then clamped into the viewport, because a card
// that explains a button while hanging off the screen explains nothing.

const MARGIN = 10
const GAP = 12

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function placeCard(rect, viewport, card) {
  const { width: vw, height: vh } = viewport
  const { width: cw, height: ch } = card

  // No target (or one that is not on screen): the card stands on its own.
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { top: Math.round((vh - ch) / 2), left: Math.round((vw - cw) / 2), placement: 'center' }
  }

  const below = rect.bottom + GAP
  const above = rect.top - GAP - ch
  const rightOf = rect.right + GAP
  const leftOf = rect.left - GAP - cw

  let placement = 'below'
  let top = below
  let left = rect.left + rect.width / 2 - cw / 2

  if (below + ch > vh - MARGIN) {
    if (above >= MARGIN) {
      placement = 'above'
      top = above
    } else if (rightOf + cw <= vw - MARGIN) {
      placement = 'right'
      top = rect.top + rect.height / 2 - ch / 2
      left = rightOf
    } else if (leftOf >= MARGIN) {
      placement = 'left'
      top = rect.top + rect.height / 2 - ch / 2
      left = leftOf
    }
  }

  return {
    top: Math.round(clamp(top, MARGIN, vh - ch - MARGIN)),
    left: Math.round(clamp(left, MARGIN, vw - cw - MARGIN)),
    placement,
  }
}

// The steps whose target is actually on this screen. The editor is two
// workspaces in one — a component canvas and an uploaded HTML page — so a step
// about a panel the current one does not have is simply not part of the tour.
export function usableSteps(steps, find) {
  return (steps || []).filter((step) => !step.target || !!find(step.target))
}
