// The edit canvas's selection chrome — frame, resize handles, their hit zones,
// the hover ring and the little corner badges — as ONE system.
//
// All of it is drawn inside the artboard, and the artboard is scaled: by the
// fit-to-area factor, by the zoom the user picked, and again inside a container
// or tabs mini-canvas that is fitted to a narrow phone. A "2px" frame written
// in design pixels therefore painted at 0.7px on a large desktop artboard, 2px
// on a phone preset and 8px at 400% zoom, and a 10px handle became a 40px blob
// or a 2.5px dot nobody could grab. Every length here is authored in SCREEN
// pixels and divided by the scale the item is actually painted at, so the same
// selection looks the same on every preset, at every zoom, at any depth.
//
// The three item renderers (free, flow and nested) used to carry their own
// copies of these numbers and three different mechanisms (bordered div,
// outline with +1 offset, outline with -2 offset, inset hover shadow). They now
// all draw through these helpers (and SelectionFrame / ResizeAffordances in
// ChromeAffordances.jsx), so a frame lands in the same place relative to the
// element whichever renderer owns it.

export const CHROME_ACCENT = '#4f46e5'
const CHROME_HOVER = '#a6b7d6'

// Physical sizes, in screen pixels.
const SCREEN_FRAME = 2
const SCREEN_LINK_FRAME = 3
// A 10px face with a 1px white rim on each side, centred on the element edge.
const SCREEN_HANDLE = 12
const SCREEN_EDGE_HIT = 14
const SCREEN_HAIRLINE = 1

/** The scale an item is painted at; anything unusable reads as 1:1. */
export function chromeScale(value) {
  const scale = Number(value)
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/** Every chrome length for an item painted at `scale`, in that item's own
 * (design) pixels — i.e. already divided by the scale. */
export function chromeMetrics(scale = 1) {
  const s = chromeScale(scale)
  const px = (screen) => screen / s
  return {
    scale: s,
    frame: px(SCREEN_FRAME),
    linkFrame: px(SCREEN_LINK_FRAME),
    // The frame sits OUTSIDE the element, its inner edge on the element's edge.
    outset: px(SCREEN_FRAME),
    handle: px(SCREEN_HANDLE),
    handleOffset: px(SCREEN_HANDLE / 2),
    edgeHit: px(SCREEN_EDGE_HIT),
    edgeHitOffset: px(SCREEN_EDGE_HIT / 2),
    hairline: px(SCREEN_HAIRLINE),
  }
}

// How far outside the box a piece of chrome may reach. Against the edge of the
// artboard (or of the parent a nested item lives in) it would be clipped, so on
// that side it is pulled back inside instead.
export function edgeOutsets(rect, amount) {
  const maxW = rect.maxW || 0
  const maxH = rect.maxH || 0
  return {
    top: rect.y <= amount ? 0 : -amount,
    left: rect.x <= amount ? 0 : -amount,
    right: maxW && rect.x + rect.w >= maxW - amount ? 0 : -amount,
    bottom: maxH && rect.y + rect.h >= maxH - amount ? 0 : -amount,
  }
}

export function frameOutsets(rect, metrics) {
  return edgeOutsets(rect, metrics.outset)
}

// [direction, absolute-position style, cursor]
export function resizeHandles(rect, metrics) {
  const edge = edgeOutsets(rect, metrics.handleOffset)
  const half = metrics.handleOffset
  return [
    ['nw', { top: edge.top, left: edge.left }, 'nwse-resize'],
    ['n', { top: edge.top, left: '50%', marginLeft: -half }, 'ns-resize'],
    ['ne', { top: edge.top, right: edge.right }, 'nesw-resize'],
    ['e', { top: '50%', right: edge.right, marginTop: -half }, 'ew-resize'],
    ['se', { bottom: edge.bottom, right: edge.right }, 'nwse-resize'],
    ['s', { bottom: edge.bottom, left: '50%', marginLeft: -half }, 'ns-resize'],
    ['sw', { bottom: edge.bottom, left: edge.left }, 'nesw-resize'],
    ['w', { top: '50%', left: edge.left, marginTop: -half }, 'ew-resize'],
  ]
}

export function resizeEdgeHitZones(rect, metrics) {
  const edge = edgeOutsets(rect, metrics.edgeHitOffset)
  const size = metrics.edgeHit
  return [
    ['n', { top: edge.top, left: 0, right: 0, height: size }, 'ns-resize'],
    ['e', { top: 0, right: edge.right, bottom: 0, width: size }, 'ew-resize'],
    ['s', { bottom: edge.bottom, left: 0, right: 0, height: size }, 'ns-resize'],
    ['w', { top: 0, left: edge.left, bottom: 0, width: size }, 'ew-resize'],
  ]
}

// Hover ring for an unselected item: on the same side of the edge as the
// selection frame (outside), at the same physical weight. Where the frame would
// be pulled inside (against a clipping edge) the ring goes inside too.
export const HOVER_RING_CLASS = 'pwb-chrome-hover'

export function hoverRingStyle(metrics, outsets) {
  const inside = outsets && (!outsets.top || !outsets.right || !outsets.bottom || !outsets.left)
  return {
    '--pwb-chrome-hover-shadow': `${inside ? 'inset ' : ''}0 0 0 ${metrics.hairline}px ${CHROME_HOVER}`,
  }
}

// A small label pinned to a corner of the item ("Hidden on PC", "Pinned") that
// keeps its physical size instead of growing with the zoom.
export function chromeBadgeStyle(metrics, corner = 'top-left') {
  const [vertical, horizontal] = corner.split('-')
  const inset = 2 * metrics.hairline
  return {
    position: 'absolute',
    [vertical]: inset,
    [horizontal]: inset,
    zIndex: 25,
    transform: metrics.scale === 1 ? undefined : `scale(${1 / metrics.scale})`,
    transformOrigin: `${vertical} ${horizontal}`,
    whiteSpace: 'nowrap',
  }
}
