// Where a line actually sits inside a text field, in pixels.
//
// Source views SOFT WRAP, so a long line takes several visual rows and
// "line N starts at (N-1) × line-height" is wrong by however many rows wrapped
// above it — which is how a highlight ended up pointing at the wrong code.
//
// The browser is the only thing that knows where the rows broke, so we ask it:
// a hidden div that copies every property affecting wrapping is filled with the
// text above the line (and then with the line too) and measured.

const COPIED = [
  'boxSizing', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontVariant',
  'letterSpacing', 'lineHeight', 'paddingLeft', 'paddingRight', 'textIndent',
  'textTransform', 'wordSpacing', 'wordBreak', 'overflowWrap', 'whiteSpace', 'tabSize',
]

// A zero-width space, so a measurement that ends on an empty line still gets a
// row to measure.
const MARKER = '​'

function mirrorFor(element, styles) {
  const mirror = document.createElement('div')
  for (const property of COPIED) mirror.style[property] = styles[property]
  if (styles.whiteSpace === 'nowrap' || styles.whiteSpace === 'pre') mirror.style.whiteSpace = 'pre'
  else mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.position = 'absolute'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.height = 'auto'
  mirror.style.paddingTop = '0'
  mirror.style.paddingBottom = '0'
  mirror.style.width = `${element.clientWidth}px`
  mirror.style.overflowWrap = styles.overflowWrap === 'normal' ? 'break-word' : styles.overflowWrap
  return mirror
}

// Returns { top, height } for `count` lines starting at 1-based `line`, in the
// field's own content coordinates (scrolling is the caller's business), or null
// when it cannot be worked out.
export function lineBoxIn(element, text, line, count = 1) {
  if (!element || !line || typeof document === 'undefined') return null
  const value = String(text ?? '')
  const lines = value.split('\n')
  if (line < 1 || line > lines.length) return null

  const styles = window.getComputedStyle(element)
  const mirror = mirrorFor(element, styles)
  document.body.append(mirror)
  try {
    const above = lines.slice(0, line - 1)
    mirror.textContent = above.length ? `${above.join('\n')}\n${MARKER}` : MARKER
    const throughFirstRow = mirror.scrollHeight
    mirror.textContent = MARKER
    const oneRow = mirror.scrollHeight
    const top = Math.max(0, throughFirstRow - oneRow)

    const region = lines.slice(line - 1, line - 1 + Math.max(1, count))
    mirror.textContent = `${[...above, ...region].join('\n')}${MARKER}`
    const throughRegion = mirror.scrollHeight
    const height = Math.max(oneRow, throughRegion - oneRow - top)

    const paddingTop = Number.parseFloat(styles.paddingTop) || 0
    return { top: top + paddingTop, height }
  } catch {
    return null
  } finally {
    mirror.remove()
  }
}
