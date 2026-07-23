// Turn a component design into a genuinely responsive HTML document using
// flexbox rows, a centered fluid container, full-bleed bands and @media
// breakpoints (content reflows / stacks), instead of absolute positions + scale.
// The result becomes an "HTML site" that adapts natively on every device.
import { sanitizeStyles, sanitizeUrl, sanitizeImageSrc } from './sanitize.js'
import { iconSvg } from './icons.js'
import { ALERT_VARIANTS } from '../components/renderer/constants.js'
import { customCssBlock, customJsBlock, themeVariablesCss } from './theme.js'
import { builderInteractiveTags, withBuilderInteractiveHtml } from './htmlRuntime.js'
import { htmlEmbedDocument } from './htmlEmbedDocument.js'
import { htmlEmbedDocumentOptions } from './htmlSnippetSizing.js'
import { googleFontLinkTag } from './googleFonts.js'
import { navLinkLabel, navbarLinkGap, navbarPlacement } from './navbarLayout.js'
import { pinnedLayoutStyle } from '../components/renderer/layout.js'

const FULL_WIDTH = new Set(['navbar', 'section', 'divider'])

function isFullWidthComponent(c) {
  return FULL_WIDTH.has(c?.type) && !(c?.type === 'navbar' && c.props?.navLayout === 'vertical')
}
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
function multiline(s) {
  return esc(s).replace(/\r?\n/g, '<br>')
}
const cssVal = (v) => String(v).replace(/[;{}<]/g, '').trim()
const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())

function safeCssProp(value, fallback = '') {
  const raw = value === undefined || value === null || value === '' ? fallback : value
  const out = cssVal(raw)
  const low = out.toLowerCase()
  if (low.includes('javascript:') || low.includes('expression(') || low.includes('url(')) {
    return cssVal(fallback)
  }
  return out
}

function controlFieldCss(props = {}) {
  return [
    'width:100%',
    `height:${safeCssProp(props.fieldHeight, '44px')}`,
    `padding:${safeCssProp(props.fieldPadding, '10px 12px')}`,
    `border-width:${safeCssProp(props.fieldBorderWidth, '1px')}`,
    'border-style:solid',
    `border-color:${safeCssProp(props.fieldBorderColor, '#cbd5e1')}`,
    `border-radius:${safeCssProp(props.fieldBorderRadius, '8px')}`,
    'font:inherit',
    `color:${safeCssProp(props.fieldColor, 'inherit')}`,
    `background:${safeCssProp(props.fieldBackgroundColor, '#fff')}`,
    `box-shadow:${safeCssProp(props.fieldBoxShadow, 'none')}`,
    'box-sizing:border-box',
    'min-width:0',
  ].join(';')
}

function tabsCssVars(props = {}) {
  return [
    `--builder-tab-bg:${safeCssProp(props.tabBackgroundColor, 'transparent')}`,
    `--builder-tab-color:${safeCssProp(props.tabTextColor, '#6b7280')}`,
    `--builder-tab-active-bg:${safeCssProp(props.activeTabBackgroundColor, 'transparent')}`,
    `--builder-tab-active-color:${safeCssProp(props.activeTabColor, '#1d1d1f')}`,
    `--builder-tab-active-border:${safeCssProp(props.activeTabBorderColor, '#2563eb')}`,
    `--builder-tab-radius:${safeCssProp(props.tabBorderRadius, '0')}`,
    `--builder-tab-padding:${safeCssProp(props.tabPadding, '8px 14px')}`,
    `--builder-tab-gap:${safeCssProp(props.tabGap, '4px')}`,
    `--builder-tablist-bg:${safeCssProp(props.tablistBackgroundColor, 'transparent')}`,
    `--builder-tablist-border:${safeCssProp(props.tablistBorderColor, '#e5e7eb')}`,
    `--builder-tablist-padding:${safeCssProp(props.tablistPadding, '0')}`,
    `--builder-panel-bg:${safeCssProp(props.panelBackgroundColor, 'transparent')}`,
    `--builder-panel-border:${safeCssProp(props.panelBorderColor, 'transparent')}`,
    `--builder-panel-radius:${safeCssProp(props.panelBorderRadius, '0')}`,
    `--builder-panel-padding:${safeCssProp(props.panelPadding, '0')}`,
  ].join(';')
}

