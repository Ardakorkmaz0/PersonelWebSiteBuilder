const FLOW_GAP = 20
const FLOW_MOBILE_GAP = 16
const FLOW_SIDE_PAD = 24
const FLOW_MOBILE_SIDE_PAD = 16
const FLOW_FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'divider'])
const FLOW_FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])
const FLOW_MOBILE_BLOCK_TYPES = new Set([
  'navbar', 'heading', 'text', 'image', 'section', 'card', 'divider',
  'list', 'quote', 'input', 'container', 'tabs', 'select', 'alert', 'accordion',
  'html',
])
const FLOW_MAX_HEIGHT = {
  navbar: 88,
  heading: 120,
  text: 180,
  button: 64,
  linkbutton: 56,
  card: 240,
  section: 220,
}

export function layoutFor(component, viewport) {
  if (viewport === 'mobile') return component.mobileLayout || component.layout
  return component.layout
}

export function isHidden(component, viewport) {
  return viewport === 'mobile' ? !!component.hiddenMobile : !!component.hidden
}

export function canvasHeight(components, viewport = 'pc') {
  const list = Array.isArray(components) ? components : []
  const bottom = list.reduce((max, c) => {
    if (isHidden(c, viewport)) return max
    const l = layoutFor(c, viewport) || {}
    return Math.max(max, (l.y || 0) + (l.h || 0))
  }, 0)
  return Math.max(viewport === 'mobile' ? 400 : 600, bottom + 40)
}

export function absoluteChildrenHeight(components, minHeight = 120) {
  const list = Array.isArray(components) ? components : []
  const bottom = list.reduce((max, c) => {
    const l = c.layout || {}
    return Math.max(max, (l.y || 0) + (l.h || 0))
  }, 0)
  return Math.max(minHeight, bottom + 16)
}

export function isFlowFullWidth(component) {
  return FLOW_FULL_WIDTH_TYPES.has(component?.type)
}

export function flowGap(viewport = 'pc') {
  return viewport === 'mobile' ? FLOW_MOBILE_GAP : FLOW_GAP
}

export function flowSidePad(viewport = 'pc') {
  return viewport === 'mobile' ? FLOW_MOBILE_SIDE_PAD : FLOW_SIDE_PAD
}

const FLOW_INLINE_TYPES = new Set(['button', 'linkbutton', 'badge', 'icon'])
// Components whose children live inside an absolute mini-canvas at PC design
// pixels — these MUST keep their layout.w as the rendered width on PC (no
// flex-grow stretching), so the inner mini-canvas matches the visible box and
// the editor's mobile auto-scale has a sane reference.
const FLOW_FIXED_DESIGN_WIDTH_TYPES = new Set(['container', 'tabs'])

