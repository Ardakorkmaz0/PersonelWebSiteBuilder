// Recolor the inline styles inside a self-contained HTML snippet (what the
// unified palette drops as an `html` component). The Brush tool used to only
// tint the embed WRAPPER's background/border — invisible, because the snippet
// carries its own inline colors and the iframe sits on top with a transparent
// background. These helpers rewrite the colors INSIDE `props.code` so a brush
// stroke actually recolors the button / navbar / card you clicked.
//
// All operations work on inline `style="…"` declarations via regex. The
// snippets are small and inline-styled by construction, so this stays robust
// without a full CSS parser; values that shouldn't be touched (transparent,
// inherit, gradients-as-text via background-clip) are left alone.

const SKIP_VALUES = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'none',
  '',
])

function isSkippable(value) {
  return SKIP_VALUES.has(String(value).trim().toLowerCase())
}

// A single CSS color token: hex (3/4/6/8), rgb()/rgba(), hsl()/hsla().
const COLOR_TOKEN_SRC =
  '#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})|rgba?\\([^)]*\\)|hsla?\\([^)]*\\)'

function replaceColorTokens(value, color) {
  return value.replace(new RegExp(COLOR_TOKEN_SRC, 'gi'), color)
}

function hasColorToken(value) {
  return new RegExp(COLOR_TOKEN_SRC, 'i').test(value)
}

// Property declaration matcher. The leading `(?:^|[;{"'\s])` makes sure we match
// the WHOLE property name — so `color` never matches inside `background-color`,
// and `background` never matches inside `background-clip` (its next char is `-`,
// not `:`). The captured `head` (incl. that leading char) is re-emitted as-is.
function declRegex(propPattern) {
  return new RegExp(`((?:^|[;{"'\\s])${propPattern}\\s*:\\s*)([^;"'}]+)`, 'gi')
}

const BG_PROP = 'background(?:-color)?'
const TEXT_PROP = 'color'
const BORDER_PROP = 'border(?:-(?:top|right|bottom|left))?(?:-color)?'

export function hasVisibleBackground(html) {
  const re = declRegex(BG_PROP)
  let m
  while ((m = re.exec(html))) {
    if (!isSkippable(m[2])) return true
  }
  return false
}

// Add a `background` to the outermost element when the snippet has no visible
// background of its own (e.g. brushing "fill" onto a plain heading or an
// outline button) so the brush always does something.
function injectRootBackground(html, color) {
  const withStyle = /<([a-zA-Z][\w-]*)\b([^>]*?)\sstyle\s*=\s*"([^"]*)"/
  if (withStyle.test(html)) {
    return html.replace(withStyle, (_m, tag, attrs, style) => {
      const trimmed = style.trim()
      const sep = trimmed === '' || trimmed.endsWith(';') ? '' : ';'
      return `<${tag}${attrs} style="${style}${sep}background:${color}"`
    })
  }
  const firstTag = /<([a-zA-Z][\w-]*)\b([^>]*)>/
  if (firstTag.test(html)) {
    return html.replace(
      firstTag,
      (_m, tag, attrs) => `<${tag}${attrs} style="background:${color}">`,
    )
  }
  return html
}

function recolorBackground(html, color) {
  let changed = false
  const out = html.replace(declRegex(BG_PROP), (m, head, value) => {
    if (isSkippable(value)) return m
    changed = true
    return `${head}${color}`
  })
  return changed ? out : injectRootBackground(out, color)
}

function recolorText(html, color) {
  return html.replace(declRegex(TEXT_PROP), (m, head, value) =>
    isSkippable(value) ? m : `${head}${color}`,
  )
}

function recolorBorder(html, color) {
  return html.replace(declRegex(BORDER_PROP), (m, head, value) => {
    if (isSkippable(value)) return m
    // Replace the color token(s) inside the shorthand (keep width/style); if the
    // shorthand has no explicit color (uses currentColor), append the new one.
    if (hasColorToken(value)) return `${head}${replaceColorTokens(value, color)}`
    return `${head}${value.trim()} ${color}`
  })
}

// Brush for a SINGLE live element (HTML-upload mode): instead of rewriting a
// snippet string, return an `applyElementPatch` patch for the clicked element.
// `info` is a describeElement() snapshot (reads `background`/`borderWidth`).
// `smart` paints the fill when the element has a visible background, else text.
export function brushElementPatch(info, color, target = 'smart') {
  let mode = target
  if (mode === 'smart') mode = info?.background ? 'fill' : 'text'
  if (mode === 'fill') return { background: color }
  if (mode === 'text') return { color }
  if (mode === 'border') {
    const width = Number(info?.borderWidth)
    return { borderColor: color, borderWidth: width > 0 ? width : 2 }
  }
  return {}
}

// Recolor `code` for a brush target. `smart` picks fill when the snippet has a
// visible background (buttons, navbars, cards), otherwise text (headings, body).
export function recolorHtml(code, color, target = 'smart') {
  if (typeof code !== 'string' || !code) return code
  const safeColor = typeof color === 'string' && color.trim() ? color.trim() : '#4f46e5'
  let mode = target
  if (mode === 'smart') mode = hasVisibleBackground(code) ? 'fill' : 'text'
  if (mode === 'fill') return recolorBackground(code, safeColor)
  if (mode === 'text') return recolorText(code, safeColor)
  if (mode === 'border') return recolorBorder(code, safeColor)
  return code
}