function styleAttr(component, extra = '') {
  const clean = sanitizeStyles(component.styles || {})
  const parts = Object.entries(clean)
    .filter(([k]) => !DROP_STYLES.has(k))
    .map(([k, v]) => `${kebab(k)}:${cssVal(v)}`)
  Object.entries(pinnedLayoutStyle(component, {}))
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .forEach(([k, v]) => parts.push(`${kebab(k)}:${cssVal(v)}`))
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

function iconTextHtml(props = {}) {
  const icon = props.icon ? `<span aria-hidden="true" style="display:inline-flex;line-height:0">${iconSvg(props.icon)}</span>` : ''
  return `${icon}<span>${multiline(props.text)}</span>`
}

function safeInlineCss(value, fallback = '') {
  return String(value || fallback).replace(/[;{}<]/g, '').trim()
}

function sectionInnerHtml(props = {}, styles = {}) {
  const href = sanitizeUrl(props.buttonHref)
  const color = safeInlineCss(styles.color, '#1d1d1f')
  const bg = safeInlineCss(styles.backgroundColor, '#ffffff')
  return `<div class="rh-container">${
    props.eyebrow
      ? `<p style="margin:0 0 10px;font-size:.78em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.72">${multiline(props.eyebrow)}</p>`
      : ''
  }${props.heading ? `<h2 class="rh-m0">${multiline(props.heading)}</h2>` : ''}${
    props.text ? `<p class="rh-m0" style="margin-top:${props.heading ? '12px' : '0'};line-height:1.6;opacity:.78">${multiline(props.text)}</p>` : ''
  }${
    props.buttonText
      ? `<a href="${esc(href || '#')}"${linkAttrs(href)} style="display:inline-flex;align-items:center;justify-content:center;margin-top:20px;padding:.72em 1.2em;border-radius:.65em;background:${color};color:${bg};text-decoration:none;font-weight:700">${multiline(props.buttonText)}</a>`
      : ''
  }</div>`
}

function iconA11yAttrs(props = {}) {
  const label = String(props.label || '').trim()
  return label ? ` role="img" aria-label="${esc(label)}" title="${esc(label)}"` : ''
}

function navbar(c) {
  const p = c.props || {}
  const layout = ['vertical', 'centered', 'twoRow'].includes(p.navLayout) ? p.navLayout : 'horizontal'
  const links = (Array.isArray(p.links) ? p.links : [])
    .map((l) => {
      const href = sanitizeUrl(l.href)
      return `<a href="${esc(href || '#')}"${linkAttrs(href)}>${esc(navLinkLabel(l.label))}</a>`
    })
    .join('\n          ')
  // Brand / links placement (horizontal only) from the shared rules the editor
  // draws with, so this bar arranges itself exactly the same way.
  const placed = layout === 'horizontal' ? navbarPlacement(p) : null
  const attr = (styles) => {
    const css = Object.entries(styles || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${kebab(k)}:${cssVal(typeof v === 'number' && k !== 'order' ? `${v}px` : v)}`)
      .join(';')
    return css ? ` style="${css}"` : ''
  }
  return `<header class="rh-navbar"${styleAttr(c)}>
      <div class="rh-container rh-nav-inner rh-nav-${layout}"${attr(placed?.row)}>
        <span class="rh-brand"${attr(placed?.brand)}>${multiline(p.brand)}</span>
        <nav class="rh-links"${attr(placed ? { ...placed.links, columnGap: navbarLinkGap(p), rowGap: 6 } : null)}>\n          ${links}\n        </nav>
      </div>
    </header>`
}

function section(c) {
  const p = c.props || {}
  return `<section class="rh-section"${styleAttr(c)}>
      ${sectionInnerHtml(p, c.styles || {})}
    </section>`
}

const LINKABLE = new Set(['heading', 'text', 'image', 'card', 'list', 'quote', 'badge', 'icon', 'alert'])

// One element inside a row, optionally wrapped in a link (display:contents keeps
// the flex layout intact). `multi` = the row has more than one item, so columns
// share the width proportionally to their desktop widths; a lone item fills.
function item(c, multi, colOverride) {
  const el = itemEl(c, multi, colOverride)
  const href = LINKABLE.has(c.type) ? sanitizeUrl((c.props || {}).href) : ''
  if (!href) return el
  const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${esc(href)}" style="display:contents"${ext}>${el}</a>`
}

function itemEl(c, multi, colOverride) {
  const p = c.props || {}
  const w = Math.round(c.layout?.w || 300)
  const col = colOverride || (multi ? `flex:${w} 1 0` : 'flex:1 1 100%')
  const cls = multi ? 'rh-item rh-col' : 'rh-item'
  switch (c.type) {
    case 'heading': {
      const lvl = ['h1', 'h2', 'h3'].includes(p.level) ? p.level : 'h2'
      return `<${lvl} class="${cls} rh-m0"${styleAttr(c, col)}>${multiline(p.text)}</${lvl}>`
    }
    case 'text':
      return `<p class="${cls} rh-m0"${styleAttr(c, col)}>${multiline(p.text)}</p>`
    case 'button':
    case 'linkbutton': {
      const href = sanitizeUrl(p.href)
      return `<a class="rh-item rh-btn" href="${esc(href || '#')}"${linkAttrs(href)}${styleAttr(c, colOverride || 'flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:.45em')}>${iconTextHtml(p)}</a>`
    }
    case 'image': {
      const src = sanitizeImageSrc(p.src)
      return `<img class="${cls} rh-img" src="${esc(src)}" alt="${esc(p.alt)}"${styleAttr(c, col)} />`
    }
    case 'card':
      return `<div class="${cls} rh-card"${styleAttr(c, col)}>${
        p.title ? `<h3 class="rh-card-title">${multiline(p.title)}</h3>` : ''
      }${p.text ? `<p class="rh-m0">${multiline(p.text)}</p>` : ''}</div>`
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
      )}><p class="rh-m0">${multiline(p.text)}</p>${
        p.author
          ? `<footer style="margin-top:8px;font-style:normal;font-size:.85em;opacity:.7">— ${multiline(p.author)}</footer>`
          : ''
      }</blockquote>`
    case 'badge':
      return `<span class="rh-item"${styleAttr(c, colOverride || 'flex:0 0 auto;display:inline-flex;align-items:center')}>${multiline(p.text)}</span>`
    case 'icon':
      return `<span class="rh-item"${iconA11yAttrs(p)}${styleAttr(c, colOverride || 'flex:0 0 auto;display:inline-flex;align-items:center;line-height:0')}>${iconSvg(p.name)}</span>`
    case 'input': {
      const t = ['text', 'email', 'number', 'tel', 'url'].includes(p.inputType) ? p.inputType : 'text'
      return `<label class="${cls}"${styleAttr(c, `${col};display:flex;flex-direction:column;gap:6px;min-width:0`)}>${
        p.label ? `<span style="font-weight:600">${multiline(p.label)}</span>` : ''
      }<input type="${t}" placeholder="${esc(p.placeholder)}" style="${controlFieldCss(p)}" /></label>`
    }
    case 'select': {
      const opts = String(p.options || '').split('\n').map((s) => s.trim()).filter(Boolean)
      return `<label class="${cls}"${styleAttr(c, `${col};display:flex;flex-direction:column;gap:6px;min-width:0`)}>${
        p.label ? `<span style="font-weight:600">${multiline(p.label)}</span>` : ''
      }<select style="${controlFieldCss(p)}">${
        p.placeholder ? `<option value="" disabled selected>${esc(p.placeholder)}</option>` : ''
      }${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`
    }
    case 'alert': {
      const v = ALERT_VARIANTS[p.variant] || ALERT_VARIANTS.info
      return `<div class="${cls}"${styleAttr(c, `${col};display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;border:1px solid ${v.border};background:${v.bg};color:${v.color}`)}>${iconSvg(p.icon || 'check')}<span>${multiline(p.text)}</span></div>`
    }
    case 'accordion':
      return `<details class="${cls}"${styleAttr(c, `${col};border:1px solid #e5e7eb;border-radius:10px;padding:2px 16px`)}><summary style="cursor:pointer;font-weight:600;padding:12px 0">${multiline(p.title)}</summary><div style="padding-bottom:14px;color:#4b5563">${multiline(p.text)}</div></details>`
    case 'container': {
      const kids = (Array.isArray(c.children) ? c.children : []).filter((ch) => !ch.hidden)
      const h = absolutePanelHeight(kids, Math.round(c.layout?.h || 160))
      const inner = kids
        .map((ch) => {
          const l = ch.layout || {}
          return item(
            ch,
            false,
            `position:absolute;left:${Math.round(l.x || 0)}px;top:${Math.round(l.y || 0)}px;width:${Math.round(l.w || 200)}px;height:${Math.round(l.h || 80)}px`,
          )
        })
        .join('')
      return `<div class="${cls}"${styleAttr(c, `${col};display:block;position:relative;min-height:${h}px`)}>${inner}</div>`
    }
    case 'tabs':
      return tabsHtml(c, cls, col)
    case 'html':
      return htmlEmbed(c, cls, col)
    default:
      return ''
  }
}

// Render an HTML Embed as a sandboxed iframe; pass the user's code via srcdoc
// so it can never read the surrounding document. Defaults to a fixed pixel
// height (boxH) since iframe content can't size itself from outside.
// withBuilderInteractiveHtml is layered on top so `<a href="#">` inside the
// embed scrolls to top instead of navigating the sandboxed iframe to
// `about:srcdoc#` (which whites it out under `allow-scripts` only).
function htmlEmbed(c, cls, col) {
  const p = c.props || {}
  const code = typeof p.code === 'string' ? p.code : ''
  const doc = htmlEmbedDocument(code, htmlEmbedDocumentOptions(c))
  const h = Math.max(40, Math.round(c.layout?.h || 240))
  const safeDoc = withBuilderInteractiveHtml(doc).replace(/"/g, '&quot;')
  return `<iframe class="${cls}" srcdoc="${safeDoc}" scrolling="no" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals" loading="lazy"${styleAttr(c, `${col};width:100%;height:${h}px;border:0;background:transparent;overflow:hidden`)}></iframe>`
}

// Render a `tabs` widget as a tab strip + one panel per tab. The runtime JS
// shim toggles `[hidden]` on panels and `aria-selected` on tabs on click.
function absolutePanelHeight(children, minHeight = 120) {
  return Math.max(
    minHeight,
    children.reduce((max, ch) => {
      const l = ch.layout || {}
      return Math.max(max, (l.y || 0) + (l.h || 0))
    }, 0) + 16,
  )
}

function tabsHtml(c, cls, col) {
  const p = c.props || {}
  const tabs = (Array.isArray(p.tabs) ? p.tabs : []).filter((t) => t && t.id)
  const safeTabs = tabs.length ? tabs : [{ id: 't1', label: 'Tab' }]
  const activeId = safeTabs.some((t) => t.id === p.activeId) ? p.activeId : safeTabs[0].id
  const kids = (Array.isArray(c.children) ? c.children : []).filter((ch) => !ch.hidden)
  const strip = safeTabs
    .map(
      (t) =>
        `<button type="button" role="tab" data-builder-tab="${esc(t.id)}" aria-selected="${
          t.id === activeId ? 'true' : 'false'
        }">${multiline(t.label || 'Tab')}</button>`,
    )
    .join('')
  const panels = safeTabs
    .map((t) => {
      const panelKids = kids.filter((ch) => (ch.tabId || safeTabs[0].id) === t.id)
      const panelH = absolutePanelHeight(panelKids, 120)
      const inner = panelKids
        .map((ch) => {
          const l = ch.layout || {}
          return item(
            ch,
            false,
            `position:absolute;left:${Math.round(l.x || 0)}px;top:${Math.round(l.y || 0)}px;width:${Math.round(l.w || 200)}px;height:${Math.round(l.h || 80)}px`,
          )
        })
        .join('')
      const hidden = t.id === activeId ? '' : ' hidden'
      return `<div role="tabpanel" data-builder-panel="${esc(t.id)}"${hidden} style="display:block;position:relative;min-height:${panelH}px">${inner}</div>`
    })
    .join('')
  return `<div class="${cls}" data-builder-tabs="${esc(c.id)}"${styleAttr(
    c,
    `${col};display:flex;flex-direction:column;${tabsCssVars(p)}`,
  )}><div role="tablist">${strip}</div>${panels}</div>`
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
      if (!isFullWidthComponent(c)) {
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
    ${googleFontLinkTag(schema?.theme)}
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
      .rh-nav-vertical { height: 100%; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 14px; }
      .rh-nav-vertical .rh-links { width: 100%; flex-direction: column; align-items: stretch; gap: 6px; }
      .rh-nav-vertical .rh-links a { display: block; width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; }
      .rh-nav-centered { flex-direction: column; justify-content: flex-start; text-align: center; gap: 10px; }
      .rh-nav-centered .rh-links { justify-content: center; }
      .rh-nav-twoRow { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 10px; }
      .rh-nav-twoRow .rh-links { width: 100%; }
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
  ${builderInteractiveTags()}
  ${customJsBlock(schema?.customJs)}
  </body>
</html>`
}
