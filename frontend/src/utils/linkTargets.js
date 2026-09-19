// In-page link targets for the component canvas.
//
// A "section on this page" link is `#<element id>`, and on the canvas an
// element's id is its component id — `region_x7k2ab`, not `about`. The link
// field used to be a bare text box, so the only ids anyone typed were the
// readable ones (`#about`, `#contact`, which is also what a new navbar ships
// with), and none of them existed: the link scrolled nowhere on the published
// site and nothing in the editor said so. These helpers list the real targets
// so the field can offer them by name, and tell a dead id from a live one.

function firstLine(value) {
  return String(value ?? '').split(/\r?\n/)[0].trim()
}

// The words a person would recognise a block by.
export function componentTextHint(component) {
  const p = component?.props || {}
  const hint = firstLine(p.heading) || firstLine(p.title) || firstLine(p.text)
    || firstLine(p.label) || firstLine(p.brand) || firstLine(p.alt)
  return hint.length > 40 ? `${hint.slice(0, 39)}…` : hint
}

// Every component on the page, in reading order (top to bottom, then left to
// right), nested ones right after their parent. The component being edited is
// left out — a link to itself is not a destination.
function readingOrder(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const la = a?.layout || {}
    const lb = b?.layout || {}
    return (la.y || 0) - (lb.y || 0) || (la.x || 0) - (lb.x || 0)
  })
}

// A band (section, container) has no words of its own; it is recognised by
// what is in it — the first text inside, in reading order.
function innerTextHint(component) {
  for (const kid of readingOrder(component?.children)) {
    const hint = componentTextHint(kid) || innerTextHint(kid)
    if (hint) return hint
  }
  return ''
}

export function linkSectionsFor(components, { excludeId = null } = {}) {
  const out = []
  const walk = (list, depth) => {
    for (const c of readingOrder(list)) {
      if (!c?.id) continue
      if (c.id !== excludeId) {
        out.push({ id: c.id, type: c.type, text: componentTextHint(c) || innerTextHint(c), depth })
      }
      if (Array.isArray(c.children) && c.children.length) walk(c.children, depth + 1)
    }
  }
  walk(components, 0)
  return out
}

// Is `href` an in-page anchor that points at nothing on this page?
export function isDeadSectionLink(href, sections) {
  if (typeof href !== 'string' || !href.startsWith('#')) return false
  const id = href.slice(1)
  if (!id || id === 'top') return false
  return !(sections || []).some((s) => s.id === id)
}
