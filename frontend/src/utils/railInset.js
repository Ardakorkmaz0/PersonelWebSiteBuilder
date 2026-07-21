// A fixed VERTICAL navbar is a full-height side rail pinned to the viewport
// edge. A fixed full-width TOP bar would otherwise run underneath it, and
// because the bar centres its inner row on contentWidth, its brand text drifts
// with the browser width — visible on a wide screen, swallowed by the rail on a
// narrow one. Insetting the bar by the rail's width is what every dashboard
// layout does, and it makes the bar render identically at every size (and so
// identically in Edit and View).
export function fixedRailInset(components) {
  let left = 0
  let right = 0
  for (const c of components || []) {
    if (
      c?.type !== 'navbar' ||
      c.props?.navLayout !== 'vertical' ||
      c.props?.scrollBehavior !== 'fixed'
    ) continue
    const width = Math.round(Number(c.layout?.w) || 0)
    if (width <= 0) continue
    if (c.props?.pinX === 'right') right = Math.max(right, width)
    else left = Math.max(left, width)
  }
  return { left, right }
}
