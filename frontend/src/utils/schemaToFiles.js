// Turns the design schema into a small read-only "project" of files: one .html
// per page (components reference .c-<id> classes), a shared styles.css with the
// extracted/positioned styles + a responsive @media block, and schema.json.
//
// This is for DISPLAY (the VS Code-style code panel) and export. It never runs
// user input: text is HTML-escaped, URLs go through sanitizeUrl, style keys are
// whitelisted by sanitizeStyles, and CSS values are stripped of `;{}<` so a
// value can't break out of its rule.
import { sanitizeStyles, sanitizeUrl } from './sanitize.js'

const MOBILE_BREAKPOINT = 768

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  )
}

function cssValue(v) {
  return String(v).replace(/[;{}<]/g, '').trim()
}

function kebab(k) {
  return k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}

function styleBlock(styles) {
  const clean = sanitizeStyles(styles || {})
  return Object.entries(clean)
    .map(([k, v]) => `${kebab(k)}: ${cssValue(v)};`)
    .join(' ')
}

// Flex/layout behaviour each component's wrapper has in the live renderer.
function baseRules(type) {
  switch (type) {
    case 'navbar':
      return 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;'
    case 'heading':
    case 'text':
    case 'section':
      return 'display:flex; flex-direction:column; justify-content:center;'
    case 'card':
      return 'display:flex; flex-direction:column; justify-content:flex-start;'
    case 'button':
    case 'linkbutton':
      return 'display:flex; align-items:center; justify-content:center; text-decoration:none;'
    case 'image':
      return 'display:block; object-fit:cover;'
    default:
      return ''
  }
}

function tagFor(type) {
  if (type === 'button' || type === 'linkbutton') return 'a'
  if (type === 'image') return 'img'
  if (type === 'navbar') return 'nav'
  if (type === 'section') return 'section'
  return 'div'
}

function innerHtml(c) {
  const p = c.props || {}
  switch (c.type) {
    case 'navbar': {
      const links = Array.isArray(p.links) ? p.links : []
      const items = links
        .map((l) => {
          const href = sanitizeUrl(l.href)
          const ext = /^https?:\/\//i.test(href)
            ? ' target="_blank" rel="noopener noreferrer"'
            : ''
          return `<a href="${esc(href || '#')}"${ext}>${esc(l.label)}</a>`
        })
        .join('\n        ')
      return `<span class="brand">${esc(p.brand)}</span>\n      <div class="links">\n        ${items}\n      </div>`
    }
    case 'heading': {
      const lvl = ['h1', 'h2', 'h3'].includes(p.level) ? p.level : 'h2'
      return `<${lvl} class="m0">${esc(p.text)}</${lvl}>`
    }
    case 'text':
      return `<p class="m0">${esc(p.text)}</p>`
    case 'button':
    case 'linkbutton':
      return esc(p.text)
    case 'section':
      return p.heading ? `<h2 class="m0">${esc(p.heading)}</h2>` : ''
    case 'card':
      return `${p.title ? `<h3 class="card-title">${esc(p.title)}</h3>` : ''}${
        p.text ? `\n      <p class="m0">${esc(p.text)}</p>` : ''
      }`
    default:
      return ''
  }
}

function openTag(c) {
  const tag = tagFor(c.type)
  const cls = `c-${c.id}`
  if (tag === 'a') {
    const href = sanitizeUrl((c.props || {}).href)
    const ext = /^https?:\/\//i.test(href)
      ? ' target="_blank" rel="noopener noreferrer"'
      : ''
    return `<a class="${cls}" href="${esc(href || '#')}"${ext}>`
  }
  if (tag === 'img') {
    const src = sanitizeUrl((c.props || {}).src)
    return `<img class="${cls}" src="${esc(src)}" alt="${esc((c.props || {}).alt)}" />`
  }
  return `<${tag} class="${cls}">`
}

function pageHtml(page, fileTitle, cssHref = 'styles.css') {
  const comps = Array.isArray(page.components) ? page.components : []
  const body = comps
    .map((c) => {
      const tag = tagFor(c.type)
      if (tag === 'img') return `    ${openTag(c)}`
      const inner = innerHtml(c)
      return `    ${openTag(c)}${inner ? `\n      ${inner}\n    ` : ''}</${tag}>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(fileTitle)}</title>
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body>
    <div class="page p-${page.id}">
${body}
    </div>
  </body>
</html>`
}

function pageMinHeight(comps, key, fallback) {
  const bottom = (comps || []).reduce((max, c) => {
    const l = (key === 'mobileLayout' ? c.mobileLayout : c.layout) || {}
    return Math.max(max, (l.y || 0) + (l.h || 0))
  }, 0)
  return Math.max(fallback, bottom + 40)
}

export function schemaToCss(schema) {
  const pages = schema?.pages || []
  let css = `/* Auto-generated from your design — read-only. */
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, 'Segoe UI', Roboto, sans-serif; }
.page { position: relative; margin: 0 auto; }
.brand { font-weight: bold; font-size: 18px; }
.links { display: flex; gap: 20px; flex-wrap: wrap; }
.links a { color: inherit; text-decoration: none; }
.m0 { margin: 0; }
.card-title { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
`
  // Desktop
  for (const page of pages) {
    const comps = page.components || []
    const w = page.canvasWidth || 1000
    css += `\n/* ===== ${page.name} (desktop) ===== */\n`
    css += `.p-${page.id} { width: ${w}px; min-height: ${pageMinHeight(comps, 'layout', 600)}px; background: ${cssValue(page.background || '#ffffff')}; }\n`
    for (const c of comps) {
      const l = c.layout || {}
      const hide = c.hidden ? ' display:none;' : ''
      css += `.c-${c.id} { position:absolute; left:${l.x || 0}px; top:${l.y || 0}px; width:${l.w || 0}px; height:${l.h || 0}px; ${baseRules(c.type)} ${styleBlock(c.styles)}${hide} }\n`
    }
  }
  // Mobile
  css += `\n@media (max-width: ${MOBILE_BREAKPOINT}px) {\n`
  for (const page of pages) {
    const comps = page.components || []
    const mw = page.mobileWidth || 390
    css += `  .p-${page.id} { width: ${mw}px; min-height: ${pageMinHeight(comps, 'mobileLayout', 400)}px; background: ${cssValue(page.backgroundMobile || page.background || '#ffffff')}; }\n`
    for (const c of comps) {
      const l = c.mobileLayout || c.layout || {}
      const hide = c.hiddenMobile ? ' display:none;' : ''
      css += `  .c-${c.id} { left:${l.x || 0}px; top:${l.y || 0}px; width:${l.w || 0}px; height:${l.h || 0}px;${hide} }\n`
    }
  }
  css += `}\n`
  return css
}

// Make unique, friendly file names from page names (first page -> index.html).
function slug(name) {
  const s = String(name || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'page'
}

export function schemaToFiles(schema) {
  const pages = schema?.pages || []
  const files = []
  const used = new Set()
  pages.forEach((page, i) => {
    let base = i === 0 ? 'index' : slug(page.name)
    let name = `${base}.html`
    let n = 2
    while (used.has(name)) name = `${base}-${n++}.html`
    used.add(name)
    files.push({
      name,
      lang: 'html',
      content: pageHtml(page, page.name || 'My Site'),
    })
  })
  files.push({ name: 'styles.css', lang: 'css', content: schemaToCss(schema) })
  files.push({
    name: 'schema.json',
    lang: 'json',
    content: JSON.stringify(schema, null, 2),
  })
  return files
}
