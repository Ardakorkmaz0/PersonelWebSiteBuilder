// Turns the design schema into a small read-only "project" of files: one
// self-contained .html per page plus schema.json.
//
// This is for DISPLAY (the VS Code-style code panel) and export. It never runs
// user input: text is HTML-escaped, URLs go through sanitizeUrl, style keys are
// whitelisted by sanitizeStyles, and CSS values are stripped of `;{}<` so a
// value can't break out of its rule.
import { sanitizeStyles, sanitizeUrl, sanitizeImageSrc } from './sanitize.js'
import { iconSvg } from './icons.js'
import { ALERT_VARIANTS } from '../components/renderer/constants.js'
import { customCssBlock, customJsBlock, themeVariablesCss } from './theme.js'
import { builderInteractiveTags, withBuilderInteractiveHtml } from './htmlRuntime.js'
import { htmlEmbedDocument } from './htmlEmbedDocument.js'
import { googleFontLinkTag } from './googleFonts.js'
import { CANVAS_WIDTH } from '../components/registry.jsx'
import {
  absoluteChildrenHeight,
  flowCanvasHeight,
  flowGap,
  flowItemStyle,
  flowSidePad,
} from '../components/renderer/layout.js'

const MOBILE_BREAKPOINT = 768
const FLOW_FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'divider'])
const FLOW_FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])

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

function cssUnit(key, value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') {
    return ['opacity', 'zIndex', 'fontWeight', 'lineHeight'].includes(key)
      ? String(value)
      : `${value}px`
  }
  return cssValue(value)
}

