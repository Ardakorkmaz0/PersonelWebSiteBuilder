import { htmlBaseSizeFromComponent } from '../../utils/htmlSnippetSizing.js'

const MIN_BOX_SCALE = 0.6
const MAX_BOX_SCALE = 3
const SCALE_EPSILON = 0.02

const SCALED_STYLE_KEYS = new Set([
  'fontSize',
  'padding',
  'margin',
  'borderRadius',
  'borderWidth',
  'letterSpacing',
  'gap',
])

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export function scaleNumber(value, scale = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  if (Math.abs(scale - 1) < SCALE_EPSILON) return Math.round(n)
  return Math.round(n * scale)
}

export function scaleCssValue(value, scale = 1) {
  if (value == null || value === '') return value
  if (Math.abs(scale - 1) < SCALE_EPSILON) return value
  if (typeof value === 'number') return scaleNumber(value, scale)
  const text = String(value)
  return text.replace(/(-?\d*\.?\d+)px\b/g, (_, raw) => `${scaleNumber(raw, scale)}px`)
}

export function scaledPx(value, scale = 1) {
  return `${scaleNumber(value, scale)}px`
}

export function scaleBoxStyles(styles = {}, scale = 1) {
  if (Math.abs(scale - 1) < SCALE_EPSILON) return styles
  const out = { ...styles }
  for (const key of SCALED_STYLE_KEYS) {
    if (out[key] !== undefined) out[key] = scaleCssValue(out[key], scale)
  }
  return out
}

export function componentBoxScale(component, def, viewport = 'pc', flowMode = false) {
  const current =
    !flowMode && viewport === 'mobile'
      ? component.mobileLayout || component.layout || {}
      : component.layout || {}
  const base =
    component?.type === 'html'
      ? htmlBaseSizeFromComponent(component, def?.defaultSize) || def?.defaultSize || {}
      : def?.defaultSize || {}
  const baseW = Math.max(1, Number(base.w) || Number(current.w) || 1)
  const baseH = Math.max(1, Number(base.h) || Number(current.h) || 1)
  const currentW = Math.max(1, Number(current.w) || baseW)
  const currentH = Math.max(1, Number(current.h) || baseH)
  const areaScale = Math.sqrt((currentW * currentH) / (baseW * baseH))
  return clamp(areaScale, MIN_BOX_SCALE, MAX_BOX_SCALE)
}
