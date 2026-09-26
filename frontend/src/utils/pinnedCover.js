// What a pinned bar hides before the visitor has scrolled anything.
//
// A FIXED bar leaves the page's flow and sits on the viewport edge, so
// whatever was drawn under that strip is invisible the moment the page opens.
// On a page laid out in flow you would pad the top and be done; on an
// absolutely positioned page there is nothing to pad — the component simply
// keeps its coordinates and disappears behind the bar.
//
// Sticky is not this. At rest a sticky bar stays where it was drawn (on an
// absolute page the export even keeps position:absolute until scroll). Content
// passing under a bar WHILE SCROLLING is also not this: that is what a
// pinned header is for, and flagging it would be noise.

function isHiddenOnViewport(component, layoutKey) {
  return layoutKey === 'mobileLayout' ? !!component?.hiddenMobile : !!component?.hidden
}

function rectOf(component, layoutKey = 'layout') {
  const l = component?.[layoutKey] || component?.layout || {}
  const x = Number(l.x) || 0
  const y = Number(l.y) || 0
  const w = Number(l.w) || 0
  const h = Number(l.h) || 0
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

// Where a fixed top bar actually lands: its offset from the viewport edge,
// not the Y it was drawn at.
function restingBarRect(bar, layoutKey) {
  const r = rectOf(bar, layoutKey)
  if (!r) return null
  const props = bar.props || {}
  if (props.scrollBehavior !== 'fixed') return null
  if (props.pinY === 'bottom') return null // a bottom bar hides the END of the page, not the start
  const top = Number(props.pinOffsetY) || 0
  return { ...r, y: top }
}

// The first top-pinned fixed bar on the page, or null.
export function pinnedTopBar(components = [], layoutKey = 'layout') {
  for (const c of components) {
    if (isHiddenOnViewport(c, layoutKey)) continue
    if (restingBarRect(c, layoutKey)) return c
  }
  return null
}

// Is this component hidden behind the pinned bar when the page opens?
// Returns the overlap in pixels — 0 when it is clear.
// Nested components use parent-relative coordinates, so they cannot be
// compared against a page-level bar; those are skipped.
export function hiddenByPinnedBar(component, components = [], layoutKey = 'layout') {
  if (!component || isHiddenOnViewport(component, layoutKey)) return 0
  if (!components.some((c) => c?.id === component.id)) return 0
  const bar = pinnedTopBar(components, layoutKey)
  if (!bar || bar.id === component.id) return 0
  const b = restingBarRect(bar, layoutKey)
  const c = rectOf(component, layoutKey)
  if (!b || !c) return 0
  // Horizontal miss means no cover at all, however the vertical bands line up.
  if (c.x >= b.x + b.w || b.x >= c.x + c.w) return 0
  return Math.max(0, Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y))
}
