// Where the brand and the link group sit inside a horizontal navbar.
//
// ONE source of truth, because this bar is drawn three times — by the React
// renderer (edit canvas + preview), by the exported stylesheet, and by the
// responsive-HTML writer. Every time this kind of rule was written out three
// times it drifted, and the editor ended up promising something the published
// page did not do. These functions return plain style objects; the React
// renderer spreads them and the two exporters serialize them.

const ALIGNMENTS = new Set(['left', 'center', 'right'])

function align(value, fallback) {
  return ALIGNMENTS.has(value) ? value : fallback
}

export function navbarBrandAlign(props) {
  return align(props?.brandAlign, 'left')
}

export function navbarLinksAlign(props) {
  return align(props?.linksAlign, 'right')
}

// Space between the individual links. 0 is a real choice, so only fall back
// when the value is missing or not a number.
export function navbarLinkGap(props, fallback = 20) {
  const n = Number(props?.linkGap)
  return Number.isFinite(n) && n >= 0 ? Math.min(120, Math.round(n)) : fallback
}

// A nav link is a single-line label, so runs of whitespace collapse to one space
// and the ends are trimmed. This is what a browser does to inline text anyway —
// the editor was overriding it with white-space:pre-wrap, so labels carrying
// accidental leading spaces (from an import or the AI wizard, e.g. "      Home")
// showed the padding on the canvas while the published page, drawn as plain
// HTML, collapsed it. The bar looked unevenly spaced in Edit and even in View.
export function navLinkLabel(label) {
  return String(label ?? '').replace(/\s+/g, ' ').trim()
}

// True centring, not "centred in whatever space is left over". An item asked to
// sit in the middle is taken out of the flow and pinned to the bar's centre, so
// a centred logo is centred against the BAR — half a brand-width off is exactly
// the kind of near-miss that makes the control feel broken.
const CENTERED = { position: 'absolute', left: '50%', transform: 'translateX(-50%)' }

// Placement for the row and its two items, for a HORIZONTAL bar on a wide
// screen. The stacked layouts (vertical / centered / two-row) and the phone
// hamburger have their own arrangement and pass through untouched.
export function navbarPlacement(props) {
  const brand = navbarBrandAlign(props)
  const links = navbarLinksAlign(props)

  // Both in the middle: pinning both to 50% would stack them on top of each
  // other, so centre the row instead and let them sit side by side.
  if (brand === 'center' && links === 'center') {
    return { row: { justifyContent: 'center' }, brand: {}, links: {} }
  }

  const out = {
    row: { justifyContent: 'flex-start' },
    brand: brand === 'center' ? { ...CENTERED } : {},
    links: links === 'center' ? { ...CENTERED } : {},
  }

  // Visual order: anything parked left comes before anything parked right, even
  // when the DOM lists the brand first.
  if (brand !== 'center') out.brand.order = brand === 'right' ? 1 : 0
  if (links !== 'center') out.links.order = links === 'right' ? 1 : 0

  // One auto margin does all the pushing: it swallows the free space, sending
  // everything after it to the far edge. Items parked left need nothing —
  // flex-start already packs them at the start.
  const flow = [
    ['brand', brand],
    ['links', links],
  ].filter(([, value]) => value !== 'center')
  flow.sort((a, b) => (a[1] === 'right' ? 1 : 0) - (b[1] === 'right' ? 1 : 0))
  const firstRight = flow.find(([, value]) => value === 'right')
  if (firstRight) out[firstRight[0]].marginLeft = 'auto'

  return out
}
