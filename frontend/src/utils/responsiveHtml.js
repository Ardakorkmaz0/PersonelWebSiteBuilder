// Turn a component design into a genuinely responsive HTML document using
// flexbox rows, a centered fluid container, full-bleed bands and @media
// breakpoints (content reflows / stacks), instead of absolute positions + scale.
// The result becomes an "HTML site" that adapts natively on every device.
import { sanitizeStyles, sanitizeUrl, sanitizeImageSrc } from './sanitize.js'
import { iconSvg } from './icons.js'
import { customCssBlock, themeVariablesCss } from './theme.js'

const FULL_WIDTH = new Set(['navbar', 'section', 'divider'])
// Visual styles we keep on elements; layout/box metrics come from the flow.
const DROP_STYLES = new Set([
  'width', 'height', 'maxWidth', 'minHeight', 'display', 'gap', 'objectFit',
])

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  )
}
const cssVal = (v) => String(v).replace(/[;{}<]/g, '').trim()
const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())

function styleAttr(component, extra = '') {
  const clean = sanitizeStyles(component.styles || {})
  const parts = Object.entries(clean)
    .filter(([k]) => !DROP_STYLES.has(k))
    .map(([k, v]) => `${kebab(k)}:${cssVal(v)}`)
  if (extra) parts.push(extra)
  return parts.length ? ` style="${parts.join(';')}"` : ''
}

// Group components into rows by vertical overlap (true reading order).
function readingRows(components) {
  const sorted = components
    .map((c, i) => ({ c, i, r: c.layout || { x: 0, y: 0, w: 0, h: 0 } }))
    .sort((a, b) => (a.r.y || 0) - (b.r.y || 0) || a.i - b.i)
  const rows = []
  for (const it of sorted) {
    const top = it.r.y || 0
    const bottom = top + (it.r.h || 0)
    const row = rows[rows.length - 1]
    if (row && top < row.bottom - 6) {
      row.items.push(it)
      row.bottom = Math.max(row.bottom, bottom)
    } else {
      rows.push({ bottom, items: [it] })
    }
  }
  for (const row of rows) row.items.sort((a, b) => (a.r.x || 0) - (b.r.x || 0) || a.i - b.i)
  return rows.map((row) => row.items.map((it) => it.c))
}

function linkAttrs(href) {
  return /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
}

function navbar(c) {
  const p = c.props || {}
  const links = (Array.isArray(p.links) ? p.links : [])
    .map((l) => {
      const href = sanitizeUrl(l.href)
      return `<a href="${esc(href || '#')}"${linkAttrs(href)}>${esc(l.label)}</a>`
    })
    .join('\n          ')
  return `<header class="rh-navbar"${styleAttr(c)}>
      <div class="rh-container rh-nav-inner">
        <span class="rh-brand">${esc(p.brand)}</span>
        <nav class="rh-links">\n          ${links}\n        </nav>
      </div>
    </header>`
}

function section(c) {
  const p = c.props || {}
  return `<section class="rh-section"${styleAttr(c)}>
      <div class="rh-container">${p.heading ? `<h2 class="rh-m0">${esc(p.heading)}</h2>` : ''}</div>
    </section>`
}

const LINKABLE = new Set(['heading', 'text', 'image', 'card', 'badge', 'icon'])

// One element inside a row, optionally wrapped in a link (display:contents keeps
// the flex layout intact). `multi` = the row has more than one item, so columns
// share the width proportionally to their desktop widths; a lone item fills.
function item(c, multi) {
  const el = itemEl(c, multi)
  const href = LINKABLE.has(c.type) ? sanitizeUrl((c.props || {}).href) : ''
  if (!href) return el
  const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${esc(href)}" style="display:contents"${ext}>${el}</a>`
}

