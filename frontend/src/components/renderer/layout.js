const FLOW_GAP = 20
const FLOW_MOBILE_GAP = 16
const FLOW_SIDE_PAD = 24
const FLOW_MOBILE_SIDE_PAD = 16
const FLOW_FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'divider'])
const FLOW_FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])
const FLOW_MOBILE_BLOCK_TYPES = new Set(['navbar', 'heading', 'text', 'image', 'section', 'card', 'divider'])
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

export function isFlowFullWidth(component) {
  return FLOW_FULL_WIDTH_TYPES.has(component?.type)
}

export function flowGap(viewport = 'pc') {
  return viewport === 'mobile' ? FLOW_MOBILE_GAP : FLOW_GAP
}

export function flowSidePad(viewport = 'pc') {
  return viewport === 'mobile' ? FLOW_MOBILE_SIDE_PAD : FLOW_SIDE_PAD
}

export function flowItemStyle(component, viewport = 'pc', canvasWidth = 1000) {
  const l = layoutFor(component, viewport) || {}
  const full = isFlowFullWidth(component)
  const sidePad = flowSidePad(viewport)
  const mobileBlock = viewport === 'mobile' && FLOW_MOBILE_BLOCK_TYPES.has(component?.type)
  const boxW = Math.max(8, Math.round(l.w || (full ? canvasWidth : 240)))
  const boxH = flowBoxHeight(component, viewport)
  const width = full
    ? `calc(100% + ${sidePad * 2}px)`
    : mobileBlock
      ? '100%'
      : `min(${boxW}px, 100%)`
  return {
    position: 'relative',
    width,
    minHeight: boxH,
    height: FLOW_FIXED_HEIGHT_TYPES.has(component?.type) ? boxH : 'auto',
    marginLeft: full ? -sidePad : undefined,
    marginRight: full ? -sidePad : undefined,
    flex: full || mobileBlock
      ? '0 0 100%'
      : `0 1 min(${boxW}px, 100%)`,
  }
}

function flowBoxHeight(component, viewport = 'pc') {
  const l = layoutFor(component, viewport) || {}
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
  if (!list.length) return viewport === 'mobile' ? 400 : 600
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
    const l = layoutFor(c, viewport) || {}
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
  return Math.max(viewport === 'mobile' ? 400 : 600, total)
}