function styleObjectBlock(styles) {
  return Object.entries(styles || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${kebab(k)}: ${cssUnit(k, v)};`)
    .join(' ')
}

function safeCssProp(value, fallback = '') {
  const raw = value === undefined || value === null || value === '' ? fallback : value
  const out = cssValue(raw)
  const low = out.toLowerCase()
  if (low.includes('javascript:') || low.includes('expression(') || low.includes('url(')) {
    return cssValue(fallback)
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

function iconTextHtml(props = {}) {
  const icon = props.icon ? `<span aria-hidden="true" style="display:inline-flex;line-height:0">${iconSvg(props.icon)}</span>` : ''
  return `${icon}<span>${esc(props.text)}</span>`
}

function linkAttrs(href) {
  return /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
}

function sectionInnerHtml(props = {}, styles = {}) {
  const href = sanitizeUrl(props.buttonHref)
  const color = safeCssProp(styles.color, '#1d1d1f')
  const bg = safeCssProp(styles.backgroundColor, '#ffffff')
  return `<div class="section-inner">${
    props.eyebrow
      ? `<p style="margin:0 0 10px;font-size:.78em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.72">${esc(props.eyebrow)}</p>`
      : ''
  }${props.heading ? `<h2 class="m0">${esc(props.heading)}</h2>` : ''}${
    props.text ? `<p class="m0" style="margin-top:${props.heading ? '12px' : '0'};line-height:1.6;opacity:.78">${esc(props.text)}</p>` : ''
  }${
    props.buttonText
      ? `<a href="${esc(href || '#')}"${linkAttrs(href)} style="display:inline-flex;align-items:center;justify-content:center;margin-top:20px;padding:.72em 1.2em;border-radius:.65em;background:${color};color:${bg};text-decoration:none;font-weight:700">${esc(props.buttonText)}</a>`
      : ''
  }</div>`
}

function iconA11yAttrs(props = {}) {
  const label = String(props.label || '').trim()
  return label ? ` role="img" aria-label="${esc(label)}" title="${esc(label)}"` : ''
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

// Flex/layout behaviour each component's wrapper has in the live renderer.
function baseRules(type) {
  switch (type) {
    case 'navbar':
      return 'display:flex; align-items:center; justify-content:center;'
    case 'heading':
    case 'text':
    case 'section':
      return 'display:flex; flex-direction:column; justify-content:center;'
    case 'card':
      return 'display:flex; flex-direction:column; justify-content:flex-start;'
    case 'button':
    case 'linkbutton':
      return 'display:flex; align-items:center; justify-content:center; gap:.45em; text-decoration:none;'
    case 'image':
      return 'display:block; object-fit:cover;'
    case 'quote':
      return 'border-left:4px solid currentColor; padding-left:18px; font-style:italic;'
    case 'badge':
      return 'display:inline-flex; align-items:center;'
    case 'icon':
      return 'display:inline-flex; align-items:center; line-height:0;'
    case 'input':
      return 'display:flex; flex-direction:column; gap:6px; min-width:0;'
    default:
      return ''
  }
}

// Wrap an element in an <a> (display:contents keeps the layout) when it has a
// link. ANY component is linkable except anchors/interactive types — mirrors
// the live renderer's NON_WRAP_LINK_TYPES so export matches preview.
const NON_WRAP_LINK = new Set([
  'button', 'linkbutton', 'navbar', 'section', 'tabs', 'container', 'accordion', 'select', 'input', 'html',
])

function linkWrap(c, html) {
  const href = !NON_WRAP_LINK.has(c.type) ? sanitizeUrl((c.props || {}).href) : ''
  if (!href) return html
  const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${esc(href)}" style="display:contents"${ext}>${html}</a>`
}

// Render a node (and a container's whole subtree) with INLINE styles. Used so a
// container's nested children survive the classed export without recursive CSS.
function inlineNode(c) {
  const p = c.props || {}
  const styleStr = styleBlock(c.styles)
  if (c.type === 'container') {
    const kids = (Array.isArray(c.children) ? c.children : []).filter((ch) => !ch.hidden)
    const h = absoluteChildrenHeight(kids, Math.round(c.layout?.h || 160))
    const inner = kids
      .map((ch) => {
        const l = ch.layout || {}
        // Interactive types (accordion/select/tabs) and nested containers need
        // to grow when used — forcing height:100% would clip the open state or
        // pinch nested content. Static types still fill the wrapper exactly.
        const grows = ['accordion', 'select', 'tabs', 'html', 'container'].includes(ch.type)
        const filled = grows
          ? { ...ch, styles: { ...(ch.styles || {}), width: '100%' } }
          : { ...ch, styles: { ...(ch.styles || {}), width: '100%', height: '100%' } }
        const wrapH = grows ? '' : `;height:${Math.round(l.h || 80)}px`
        const wrapMinH = grows ? `;min-height:${Math.round(l.h || 80)}px` : ''
        return `<div style="position:absolute;left:${Math.round(l.x || 0)}px;top:${Math.round(l.y || 0)}px;width:${Math.round(l.w || 200)}px${wrapH}${wrapMinH}">${linkWrap(filled, inlineNode(filled))}</div>`
      })
      .join('')
    return `<div style="display:block;position:relative;min-height:${h}px;${styleStr}">${inner}</div>`
  }
  if (c.type === 'tabs') {
    const tabs = (Array.isArray(p.tabs) ? p.tabs : []).filter((t) => t && t.id)
    const safeTabs = tabs.length ? tabs : [{ id: 't1', label: 'Tab' }]
    const activeId = safeTabs.some((t) => t.id === p.activeId) ? p.activeId : safeTabs[0].id
    const kids = (Array.isArray(c.children) ? c.children : []).filter((ch) => !ch.hidden)
    const strip = safeTabs
      .map(
        (t) =>
          `<button type="button" role="tab" data-builder-tab="${esc(t.id)}" aria-selected="${
            t.id === activeId ? 'true' : 'false'
          }">${esc(t.label || 'Tab')}</button>`,
      )
      .join('')
    const panels = safeTabs
      .map((t) => {
        const panelKids = kids.filter((ch) => (ch.tabId || safeTabs[0].id) === t.id)
        const panelH = absoluteChildrenHeight(panelKids, 120)
        const inner = panelKids
          .map((ch) => {
            const l = ch.layout || {}
            const filled = {
              ...ch,
              styles: { ...(ch.styles || {}), width: '100%', height: '100%' },
            }
            return `<div style="position:absolute;left:${Math.round(l.x || 0)}px;top:${Math.round(l.y || 0)}px;width:${Math.round(l.w || 200)}px;height:${Math.round(l.h || 80)}px">${linkWrap(filled, inlineNode(filled))}</div>`
          })
          .join('')
        const hidden = t.id === activeId ? '' : ' hidden'
        return `<div role="tabpanel" data-builder-panel="${esc(t.id)}"${hidden} style="display:block;position:relative;min-height:${panelH}px">${inner}</div>`
      })
      .join('')
    return `<div data-builder-tabs="${esc(c.id)}" style="display:flex;flex-direction:column;${tabsCssVars(p)};${styleStr}"><div role="tablist">${strip}</div>${panels}</div>`
  }
  if (c.type === 'select') {
    const opts = String(p.options || '').split('\n').map((s) => s.trim()).filter(Boolean)
    return `<label style="display:flex;flex-direction:column;gap:6px;min-width:0;${styleStr}">${
      p.label ? `<span style="font-weight:600">${esc(p.label)}</span>` : ''
    }<select style="${controlFieldCss(p)}">${
      p.placeholder ? `<option value="" disabled selected>${esc(p.placeholder)}</option>` : ''
    }${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`
  }
  if (c.type === 'alert') {
    const v = ALERT_VARIANTS[p.variant] || ALERT_VARIANTS.info
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;border:1px solid ${v.border};background:${v.bg};color:${v.color};${styleStr}">${iconSvg(p.icon || 'check')}<span>${esc(p.text)}</span></div>`
  }
  if (c.type === 'accordion') {
    return `<details style="border:1px solid #e5e7eb;border-radius:10px;padding:2px 16px;${styleStr}"><summary style="cursor:pointer;font-weight:600;padding:12px 0">${esc(p.title)}</summary><div style="padding-bottom:14px;color:#4b5563">${esc(p.text)}</div></details>`
  }
  if (c.type === 'html') {
    const code = typeof p.code === 'string' ? p.code : ''
    const doc = htmlEmbedDocument(code)
    const h = Math.max(40, Math.round(c.layout?.h || 240))
    // withBuilderInteractiveHtml layers on the anchor-interceptor so `<a href="#">`
    // inside the user's snippet scrolls instead of navigating the sandboxed
    // iframe to `about:srcdoc#` (which whites it out without allow-same-origin).
    const safe = withBuilderInteractiveHtml(doc).replace(/"/g, '&quot;')
    return `<iframe srcdoc="${safe}" scrolling="no" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals" loading="lazy" style="display:block;width:100%;height:${h}px;border:0;background:transparent;${styleStr};overflow:hidden"></iframe>`
  }
  const tag = tagFor(c.type)
  const base = baseRules(c.type)
  if (tag === 'img') {
    const src = sanitizeImageSrc(p.src)
    return `<img src="${esc(src)}" alt="${esc(p.alt)}" style="${base} ${styleStr} max-width:100%;" />`
  }
  return `<${tag}${c.type === 'icon' ? iconA11yAttrs(p) : ''} style="${base} ${styleStr}">${innerHtml(c)}</${tag}>`
}

function tagFor(type) {
  if (type === 'button' || type === 'linkbutton') return 'a'
  if (type === 'image') return 'img'
  if (type === 'navbar') return 'nav'
  if (type === 'section') return 'section'
  if (type === 'quote') return 'blockquote'
  if (type === 'badge' || type === 'icon') return 'span'
  if (type === 'input') return 'label'
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
      return `<div class="nav-inner">\n        <span class="brand">${esc(p.brand)}</span>\n        <div class="links">\n          ${items}\n        </div>\n      </div>`
    }
    case 'heading': {
      const lvl = ['h1', 'h2', 'h3'].includes(p.level) ? p.level : 'h2'
      return `<${lvl} class="m0">${esc(p.text)}</${lvl}>`
    }
    case 'text':
      return `<p class="m0">${esc(p.text)}</p>`
    case 'button':
    case 'linkbutton':
      return iconTextHtml(p)
    case 'section':
      return sectionInnerHtml(p, c.styles || {})
    case 'card':
      return `${p.title ? `<h3 class="card-title">${esc(p.title)}</h3>` : ''}${
        p.text ? `\n      <p class="m0">${esc(p.text)}</p>` : ''
      }`
    case 'list': {
      const items = String(p.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      const tag = p.ordered ? 'ol' : 'ul'
      return `<${tag} style="margin:0;padding-left:1.4em">${items
        .map((it) => `<li style="margin-bottom:6px">${esc(it)}</li>`)
        .join('')}</${tag}>`
    }
    case 'quote':
      return `<p class="m0">${esc(p.text)}</p>${
        p.author
          ? `<footer style="margin-top:8px;font-style:normal;font-size:.85em;opacity:.7">— ${esc(p.author)}</footer>`
          : ''
      }`
    case 'badge':
      return esc(p.text)
    case 'icon':
      return iconSvg(p.name)
    case 'input': {
      const t = ['text', 'email', 'number', 'tel', 'url'].includes(p.inputType) ? p.inputType : 'text'
      return `${
        p.label ? `<span style="font-weight:600">${esc(p.label)}</span>` : ''
      }<input type="${t}" placeholder="${esc(p.placeholder)}" style="${controlFieldCss(p)}" />`
    }
    default:
      return ''
  }
}

function openTag(c) {
  const tag = tagFor(c.type)
  const cls = `c-${c.id}`
  // id lets in-page links (#componentId) scroll to this component.
  const idAttr = ` id="${esc(c.id)}"`
  if (tag === 'a') {
    const href = sanitizeUrl((c.props || {}).href)
    const ext = /^https?:\/\//i.test(href)
      ? ' target="_blank" rel="noopener noreferrer"'
      : ''
    return `<a${idAttr} class="${cls}" href="${esc(href || '#')}"${ext}>`
  }
  if (tag === 'img') {
    const src = sanitizeImageSrc((c.props || {}).src)
    return `<img${idAttr} class="${cls}" src="${esc(src)}" alt="${esc((c.props || {}).alt)}" />`
  }
  if (c.type === 'icon') {
    return `<${tag}${idAttr} class="${cls}"${iconA11yAttrs(c.props || {})}>`
  }
  return `<${tag}${idAttr} class="${cls}">`
}

function pageHtml(page, fileTitle, cssHref = 'styles.css', customJs = '', theme = null) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(fileTitle)}</title>
    <link rel="stylesheet" href="${cssHref}" />
    ${googleFontLinkTag(theme)}
  </head>
  <body>
    <div class="page p-${page.id}">