function itemEl(c, multi) {
  const p = c.props || {}
  const w = Math.round(c.layout?.w || 300)
  const col = multi ? `flex:${w} 1 0` : 'flex:1 1 100%'
  const cls = multi ? 'rh-item rh-col' : 'rh-item'
  switch (c.type) {
    case 'heading': {
      const lvl = ['h1', 'h2', 'h3'].includes(p.level) ? p.level : 'h2'
      return `<${lvl} class="${cls} rh-m0"${styleAttr(c, col)}>${esc(p.text)}</${lvl}>`
    }
    case 'text':
      return `<p class="${cls} rh-m0"${styleAttr(c, col)}>${esc(p.text)}</p>`
    case 'button':
    case 'linkbutton': {
      const href = sanitizeUrl(p.href)
      return `<a class="rh-item rh-btn" href="${esc(href || '#')}"${linkAttrs(href)}${styleAttr(c, 'flex:0 0 auto')}>${esc(p.text)}</a>`
    }
    case 'image': {
      const src = sanitizeImageSrc(p.src)
      return `<img class="${cls} rh-img" src="${esc(src)}" alt="${esc(p.alt)}"${styleAttr(c, col)} />`
    }
    case 'card':
      return `<div class="${cls} rh-card"${styleAttr(c, col)}>${
        p.title ? `<h3 class="rh-card-title">${esc(p.title)}</h3>` : ''
      }${p.text ? `<p class="rh-m0">${esc(p.text)}</p>` : ''}</div>`
    case 'spacer':
      return `<div class="rh-item" style="flex:1 1 100%;height:${Math.round(c.layout?.h || 24)}px"></div>`
    case 'list': {
      const items = String(p.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      const tag = p.ordered ? 'ol' : 'ul'
      return `<${tag} class="${cls}"${styleAttr(c, `${col};margin:0;padding-left:1.4em`)}>${items
        .map((it) => `<li>${esc(it)}</li>`)
        .join('')}</${tag}>`
    }
    case 'quote':
      return `<blockquote class="${cls}"${styleAttr(
        c,
        `${col};border-left:4px solid currentColor;padding-left:18px;font-style:italic;margin:0`,
      )}><p class="rh-m0">${esc(p.text)}</p>${
        p.author
          ? `<footer style="margin-top:8px;font-style:normal;font-size:.85em;opacity:.7">— ${esc(p.author)}</footer>`
          : ''
      }</blockquote>`
    case 'badge':
      return `<span class="rh-item"${styleAttr(c, 'flex:0 0 auto;display:inline-flex;align-items:center')}>${esc(p.text)}</span>`
    case 'icon':
      return `<span class="rh-item"${styleAttr(c, 'flex:0 0 auto;display:inline-flex;align-items:center;line-height:0')}>${iconSvg(p.name)}</span>`
    case 'input': {
      const t = ['text', 'email', 'number', 'tel', 'url'].includes(p.inputType) ? p.inputType : 'text'
      return `<label class="${cls}"${styleAttr(c, `${col};display:flex;flex-direction:column;gap:6px`)}>${
        p.label ? `<span style="font-weight:600">${esc(p.label)}</span>` : ''
      }<input type="${t}" placeholder="${esc(p.placeholder)}" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit" /></label>`
    }
    default:
      return ''
  }
}

export function schemaToResponsiveHtml(schema, title = 'My Site') {
  const page = schema?.pages?.[0] || {}
  const components = (page.components || []).filter((c) => !c.hidden)
  const bg = cssVal(page.background || '#ffffff')
  const maxW = Math.max(320, Math.min(1280, Math.round(page.canvasWidth || 1120)))

  const rows = readingRows(components)
  let body = ''
  let buffer = []
  const flush = () => {
    if (!buffer.length) return
    body += `\n    <div class="rh-container"><div class="rh-wrap">${buffer.join('')}</div></div>`
    buffer = []
  }
  for (const row of rows) {
    let inline = []
    const flushInline = () => {
      if (!inline.length) return
      const multi = inline.length > 1
      buffer.push(`<div class="rh-row">${inline.map((c) => item(c, multi)).join('')}</div>`)
      inline = []
    }
    for (const c of row) {
      if (!FULL_WIDTH.has(c.type)) {
        inline.push(c)
        continue
      }
      flushInline()
      flush()
      if (c.type === 'navbar') body += '\n    ' + navbar(c)
      else if (c.type === 'section') body += '\n    ' + section(c)
      else body += `\n    <hr class="rh-divider"${styleAttr(c)} />`
    }
    flushInline()
  }
  flush()

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <style>
      ${themeVariablesCss(schema?.theme)}
      *{ box-sizing: border-box; }
      html, body { overflow-x: hidden; }
      body { margin: 0; font-family: var(--site-font, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif); color: var(--site-text, #1d1d1f); background: ${bg}; line-height: 1.5; }
      img { max-width: 100%; height: auto; display: block; }
      a { color: inherit; text-decoration: none; }
      .rh-container { width: 100%; max-width: ${maxW}px; margin: 0 auto; padding: 0 24px; }
      .rh-wrap { display: flex; flex-direction: column; gap: 32px; padding: 40px 0; }
      .rh-row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; justify-content: center; }
      .rh-item { min-width: 0; max-width: 100%; }
      .rh-col { min-width: 200px; }
      .rh-img { width: 100%; border-radius: inherit; }
      .rh-m0 { margin: 0; }
      .rh-navbar { width: 100%; }
      .rh-nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 0; }
      .rh-brand { font-weight: 700; font-size: 18px; }
      .rh-links { display: flex; gap: 22px; flex-wrap: wrap; }
      .rh-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; text-align: center; }
      .rh-card { align-self: stretch; padding: 24px; }
      .rh-card-title { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
      .rh-section { width: 100%; padding: 56px 0; }
      .rh-divider { border: none; height: 1px; background: #d2d2d7; width: 100%; margin: 8px 0; }
      h1 { font-size: clamp(30px, 5vw, 46px); line-height: 1.12; }
      h2 { font-size: clamp(24px, 4vw, 34px); line-height: 1.2; }
      h3 { line-height: 1.25; }
      @media (max-width: 768px) {
        .rh-row { flex-direction: column; align-items: stretch; }
        .rh-col { min-width: 0; }
        .rh-row .rh-btn { align-self: center; }
        .rh-nav-inner { flex-direction: column; align-items: flex-start; gap: 10px; }
        .rh-section { padding: 40px 0; }
        .rh-wrap { gap: 24px; padding: 28px 0; }
      }
      ${customCssBlock(schema?.customCss)}
    </style>
  </head>
  <body>${body}
  </body>
</html>`
}
