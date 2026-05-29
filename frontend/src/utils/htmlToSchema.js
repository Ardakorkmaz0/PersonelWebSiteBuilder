// High-fidelity, SAFE importer: render an uploaded HTML file (or a folder of
// HTML + CSS) in a hidden, script-disabled iframe, MEASURE each element's real
// position/size and computed styles, then emit the builder's whitelisted
// components so the result closely matches the original.
//
// Security:
//  - The iframe uses sandbox="allow-same-origin" WITHOUT allow-scripts, so no
//    JavaScript runs (inline scripts, on* handlers, img onerror — none execute).
//  - Before rendering we still strip <script>/<iframe>/<object>/<embed>/<link>/
//    <meta>/<base>, every on* attribute, and javascript: URLs.
//  - We only READ measurements/computed styles; raw HTML is never inserted into
//    the app DOM (no innerHTML/dangerouslySetInnerHTML). Styles are filtered to a
//    safe whitelist and re-sanitized; everything is re-validated again on save.
import { sanitizeStyles, sanitizeUrl } from './sanitize.js'

const IMPORT_W = 1200
const MAX_COMPONENTS = 500

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'link', 'meta', 'head', 'base', 'svg',
  'template', 'iframe', 'object', 'embed', 'canvas', 'audio', 'video', 'br',
])
const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button', 'li', 'blockquote',
  'figcaption', 'span', 'label', 'strong', 'em', 'small', 'code', 'th', 'td',
])
const CONTAINER_TAGS = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'ul', 'ol',
  'figure', 'form', 'table', 'tbody', 'tr',
])

let counter = 0
function genId(type) {
  counter += 1
  return `${type}_${Date.now().toString(36)}${counter}`
}
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()

// ---- DOM sanitation before rendering -----------------------------------
function sanitizeDoc(doc) {
  doc
    .querySelectorAll('script,iframe,object,embed,meta,base,noscript')
    .forEach((el) => el.remove())
  // Keep external <link rel="stylesheet"> (CSS only, no JS) so real sites style
  // correctly when measured; drop every other link (imports, prefetch, etc.).
  doc.querySelectorAll('link').forEach((el) => {
    const rel = (el.getAttribute('rel') || '').toLowerCase()
    if (!rel.split(/\s+/).includes('stylesheet')) el.remove()
  })
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      else if (
        (name === 'href' || name === 'src' || name === 'xlink:href') &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name)
      }
    }
  })
}

// ---- Computed style -> safe component styles ---------------------------
const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent', ''])

function computedToStyles(cs) {
  const out = {}
  if (cs.color) out.color = cs.color
  if (!TRANSPARENT.has(cs.backgroundColor)) out.backgroundColor = cs.backgroundColor
  out.fontSize = cs.fontSize
  out.fontWeight = cs.fontWeight
  out.fontFamily = cs.fontFamily
  if (cs.fontStyle && cs.fontStyle !== 'normal') out.fontStyle = cs.fontStyle
  if (cs.textAlign && cs.textAlign !== 'start') out.textAlign = cs.textAlign
  const tdl = cs.textDecorationLine || cs.textDecoration
  if (tdl && tdl !== 'none' && /underline|line-through/.test(tdl)) {
    out.textDecoration = tdl.split(' ')[0]
  }
  if (cs.textTransform && cs.textTransform !== 'none') out.textTransform = cs.textTransform
  if (cs.lineHeight && cs.lineHeight !== 'normal') out.lineHeight = cs.lineHeight
  if (cs.letterSpacing && cs.letterSpacing !== 'normal') out.letterSpacing = cs.letterSpacing
  const radius = cs.borderTopLeftRadius
  if (radius && radius !== '0px') out.borderRadius = radius
  const bw = parseFloat(cs.borderTopWidth) || 0
  if (bw > 0 && cs.borderTopStyle !== 'none') {
    out.borderWidth = cs.borderTopWidth
    out.borderStyle = cs.borderTopStyle
    out.borderColor = cs.borderTopColor
  }
  if (cs.boxShadow && cs.boxShadow !== 'none') out.boxShadow = cs.boxShadow
  if (cs.opacity && cs.opacity !== '1') out.opacity = cs.opacity
  if (cs.objectFit) out.objectFit = cs.objectFit
  // Spacing inside the box (rect is border-box, so padding insets content to match).
  const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
  if (pad.some((p) => p && p !== '0px')) out.padding = pad.join(' ')
  // Gradients are safe (no url()); url()/image backgrounds are dropped by sanitize.
  if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
    out.backgroundImage = cs.backgroundImage
  }
  return sanitizeStyles(out)
}

function hasSurface(cs) {
  if (!TRANSPARENT.has(cs.backgroundColor)) return true
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true
  if ((parseFloat(cs.borderTopWidth) || 0) > 0 && cs.borderTopStyle !== 'none') return true
  if (cs.boxShadow && cs.boxShadow !== 'none') return true
  return false
}

function headingLevel(tag) {
  if (tag === 'h1') return 'h1'
  if (tag === 'h2') return 'h2'
  return 'h3'
}