export function flowItemStyle(component, viewport = 'pc', canvasWidth = 1000, options = {}) {
  // Flow is a single design that adapts to both breakpoints, so the box metrics
  // come from `layout` on PC and mobile alike (editable from either viewport).
  const l = component.layout || {}
  const full = isFlowFullWidth(component)
  const sidePad = flowSidePad(viewport)
  const mobileBlock = viewport === 'mobile' && FLOW_MOBILE_BLOCK_TYPES.has(component?.type)
  const inline = FLOW_INLINE_TYPES.has(component?.type)
  const isImage = component?.type === 'image'
  const boxW = Math.max(8, Math.round(l.w || (full ? canvasWidth : 240)))
  const boxH = flowBoxHeight(component, viewport)
  const parentDirection = options.parentDirection || 'row'

  const fixedDesign = FLOW_FIXED_DESIGN_WIDTH_TYPES.has(component?.type)
  let flex
  let width
  if (full) {
    // Full-bleed bands span the whole row and bleed into the side padding. Use
    // flex-basis auto (0 0 auto) so the explicit calc() width actually applies —
    // a percentage flex-basis would otherwise override it and leave a side gap.
    flex = '0 0 auto'
    width = `calc(100% + ${sidePad * 2}px)`
  } else if (mobileBlock) {
    flex = '0 0 100%'
    width = '100%'
  } else if (fixedDesign) {
    // Container/tabs hold an absolute mini-canvas at PC design pixels. The
    // outer wrapper sticks to `layout.w` so the visible box matches the design
    // (no flex-grow stretching to fill the row). `min()` caps it to 100% so
    // narrow artboards still clip + the inner scale fits.
    flex = '0 0 auto'
    width = `min(${boxW}px, 100%)`
  } else if (inline) {
    // Buttons keep the designed width, but do not grow to fill leftover row
    // space like text/card blocks.
    flex = '0 0 auto'
    width = `min(${boxW}px, 100%)`
  } else {
    // Block items GROW to share/fill their row proportionally to their box width,
    // so no leftover gap is left on the side. Resizing the width changes an item's
    // share of the row; items wrap only once their min-width no longer fits.
    flex = `${boxW} 1 0`
    width = 'auto'
  }

  const style = {
    position: 'relative',
    width,
    minWidth: full || mobileBlock || inline ? undefined : Math.min(boxW, 160),
    // Full-bleed bands must keep their calc(100% + padding) width; only cap the
    // others so a long inline item can't overflow the row.
    maxWidth: full ? undefined : '100%',
    // Images scale by aspect ratio (height follows width) so they stay
    // proportional on every screen instead of a fixed, distorting height.
    minHeight: isImage ? undefined : boxH,
    height: isImage ? 'auto' : FLOW_FIXED_HEIGHT_TYPES.has(component?.type) ? boxH : 'auto',
    aspectRatio: isImage ? `${boxW} / ${Math.max(1, boxH)}` : undefined,
    marginLeft: full ? -sidePad : undefined,
    marginRight: full ? -sidePad : undefined,
    flex,
  }

  if (parentDirection === 'column') {
    return {
      ...style,
      flex: '0 0 auto',
      width: inline || isImage ? `min(${boxW}px, 100%)` : '100%',
      minWidth: 0,
      maxWidth: '100%',
      marginLeft: undefined,
      marginRight: undefined,
    }
  }

  return style
}

function flowBoxHeight(component, viewport = 'pc') {
  const l = component.layout || {}
  const base = Math.max(4, Math.round(l.h || 80))
  if (FLOW_FIXED_HEIGHT_TYPES.has(component?.type)) return base
  if (component?.type === 'navbar' && viewport === 'mobile') {
    return Math.max(88, Math.min(base, 120))
  }
  const max = FLOW_MAX_HEIGHT[component?.type]
  return max ? Math.min(base, max) : base
}

export function flowCanvasHeight(components, viewport = 'pc', canvasWidth = 1000) {
  const list = Array.isArray(components) ? components.filter((c) => !isHidden(c, viewport)) : []
  // Empty canvas: a modest drop target (not a big blank band).
  if (!list.length) return viewport === 'mobile' ? 320 : 360
  const gap = flowGap(viewport)
  const sidePad = flowSidePad(viewport)
  const available = Math.max(1, canvasWidth - sidePad * 2)
  let total = 0
  let rowW = 0
  let rowH = 0

  const flush = () => {
    if (!rowH) return
    total += (total ? gap : 0) + rowH
    rowW = 0
    rowH = 0
  }

  for (const c of list) {
    const l = c.layout || {}
    const full = isFlowFullWidth(c)
    const mobileBlock = viewport === 'mobile' && FLOW_MOBILE_BLOCK_TYPES.has(c.type)
    const w = full ? canvasWidth : mobileBlock
      ? available
      : Math.min(Math.max(8, Math.round(l.w || 240)), Math.max(8, available))
    const h = flowBoxHeight(c, viewport)
    if (full || mobileBlock) {
      flush()
      rowW = available
      rowH = h
      flush()
      continue
    }
    if (rowW && rowW + gap + w > available) flush()
    rowW = rowW ? rowW + gap + w : w
    rowH = Math.max(rowH, h)
  }
  flush()
  // Fit the content height (+ a little breathing room to drop the next block)
  // instead of forcing a tall fixed minimum that looks empty.
  return total + (viewport === 'mobile' ? 24 : 32)
}