${pageBody(page)}
    </div>
    ${builderInteractiveTags()}
    ${customJsBlock(customJs)}
  </body>
</html>`
}

function pageBody(page) {
  const comps = Array.isArray(page.components) ? page.components : []
  const canvasW = page.canvasWidth || CANVAS_WIDTH
  return comps
    .map((c) => {
      if (['container', 'tabs', 'select', 'alert', 'accordion', 'html'].includes(c.type)) {
        // Wrap inlineNode types in an outer that mirrors the React Renderer
        // layout: flow mode → flowItemStyle (flex); non-flow → absolute. Without
        // this, top-level container/tabs floated at intrinsic size and the
        // iframe preview looked broken next to the non-Custom-JS path.
        let wrap
        if (page.flowMode) {
          wrap = styleObjectBlock(flowItemStyle(c, 'pc', canvasW))
        } else {
          const l = c.layout || {}
          wrap = `position:absolute;left:${Math.round(l.x || 0)}px;top:${Math.round(l.y || 0)}px;width:${Math.round(l.w || 200)}px;height:${Math.round(l.h || 80)}px`
        }
        return `      <div id="${esc(c.id)}" style="${wrap}">${linkWrap(c, inlineNode(c))}</div>`
      }
      const tag = tagFor(c.type)
      const el =
        tag === 'img'
          ? openTag(c)
          : `${openTag(c)}${innerHtml(c) ? `\n        ${innerHtml(c)}\n      ` : ''}</${tag}>`
      return `      ${linkWrap(c, el)}`
    })
    .join('\n')
}

function pageMinHeight(comps, key, fallback) {
  const bottom = (comps || []).reduce((max, c) => {
    const l = (key === 'mobileLayout' ? c.mobileLayout : c.layout) || {}
    return Math.max(max, (l.y || 0) + (l.h || 0))
  }, 0)
  return Math.max(fallback, bottom + 40)
}

export function schemaToCss(schema, options = {}) {
  const pages = schema?.pages || []
  let css = `/* Auto-generated from your design - read-only. */
