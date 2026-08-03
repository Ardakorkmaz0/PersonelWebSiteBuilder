// The spotlight: one element, alone, large, with the page's own CSS.
//
// Editing in HTML mode happens on a stage fitted down to a fraction of its
// size, through a narrow side panel — you are adjusting letter spacing on
// something 40 pixels tall. The spotlight lifts the selected element out of the
// page and shows it on its own at a real size, so the controls have something
// to act on that you can actually see.
//
// The preview must be the TRUTH, not an approximation: the page's stylesheets,
// fonts and its responsive-override rule all come along, because an element
// styled by `.nav-link` looks like nothing without them. What is left behind is
// the editor's own chrome — selection outlines, hover markers, drop lines —
// which belongs to the workspace and not to the design.

// Editor chrome that must never appear in the spotlight.
const CHROME_STYLE_SELECTOR = 'style[data-pwb-chrome], style[data-pwb-edit-chrome]'
const CHROME_ATTRS = [
  'data-pwb-hover',
  'data-pwb-flash',
  'data-pwb-selected',
  'data-pwb-linksrc',
  'data-pwb-thin-hover',
  'data-pwb-drag',
  'draggable',
]
const CHROME_NODE_SELECTOR = '[data-pwb-resize-overlay], [data-pwb-dropline], svg[data-pwb-chrome], [data-pwb-selection-toolbar]'

// The element as the visitor would see it: no editor markers anywhere inside.
export function cleanElementHtml(el) {
  if (!el || el.nodeType !== 1) return ''
  const clone = el.cloneNode(true)
  clone.querySelectorAll(CHROME_NODE_SELECTOR).forEach((node) => node.remove())
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    CHROME_ATTRS.forEach((attr) => node.removeAttribute(attr))
    // contenteditable is how the workspace lets you type into the page; the
    // spotlight preview is not the place to keep typing.
    node.removeAttribute('contenteditable')
  }
  return clone.outerHTML
}

// Everything from the page's <head> that decides how the element looks. The
// responsive-override rule is deliberately included — previewing at phone width
// is only honest if the phone-only values apply.
export function pageStyleHead(doc) {
  const head = doc?.head
  if (!head) return ''
  return [...head.querySelectorAll('style, link[rel="stylesheet"], link[rel="preconnect"]')]
    .filter((node) => !node.matches(CHROME_STYLE_SELECTOR))
    .map((node) => node.outerHTML)
    .join('\n')
}

// A standalone document showing one element, centred, on a neutral surface.
// `width` is the viewport the element is measured against, so switching it
// between a desktop and a phone width is what makes the media queries fire.
export function elementSpotlightDocument(doc, el, { width = 960, background = '' } = {}) {
  const styles = pageStyleHead(doc)
  const bodyBackground = background || readPageBackground(doc)
  return `<!DOCTYPE html>
<html lang="${doc?.documentElement?.getAttribute('lang') || 'en'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${styles}
<style>
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    background: ${bodyBackground};
  }
  /* The element keeps its own width; the wrapper only centres it. A block that
     fills the page still fills this one, which is the point. */
  body > * { max-width: 100%; }
</style>
</head>
<body style="width:${Math.max(240, Math.round(Number(width) || 960))}px;">
${cleanElementHtml(el)}
</body>
</html>`
}

// The page's own background, so a light element is not previewed on a dark
// surface (or the reverse) and judged wrongly.
function readPageBackground(doc) {
  try {
    const view = doc?.defaultView
    if (!view || !doc.body) return '#ffffff'
    const value = view.getComputedStyle(doc.body).backgroundColor
    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return '#ffffff'
    return value
  } catch {
    return '#ffffff'
  }
}
