// Readable in-page anchors ("section names") for canvas blocks.
//
// A block's element id on the page used to be its component id — region_x7k2ab
// — so an in-page link could only ever read #region_x7k2ab: nothing a person
// would type, share or recognise, and the #about / #contact a new navbar ships
// with pointed at nothing. A block can now carry `props.anchor` ("about"),
// which becomes its element id in every writer (Renderer, schemaToFiles,
// responsiveHtml). Without one, the component id stays the id, exactly as
// before.
//
// Mirrors ANCHOR_RE in backend/builder/validators.py — the save gate drops
// anything else.

export const ANCHOR_RE = /^[a-z0-9](?:[a-z0-9_-]{0,58}[a-z0-9])?$/

const TRANSLIT = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  â: 'a', î: 'i', û: 'u', ä: 'a', ß: 'ss', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', ó: 'o', ò: 'o', ñ: 'n',
}

/** "Hakkımızda & Ekip!" → "hakkimizda-ekip". Empty when nothing usable is left. */
export function slugifyAnchor(text) {
  const lowered = String(text ?? '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr')
  const ascii = Array.from(lowered).map((ch) => TRANSLIT[ch] ?? ch).join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
  const slug = ascii
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 60)
    .replace(/[-_]+$/g, '')
  return slug === 'top' ? '' : slug
}

/** The block's own anchor, if it is a valid one. */
export function anchorOf(component) {
  const anchor = component?.props?.anchor
  return typeof anchor === 'string' && ANCHOR_RE.test(anchor) && anchor !== 'top' ? anchor : ''
}

/** The id the block's element carries on the page: its anchor, else its id. */
export function elementIdFor(component) {
  return anchorOf(component) || component?.id || ''
}

function everyComponent(components, visit) {
  for (const c of Array.isArray(components) ? components : []) {
    if (!c) continue
    visit(c)
    everyComponent(c.children, visit)
  }
}

/** Why `anchor` cannot name block `selfId` on this page — or '' when it can.
 *  'reserved' (#top scrolls up), 'page' (#pageId switches page), 'taken'
 *  (another block on this page already answers to it). */
// Ids the editor's own page already uses. View mode draws the site inside the
// editor document, so a section named "root" would share an id with the app.
const RESERVED = new Set(['top', 'root', 'canvas-scroll', 'free-canvas', 'pwb-google-font'])

export function anchorProblem(anchor, { components = [], pages = [], selfId = null } = {}) {
  if (!anchor) return ''
  if (RESERVED.has(anchor)) return 'reserved'
  if (pages.some((p) => p?.id === anchor)) return 'page'
  let taken = false
  everyComponent(components, (c) => {
    if (c.id === selfId) return
    if (c.id === anchor || anchorOf(c) === anchor) taken = true
  })
  return taken ? 'taken' : ''
}

/** Point every in-page link on these components that targets `#from` at `#to`
 *  instead. Used when a block's element id changes, so renaming a section
 *  never breaks the links that already lead to it. Returns a new array (and
 *  the same one when nothing matched). */
export function retargetLinks(components, from, to) {
  if (!from || !to || from === to) return components
  const old = `#${from}`
  const next = `#${to}`
  let changed = false
  const fix = (href) => {
    if (href !== old) return href
    changed = true
    return next
  }
  // Untouched branches keep their identity, so only the path to a changed link
  // is rebuilt.
  const walk = (list) => {
    let any = false
    const mapped = list.map((c) => {
      if (!c) return c
      const props = c.props || {}
      let patch = null
      if (props.href === old) patch = { ...(patch || {}), href: fix(props.href) }
      if (props.buttonHref === old) patch = { ...(patch || {}), buttonHref: fix(props.buttonHref) }
      if (Array.isArray(props.links) && props.links.some((l) => l?.href === old)) {
        patch = { ...(patch || {}), links: props.links.map((l) => (l?.href === old ? { ...l, href: fix(l.href) } : l)) }
      }
      const kids = Array.isArray(c.children) ? walk(c.children) : c.children
      if (!patch && kids === c.children) return c
      any = true
      return {
        ...c,
        ...(patch ? { props: { ...props, ...patch } } : {}),
        ...(kids !== c.children ? { children: kids } : {}),
      }
    })
    return any ? mapped : list
  }
  const out = walk(Array.isArray(components) ? components : [])
  return changed ? out : components
}