${themeVariablesCss(schema?.theme)}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--site-font, system-ui, 'Segoe UI', Roboto, sans-serif); color: var(--site-text, #1d1d1f); background: var(--site-bg, #ffffff); }
.page { position: relative; margin: 0 auto; }
.brand { font-weight: bold; font-size: 18px; }
.nav-inner { display: flex; width: 100%; margin-left: auto; margin-right: auto; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.links { display: flex; gap: 20px; row-gap: 6px; flex-wrap: wrap; }
.links a { color: inherit; text-decoration: none; }
.section-inner { width: 100%; margin-left: auto; margin-right: auto; }
.m0 { margin: 0; font-size: inherit; font-weight: inherit; font-family: inherit; letter-spacing: inherit; line-height: 1.15; overflow-wrap: break-word; word-break: break-word; }
.card-title { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
`
  // Desktop
  for (const page of pages) {
    const comps = page.components || []
    const w = page.canvasWidth || 1000
    css += `\n/* ===== ${page.name} (desktop) ===== */\n`
    if (page.flowMode) {
      css += `.p-${page.id} { width: 100%; min-height: ${flowCanvasHeight(comps, 'pc', w)}px; background: ${cssValue(page.background || '#ffffff')}; display:flex; flex-direction:row; flex-wrap:wrap; align-items:stretch; align-content:flex-start; justify-content:flex-start; gap:${flowGap('pc')}px; padding:0 ${flowSidePad('pc')}px; box-sizing:border-box; }\n`
    } else {
      css += `.p-${page.id} { width: ${w}px; min-height: ${pageMinHeight(comps, 'layout', 600)}px; background: ${cssValue(page.background || '#ffffff')}; }\n`
    }
    for (const c of comps) {
      const l = c.layout || {}
      const hide = c.hidden ? ' display:none;' : ''
      if (page.flowMode) {
        const fixed = FLOW_FIXED_HEIGHT_TYPES.has(c.type)
        css += `.c-${c.id} { ${styleObjectBlock(flowItemStyle(c, 'pc', w))} overflow:${fixed ? 'hidden' : 'visible'}; ${baseRules(c.type)} ${styleBlock(c.styles)}${hide} }\n`
        if (FLOW_FULL_WIDTH_TYPES.has(c.type)) {
          css += `.c-${c.id} > .nav-inner, .c-${c.id} > .section-inner { max-width:${Math.round(c.layout?.w || w)}px; }\n`
        }
      } else {
        css += `.c-${c.id} { position:absolute; left:${l.x || 0}px; top:${l.y || 0}px; width:${l.w || 0}px; height:${l.h || 0}px; ${baseRules(c.type)} ${styleBlock(c.styles)}${hide} }\n`
      }
    }
  }
  // Mobile
  css += `\n@media (max-width: ${MOBILE_BREAKPOINT}px) {\n`
  for (const page of pages) {
    const comps = page.components || []
    const mw = page.mobileWidth || 390
    if (page.flowMode) {
      css += `  .p-${page.id} { width: 100%; min-height: ${flowCanvasHeight(comps, 'mobile', mw)}px; background: ${cssValue(page.backgroundMobile || page.background || '#ffffff')}; gap:${flowGap('mobile')}px; padding:0 ${flowSidePad('mobile')}px; }\n`
    } else {
      css += `  .p-${page.id} { width: ${mw}px; min-height: ${pageMinHeight(comps, 'mobileLayout', 400)}px; background: ${cssValue(page.backgroundMobile || page.background || '#ffffff')}; }\n`
    }
    for (const c of comps) {
      const l = c.mobileLayout || c.layout || {}
      const hide = c.hiddenMobile ? ' display:none;' : ''
      if (page.flowMode) {
        const fixed = FLOW_FIXED_HEIGHT_TYPES.has(c.type)
        css += `  .c-${c.id} { ${styleObjectBlock(flowItemStyle(c, 'mobile', mw))} overflow:${fixed ? 'hidden' : 'visible'};${hide} }\n`
      } else {
        css += `  .c-${c.id} { left:${l.x || 0}px; top:${l.y || 0}px; width:${l.w || 0}px; height:${l.h || 0}px;${hide} }\n`
      }
    }
  }
  css += `  .nav-inner { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 10px; }\n`
  css += `  .links { gap: 16px; row-gap: 6px; }\n`
  css += `}\n`
  if (options.includeCustomCss !== false) css += customCssBlock(schema?.customCss)
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

// A single, self-contained .html file. It preserves the same renderer semantics
// as public preview: absolute pages keep their exact PC/mobile designs and scale
// to the visitor's viewport width; flow pages fill the viewport naturally.
export function schemaToSingleHtml(schema, title = 'My Site') {
  const page = (schema?.pages || [])[0] || {}
  if (!page.flowMode) return schemaToScaledHtml(page, title, schema)

  const css = schemaToCss(
    {
      pages: [page],
      theme: schema?.theme,
      customCss: schema?.customCss,
    },
    { includeCustomCss: false },
  )
  const html = pageHtml(page, title, 'styles.css', schema?.customJs, schema?.theme)
  return html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    `<style>\n${css}${customCssBlock(schema?.customCss)}\n    </style>`,
  )
}

function schemaToScaledHtml(page, title = 'My Site', schema = {}) {
  const comps = page.components || []
  const desktopW = page.canvasWidth || 1000
  const mobileW = page.mobileWidth || 390
  const desktopH = pageMinHeight(comps, 'layout', 600)
  const mobileH = pageMinHeight(comps, 'mobileLayout', 400)
  const desktopBg = cssValue(page.background || '#ffffff')
  const mobileBg = cssValue(page.backgroundMobile || page.background || '#ffffff')
  const cfg = JSON.stringify({
    breakpoint: MOBILE_BREAKPOINT,
    desktop: { w: desktopW, h: desktopH, bg: desktopBg },
    mobile: { w: mobileW, h: mobileH, bg: mobileBg },
  }).replace(/</g, '\\u003c')
  const css = schemaToCss(
    {
      pages: [page],
      theme: schema?.theme,
      customCss: schema?.customCss,
    },
    { includeCustomCss: false },
  )

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    ${googleFontLinkTag(schema?.theme)}
    <style>
${css}
      html, body { width: 100%; min-height: 100%; overflow-x: hidden; }
      body { background: ${desktopBg}; }
      .export-viewport { width: 100%; min-height: 100vh; overflow: hidden; background: ${desktopBg}; }
      .export-stage { position: relative; width: 100%; overflow: hidden; background: inherit; }
      .export-stage .page { margin: 0; transform-origin: top left; }
${customCssBlock(schema?.customCss)}
    </style>
  </head>
  <body>
    <div class="export-viewport">
      <div class="export-stage">
        <div class="page p-${page.id}">
${pageBody(page)}
        </div>
      </div>
    </div>
    <script>
      (function () {
        var cfg = ${cfg};
        var viewport = document.querySelector('.export-viewport');
        var stage = document.querySelector('.export-stage');
        var page = document.querySelector('.page');
        function applyLayout() {
          var screenW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || cfg.desktop.w);
          var mode = screenW <= cfg.breakpoint ? cfg.mobile : cfg.desktop;
          var scale = screenW / mode.w;
          document.body.style.background = mode.bg;
          viewport.style.background = mode.bg;
          stage.style.height = Math.ceil(mode.h * scale) + 'px';
          page.style.width = mode.w + 'px';
          page.style.minHeight = mode.h + 'px';
          page.style.transform = 'scale(' + scale + ')';
        }
        window.addEventListener('resize', applyLayout);
        applyLayout();
      })();
    </script>
    ${builderInteractiveTags()}
    ${customJsBlock(schema?.customJs)}
  </body>
</html>`
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
      content: schemaToSingleHtml(
        { pages: [page], theme: schema?.theme, customCss: schema?.customCss },
        page.name || 'My Site',
      ),
    })
  })
  files.push({
    name: 'schema.json',
    lang: 'json',
    content: JSON.stringify(schema, null, 2),
  })
  return files
}
