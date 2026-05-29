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