// ---- Walk + measure ----------------------------------------------------
function buildWalker(win) {
  const out = []
  function rectOf(el) {
    const r = el.getBoundingClientRect()
    return {
      x: Math.round(r.left + win.scrollX),
      y: Math.round(r.top + win.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    }
  }
  function push(type, props, styles, rect) {
    if (out.length >= MAX_COMPONENTS) return
    out.push({ id: genId(type), type, props, styles, layout: rect })
  }

  function visit(el, depth) {
    if (out.length >= MAX_COMPONENTS || depth > 60) return
    const tag = el.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag)) return
    const cs = win.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return
    const rect = rectOf(el)
    if (rect.w < 4 || rect.h < 2) {
      for (const child of el.children) visit(child, depth + 1)
      return
    }
    const styles = computedToStyles(cs)

    if (tag === 'img') {
      push('image', { src: sanitizeUrl(el.getAttribute('src')), alt: clean(el.getAttribute('alt')) }, styles, rect)
      return
    }
    if (tag === 'hr') {
      push('divider', {}, styles, rect)
      return
    }
    if (tag === 'nav' || ((tag === 'header' || tag === 'footer') && el.querySelector('a'))) {
      const links = [...el.querySelectorAll('a')]
        .map((a) => ({ label: clean(a.textContent), href: sanitizeUrl(a.getAttribute('href')) }))
        .filter((l) => l.label)
        .slice(0, 10)
      let brand = clean(el.querySelector('h1,h2,h3,strong,.brand,.logo')?.textContent)
      if (!brand) brand = clean(el.querySelector('img')?.getAttribute('alt')) || 'Brand'
      push('navbar', { brand, links }, styles, rect)
      return
    }
    if (TEXT_TAGS.has(tag)) {
      const text = clean(el.textContent)
      if (!text) return
      if (/^h[1-6]$/.test(tag)) {
        push('heading', { text, level: headingLevel(tag) }, styles, rect)
      } else if (tag === 'a') {
        push('linkbutton', { text, href: sanitizeUrl(el.getAttribute('href')) }, styles, rect)
      } else if (tag === 'button') {
        push('button', { text, href: '#' }, styles, rect)
      } else {
        push('text', { text }, styles, rect)
      }
      return
    }
    // Container: paint its surface behind children, then recurse.
    const elementChildren = el.children.length
    if (CONTAINER_TAGS.has(tag) || elementChildren) {
      if (hasSurface(cs)) push('section', { heading: '' }, styles, rect)
      if (elementChildren) {
        for (const child of el.children) visit(child, depth + 1)
      } else {
        const text = clean(el.textContent)
        if (text) push('text', { text }, styles, rect)
      }
      return
    }
    const text = clean(el.textContent)
    if (text) push('text', { text }, styles, rect)
  }

  return { out, visit }
}

// Render html (+ extra CSS) in a hidden, script-free iframe and measure it.
function measure(html, extraCss) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ components: [], background: '#ffffff', title: '' })
      return
    }
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
    sanitizeDoc(doc)
    if (extraCss && extraCss.length) {
      const styleEl = doc.createElement('style')
      styleEl.textContent = extraCss.join('\n')
      ;(doc.head || doc.documentElement).appendChild(styleEl)
    }
    const title = clean(doc.querySelector('title')?.textContent)
    const srcdoc = '<!DOCTYPE html>' + doc.documentElement.outerHTML

    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-same-origin') // no allow-scripts => JS disabled
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      `position:fixed; left:-100000px; top:0; width:${IMPORT_W}px; height:1200px; border:0; visibility:hidden;`

    let done = false
    const finish = () => {
      if (done) return
      done = true
      let result = { components: [], background: '#ffffff', title }
      try {
        const win = iframe.contentWindow
        const cdoc = iframe.contentDocument
        if (win && cdoc && cdoc.body) {
          const bodyCs = win.getComputedStyle(cdoc.body)
          const htmlCs = win.getComputedStyle(cdoc.documentElement)
          const bg = !TRANSPARENT.has(bodyCs.backgroundColor)
            ? bodyCs.backgroundColor
            : !TRANSPARENT.has(htmlCs.backgroundColor)
              ? htmlCs.backgroundColor
              : '#ffffff'
          const walker = buildWalker(win)
          for (const child of cdoc.body.children) walker.visit(child, 0)
          result = { components: walker.out, background: bg, title }
        }
      } catch {
        /* measurement failed -> empty result */
      } finally {
        iframe.remove()
      }
      resolve(result)
    }

    iframe.onload = () => setTimeout(finish, 250) // let images/fonts settle
    setTimeout(finish, 2500) // hard fallback
    document.body.appendChild(iframe)
    iframe.srcdoc = srcdoc
  })
}

function colorToHex(c) {
  // sanitize_color on the backend caps length & blocks bad values; rgb() is fine.
  return c || '#ffffff'
}

export async function htmlToPage(html, name = 'Page', extraCss = []) {
  const { components, background, title } = await measure(html, extraCss)
  return {
    id: genId('page'),
    name: name || title || 'Page',
    folder: '',
    background: colorToHex(background),
    canvasWidth: IMPORT_W,
    components,
  }
}

// Each HTML file -> a page; CSS files are shared across pages. index.html first.
export async function filesToSchema(htmlFiles, cssTexts = []) {
  const ordered = [...htmlFiles].sort((a, b) => {
    const ai = /index\.html?$/i.test(a.name) ? 0 : 1
    const bi = /index\.html?$/i.test(b.name) ? 0 : 1
    return ai - bi || a.name.localeCompare(b.name)
  })
  const pages = []
  for (const f of ordered) {
    pages.push(await htmlToPage(f.html, f.name.replace(/\.[^.]+$/, ''), cssTexts))
  }
  return pages.length ? { pages } : null
}
