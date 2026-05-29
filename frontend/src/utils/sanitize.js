// Client-side mirror of the backend sanitizer (builder/validators.py).
// The editor renders the in-memory schema live (before save), so it must apply
// the same safety rules the backend enforces on save.

export const ALLOWED_STYLE_KEYS = new Set([
  'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight',
  'fontFamily', 'fontStyle', 'textAlign', 'textDecoration', 'textTransform',
  'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius', 'border',
  'borderColor', 'borderWidth', 'borderStyle', 'width', 'maxWidth', 'minHeight',
  'height', 'boxShadow', 'display', 'gap', 'objectFit', 'opacity',
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
