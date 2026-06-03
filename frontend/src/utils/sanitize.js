// Client-side mirror of the backend sanitizer (builder/validators.py).
// The editor renders the in-memory schema live (before save), so it must apply
// the same safety rules the backend enforces on save.

export const ALLOWED_STYLE_KEYS = new Set([
  'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight',
  'fontFamily', 'fontStyle', 'textAlign', 'textDecoration', 'textTransform',
  'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius', 'border',
  'borderColor', 'borderWidth', 'borderStyle', 'width', 'maxWidth', 'minHeight',
  'height', 'boxShadow', 'display', 'gap', 'objectFit', 'opacity',
  'transform', 'filter', 'backdropFilter', 'textShadow', 'aspectRatio',
  'objectPosition', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
  'cursor', 'overflow',
])

const BLOCKED_SCHEMES = ['javascript:', 'vbscript:', 'data:', 'file:']

export function sanitizeUrl(value) {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  if (!v) return ''
  if (v.startsWith('#') || v.startsWith('/')) return v
  const low = v.toLowerCase()
  if (BLOCKED_SCHEMES.some((b) => low.startsWith(b))) return ''
  if (/^(https?:|mailto:|tel:)/.test(low)) return v
  return low.includes('://') ? '' : v
}

// Inline image data URLs are safe in an <img src> (image bytes can't run scripts,
// even SVG in secure static mode), so allow data:image/*;base64 for image sources
// only — never for links. Mirrors backend sanitize_image_src.
const DATA_IMAGE_RE =
  /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/\r\n=]+$/i
const MAX_DATA_IMAGE = 5 * 1024 * 1024

export function sanitizeImageSrc(value) {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  if (!v) return ''
  if (v.slice(0, 11).toLowerCase() === 'data:image/') {
    return v.length <= MAX_DATA_IMAGE && DATA_IMAGE_RE.test(v) ? v : ''
  }
  return sanitizeUrl(v)
}

export function sanitizeStyles(styles) {
  if (!styles || typeof styles !== 'object') return {}
  const out = {}
  for (const [key, val] of Object.entries(styles)) {
    if (!ALLOWED_STYLE_KEYS.has(key)) continue
    if (typeof val !== 'string' && typeof val !== 'number') continue
    const s = String(val)
    const low = s.toLowerCase()
    if (low.includes('javascript:') || low.includes('expression(') || low.includes('url(')) continue
    out[key] = s
  }
  return out
}
