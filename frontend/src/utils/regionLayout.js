const MIN_SIZE = 8

const number = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function regionContentWidth(region, fallback = 980) {
  return Math.max(320, Math.round(number(region?.props?.contentWidth, fallback)))
}

export function resolveRegionDock(child, designWidth) {
  const explicit = child?.props?.dockX
  if (['left', 'center', 'right', 'stretch'].includes(explicit)) return explicit
  const layout = child?.layout || {}
  const center = number(layout.x) + number(layout.w, 200) / 2
  if (center < designWidth * 0.34) return 'left'
  if (center > designWidth * 0.66) return 'right'
  return 'center'
}

// Compute how an attached element should sit inside the currently visible
// safe grid. Desktop uses Wix-Studio-like docking; mobile uses its own layout
// so text and controls stay readable instead of shrinking as a single picture.
export function responsiveRegionChildLayout(child, designWidth, actualWidth, viewport = 'pc') {
  const available = Math.max(MIN_SIZE, Math.round(number(actualWidth, designWidth)))
  const source = viewport === 'mobile'
    ? child?.mobileLayout || child?.layout || {}
    : child?.layout || {}
  let w = Math.max(MIN_SIZE, Math.round(number(source.w, 200)))
  const h = Math.max(4, Math.round(number(source.h, 80)))
  const y = Math.max(0, Math.round(number(source.y)))

  if (viewport === 'mobile') {
    w = Math.min(w, available)
    return {
      x: clamp(Math.round(number(source.x)), 0, Math.max(0, available - w)),
      y,
      w,
      h,
    }
  }

  const designX = Math.max(0, number(source.x))
  const dock = resolveRegionDock(child, designWidth)
  const leftMargin = designX
  const rightMargin = Math.max(0, designWidth - designX - w)
  const centerOffset = designX + w / 2 - designWidth / 2

  if (dock === 'stretch') {
    return {
      x: Math.min(leftMargin, Math.max(0, available - MIN_SIZE)),
      y,
      w: Math.max(MIN_SIZE, available - leftMargin - rightMargin),
      h,
    }
  }

  w = Math.min(w, available)
  let x = leftMargin
  if (dock === 'right') x = available - w - rightMargin
  if (dock === 'center') x = (available - w) / 2 + centerOffset
  return { x: clamp(Math.round(x), 0, Math.max(0, available - w)), y, w, h }
}

// Translate a drag performed on a narrower responsive grid back to the
// desktop design coordinate system so docking margins remain stable.
export function regionDisplayPatchToDesign(child, patch, displayLayout, designWidth, actualWidth, viewport = 'pc') {
  if (viewport === 'mobile') return patch
  if (patch.x === undefined && patch.w === undefined) return patch
  const dock = resolveRegionDock(child, designWidth)
  const available = Math.max(MIN_SIZE, number(actualWidth, designWidth))
  const nextW = Math.max(MIN_SIZE, number(patch.w, displayLayout?.w || child?.layout?.w || 200))
  const displayX = number(patch.x, displayLayout?.x)
  let designX = displayX
  if (dock === 'right') {
    const rightMargin = Math.max(0, available - displayX - nextW)
    designX = designWidth - nextW - rightMargin
  } else if (dock === 'center') {
    const offset = displayX + nextW / 2 - available / 2
    designX = designWidth / 2 + offset - nextW / 2
  }
  return { ...patch, x: Math.max(0, Math.round(designX)) }
}
