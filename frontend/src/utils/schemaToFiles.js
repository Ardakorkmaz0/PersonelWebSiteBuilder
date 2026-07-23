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
import { htmlEmbedDocumentOptions } from './htmlSnippetSizing.js'
import { googleFontLinkTag } from './googleFonts.js'
import {
  absoluteChildrenHeight,
  flowCanvasHeight,
  flowGap,
  flowItemStyle,
  flowSidePad,
  pinnedLayoutStyle,
} from '../components/renderer/layout.js'
import { regionContentWidth, resolveRegionDock } from './regionLayout.js'
import { autoLayoutChildCss, autoLayoutContainerCss } from './autoLayout.js'
import { fixedRailInset } from './railInset.js'
import { navLinkLabel, navbarLinkGap, navbarPlacement } from './navbarLayout.js'

const MOBILE_BREAKPOINT = 768
const FLOW_FULL_WIDTH_TYPES = new Set(['navbar', 'section', 'region', 'divider'])
const FLOW_FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])

function isVerticalNavbar(c) {
  return c?.type === 'navbar' && c.props?.navLayout === 'vertical'
}

// Brand / links placement inside a horizontal navbar, straight from the shared
// rules the React renderer uses — so the published bar arranges itself exactly
// like the edit canvas. Returns CSS for the row and each of its two items.
function navbarPlacementCss(c) {
  if (c?.type !== 'navbar' || (c.props?.navLayout || 'horizontal') !== 'horizontal') return null
  const placed = navbarPlacement(c.props)
  return {
    row: styleObjectBlock(placed.row),
    brand: styleObjectBlock(placed.brand),
    links: styleObjectBlock({ ...placed.links, columnGap: navbarLinkGap(c.props), rowGap: 6 }),
  }
}

function isViewportStretch(c) {
  return c?.type === 'region' || (
    c?.type === 'navbar' && !isVerticalNavbar(c) && c.props?.widthMode !== 'boxed'
  )
}

function isFixedComponent(c) {
  return c?.props?.scrollBehavior === 'fixed'
}

function absoluteWrapperStyle(c, layoutKey = 'layout') {
  const l = c?.[layoutKey] || c?.layout || {}
  return {
    position: 'absolute',
    left: Math.round(l.x || 0),
    top: Math.round(l.y || 0),
    width: Math.round(l.w || 200),
    height: Math.round(l.h || 80),
  }
}

function wrapperStyle(c, viewport, canvasWidth, flowMode, layoutKey = 'layout', railInset = null) {
  // margin:0 FIRST, so any margin the layout itself wants still wins. A
  // component box is placed by left/top, and a browser's default margin on the
  // tag would slide it off that spot: <blockquote> ships `margin: 1em 40px`, so
  // a quote painted 40px right and 20px below its design position on the
  // published page while the editor — where Tailwind's preflight zeroes margins
  // — drew it exactly on the mark. The selection frame was telling the truth and
  // the export was not. Every tag is covered, not just the ones that bite today.
  let base = {
    margin: 0,
    ...(flowMode ? flowItemStyle(c, viewport, canvasWidth) : absoluteWrapperStyle(c, layoutKey)),
  }
  if (!flowMode && isViewportStretch(c)) {
    base = { ...base, left: 0, width: '100%' }
  } else if (!flowMode) {
    base = { ...base, left: `calc(var(--design-offset, 0px) + ${Math.round(Number(base.left) || 0)}px)` }
  }
  // Sticky on an ABSOLUTE page: native position:sticky needs a flow position,
  // which absolute pages don't have — the element would render at the page top
  // instead of its design spot. Keep the absolute design position and let the
  // runtime stick handler (data-builder-sticky) translate it on scroll.
  if (!flowMode && c?.props?.scrollBehavior === 'sticky') {
    return { ...base, zIndex: Number(c.props?.pinZIndex) || 20 }
  }
  return pinnedLayoutStyle(c, base, railInset)
}

// Marker attributes for the runtime stick handler in builderInteractiveTags().
function stickyAttrs(c, flowMode) {
  if (flowMode || c?.props?.scrollBehavior !== 'sticky') return ''
  const edge = c.props?.pinY === 'bottom' ? ' data-builder-sticky-edge="bottom"' : ''
  return ` data-builder-sticky data-builder-sticky-offset="${Number(c.props?.pinOffsetY) || 0}"${edge}`
}

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  )
}

// Preserve deliberate line breaks from textareas without allowing user HTML.
function multiline(s) {
  return esc(s).replace(/\r?\n/g, '<br>')
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
    // Unitless CSS properties. `order` belongs here: emitting `order: 1px` is
    // invalid, the browser drops the whole declaration, and a navbar asked to
    // put its brand after its links silently kept the original order on the
    // published page while the editor swapped them.
    return ['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'order', 'flexGrow', 'flexShrink'].includes(key)
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
  return `${icon}<span>${multiline(props.text)}</span>`
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
      ? `<p style="margin:0 0 10px;font-size:.78em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.72">${multiline(props.eyebrow)}</p>`
      : ''
  }${props.heading ? `<h2 class="m0">${multiline(props.heading)}</h2>` : ''}${
    props.text ? `<p class="m0" style="margin-top:${props.heading ? '12px' : '0'};line-height:1.6;opacity:.78">${multiline(props.text)}</p>` : ''
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
// The `display` baseRules gives a type. Needed to UN-hide on mobile: the desktop
// rule's `display:none` for a PC-hidden component would otherwise cascade into
// the media query and hide it on phones too — "Hide on PC" would silently mean
// "hide everywhere", which is the one thing the visibility toggles refuse to do.
function baseDisplay(type) {
  switch (type) {
    case 'navbar':
    case 'heading':
    case 'text':
    case 'section':
    case 'card':
    case 'button':
    case 'linkbutton':
    case 'input':
      return 'flex'
    case 'badge':
    case 'icon':
      return 'inline-flex'
    default:
      return 'block'
  }
}

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
  'button', 'linkbutton', 'navbar', 'section', 'region', 'tabs', 'container', 'accordion', 'select', 'input', 'html',
])

// Types whose CONTENT is serialized with inline styles (see inlineNode). Their
// outer box still gets a `.c-<id>` class and its geometry from the stylesheet —
// an inline layout style here could never be overridden by the mobile media
// query, which used to freeze every embed at its desktop position and size.
// Their own `styles` ride the inner node, so the wrapper rule stays layout-only.
const INLINE_NODE_TYPES = new Set([
  'region', 'container', 'tabs', 'select', 'alert', 'accordion', 'html',
])

function linkWrap(c, html) {
  const href = !NON_WRAP_LINK.has(c.type) ? sanitizeUrl((c.props || {}).href) : ''
  if (!href) return html
  const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${esc(href)}" style="display:contents"${ext}>${html}</a>`
}

function regionChildInlineStyle(child, designWidth) {
  const layout = child.layout || {}
  const x = Math.max(0, Math.round(layout.x || 0))
  const y = Math.max(0, Math.round(layout.y || 0))
  const w = Math.max(8, Math.round(layout.w || 200))
  const h = Math.max(4, Math.round(layout.h || 80))
  const dock = resolveRegionDock(child, designWidth)
  const right = Math.max(0, designWidth - x - w)
  const offset = Math.round(x + w / 2 - designWidth / 2)
  const base = `position:absolute;top:${y}px;height:${h}px;`
  if (dock === 'right') return `${base}right:${right}px;width:${w}px;max-width:calc(100% - ${right}px);`
  if (dock === 'center') return `${base}left:calc(50% + ${offset}px);width:${w}px;max-width:100%;transform:translateX(-50%);`
  if (dock === 'stretch') return `${base}left:${x}px;right:${right}px;width:auto;`
  return `${base}left:${x}px;width:${w}px;max-width:calc(100% - ${x}px);`
}

// Render a node (and a container's whole subtree) with INLINE styles. Used so a
// container's nested children survive the classed export without recursive CSS.
// `classedChildren` says a stylesheet already carries this region's per-child
// geometry (see regionChildCss), so the inline copy is dropped and the mobile
// media query can reposition the children. Only top-level regions get those
// rules; a region nested inside a container keeps the inline fallback.
function inlineNode(c, classedChildren = false) {
  const p = c.props || {}
  const styleStr = styleBlock(c.styles)
  if (c.type === 'region') {
    const kids = (Array.isArray(c.children) ? c.children : []).filter((ch) => !ch.hidden)
    const designW = regionContentWidth(c)
    const inner = kids.map((ch) => {
      const filled = { ...ch, styles: { ...(ch.styles || {}), width: '100%', height: '100%' } }
      const geometry = classedChildren ? '' : ` style="${regionChildInlineStyle(ch, designW)}"`
      return `<div class="region-child region-${esc(c.id)}-${esc(ch.id)}"${geometry}>${linkWrap(filled, inlineNode(filled))}</div>`
    }).join('')
    return `<section style="position:relative;width:100%;height:100%;overflow:hidden;${styleStr}"><div class="region-inner" style="position:relative;width:100%;max-width:${designW}px;height:100%;margin:0 auto;overflow:hidden">${inner}</div></section>`
  }
  if (c.type === 'container') {
    const kids = (Array.isArray(c.children) ? c.children : []).filter((ch) => !ch.hidden)
    // Auto-layout: children flow (flex/grid) and reflow on any screen.
    const autoCss = autoLayoutContainerCss(c.props)
    if (autoCss) {
      const inner = kids
        .map((ch) => {
          const filled = { ...ch, styles: { ...(ch.styles || {}), width: '100%' } }
          const childCss = autoLayoutChildCss(ch, c.props)
          return `<div style="${childCss}">${linkWrap(filled, inlineNode(filled))}</div>`
        })
        .join('')
      return `<div style="${autoCss};${styleStr}">${inner}</div>`
    }
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
          }">${multiline(t.label || 'Tab')}</button>`,
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
      p.label ? `<span style="font-weight:600">${multiline(p.label)}</span>` : ''
    }<select style="${controlFieldCss(p)}">${
      p.placeholder ? `<option value="" disabled selected>${esc(p.placeholder)}</option>` : ''
    }${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`
  }
  if (c.type === 'alert') {
    const v = ALERT_VARIANTS[p.variant] || ALERT_VARIANTS.info
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;border:1px solid ${v.border};background:${v.bg};color:${v.color};${styleStr}">${iconSvg(p.icon || 'check')}<span>${multiline(p.text)}</span></div>`
  }
  if (c.type === 'accordion') {
    return `<details style="border:1px solid #e5e7eb;border-radius:10px;padding:2px 16px;${styleStr}"><summary style="cursor:pointer;font-weight:600;padding:12px 0">${multiline(p.title)}</summary><div style="padding-bottom:14px;color:#4b5563">${multiline(p.text)}</div></details>`
  }
  if (c.type === 'html') {
    const code = typeof p.code === 'string' ? p.code : ''
    const doc = htmlEmbedDocument(code, htmlEmbedDocumentOptions(c))
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
  if (type === 'region') return 'section'
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
      const layout = ['vertical', 'centered', 'twoRow'].includes(p.navLayout) ? p.navLayout : 'horizontal'
      const items = links
        .map((l) => {
          const href = sanitizeUrl(l.href)
          const ext = /^https?:\/\//i.test(href)
            ? ' target="_blank" rel="noopener noreferrer"'
            : ''
          return `<a href="${esc(href || '#')}"${ext}>${esc(navLinkLabel(l.label))}</a>`
        })
        .join('\n        ')
      const mobileMode = p.mobileNavMode === 'stack' ? 'stack' : 'menu'
      const menuBackground = cssValue(c.styles?.backgroundColor || '#1d1d1f')
      return `<div class="nav-inner nav-${layout} nav-mobile-${mobileMode}" data-builder-mobile-nav style="--builder-nav-menu-bg:${menuBackground}">\n        <span class="brand">${multiline(p.brand)}</span>\n        <button type="button" class="mobile-nav-toggle" data-builder-mobile-nav-toggle aria-label="Open navigation menu" aria-expanded="false">☰</button>\n        <div class="links">\n          ${items}\n        </div>\n      </div>`
    }
    case 'heading': {
      const lvl = ['h1', 'h2', 'h3'].includes(p.level) ? p.level : 'h2'
      return `<${lvl} class="m0">${multiline(p.text)}</${lvl}>`
    }
    case 'text':
      return `<p class="m0">${multiline(p.text)}</p>`
    case 'button':
    case 'linkbutton':
      return iconTextHtml(p)
    case 'section':
      return sectionInnerHtml(p, c.styles || {})
    case 'card':
      return `${p.title ? `<h3 class="card-title">${multiline(p.title)}</h3>` : ''}${
        p.text ? `\n      <p class="m0">${multiline(p.text)}</p>` : ''
      }`
    case 'list': {
      const items = String(p.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      const tag = p.ordered ? 'ol' : 'ul'
      return `<${tag} style="margin:0;padding-left:1.4em">${items
        .map((it) => `<li style="margin-bottom:6px">${esc(it)}</li>`)
        .join('')}</${tag}>`
    }
    case 'quote':
      return `<p class="m0">${multiline(p.text)}</p>${
        p.author
          ? `<footer style="margin-top:8px;font-style:normal;font-size:.85em;opacity:.7">— ${multiline(p.author)}</footer>`
          : ''
      }`
    case 'badge':
      return multiline(p.text)
    case 'icon':
      return iconSvg(p.name)
    case 'input': {
      const t = ['text', 'email', 'number', 'tel', 'url'].includes(p.inputType) ? p.inputType : 'text'
      return `${
        p.label ? `<span style="font-weight:600">${multiline(p.label)}</span>` : ''
      }<input type="${t}" placeholder="${esc(p.placeholder)}" style="${controlFieldCss(p)}" />`
    }
    default:
      return ''
  }
}

function openTag(c, extraAttrs = '') {
  const tag = tagFor(c.type)
  const cls = `c-${c.id}`
  // id lets in-page links (#componentId) scroll to this component.
  const idAttr = ` id="${esc(c.id)}"${extraAttrs}`
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

function pageBody(page, { fixed = 'all' } = {}) {
  const comps = Array.isArray(page.components) ? page.components : []
  return comps
    .filter((c) => {
      const isFixed = isFixedComponent(c)
      if (fixed === 'only') return isFixed
      if (fixed === 'exclude') return !isFixed
      return true
    })
    .map((c) => {
      const sticky = stickyAttrs(c, page.flowMode)
      if (INLINE_NODE_TYPES.has(c.type)) {
        // Wrap inlineNode types in an outer that mirrors the React Renderer
        // layout: flow mode → flowItemStyle (flex); non-flow → absolute. Without
        // this, top-level container/tabs floated at intrinsic size and the
        // iframe preview looked broken next to the non-Custom-JS path. The box
        // is positioned by its `.c-<id>` rule, exactly like every other type, so
        // the mobile breakpoint can move and resize it.
        return `      <div id="${esc(c.id)}" class="c-${esc(c.id)}"${sticky}>${linkWrap(c, inlineNode(c, c.type === 'region'))}</div>`
      }
      const tag = tagFor(c.type)
      const el =
        tag === 'img'
          ? openTag(c, sticky)
          : `${openTag(c, sticky)}${innerHtml(c) ? `\n        ${innerHtml(c)}\n      ` : ''}</${tag}>`
      return `      ${linkWrap(c, el)}`
    })
    .join('\n')
}

function pageMinHeight(comps, key, fallback) {
  const bottom = (comps || []).reduce((max, c) => {
    if (isFixedComponent(c)) return max
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
.mobile-nav-toggle { display: none; appearance: none; width: 36px; height: 36px; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid currentColor; border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 20px; line-height: 1; cursor: pointer; }
.links { display: flex; gap: 20px; row-gap: 6px; flex-wrap: wrap; }
.links a { color: inherit; text-decoration: none; }
.nav-vertical { height: 100%; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 14px; }
.nav-vertical .links { width: 100%; flex-direction: column; align-items: stretch; gap: 6px; }
.nav-vertical .links a { display: block; width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; }
.nav-centered { flex-direction: column; justify-content: flex-start; text-align: center; gap: 10px; }
.nav-centered .links { justify-content: center; }
.nav-twoRow { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 10px; }
.nav-twoRow .links { width: 100%; }
.section-inner { width: 100%; margin-left: auto; margin-right: auto; }
.region-inner { width: 100%; margin-left: auto; margin-right: auto; }
.m0 { margin: 0; font-size: inherit; font-weight: inherit; font-family: inherit; letter-spacing: inherit; line-height: 1.15; overflow-wrap: break-word; word-break: break-word; }
.card-title { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
`
  // Desktop
  for (const page of pages) {
    const comps = page.components || []
    const w = page.canvasWidth || 1000
    // A fixed side rail insets any fixed full-width top bar, so the bar's brand
    // never disappears under the rail (and lands identically at every width).
    const railInset = page.flowMode ? null : fixedRailInset(comps)
    css += `\n/* ===== ${page.name} (desktop) ===== */\n`
    if (page.flowMode) {
      css += `.p-${page.id} { width: 100%; min-height: ${flowCanvasHeight(comps, 'pc', w)}px; background: ${cssValue(page.background || '#ffffff')}; display:flex; flex-direction:row; flex-wrap:wrap; align-items:stretch; align-content:flex-start; justify-content:flex-start; gap:${flowGap('pc')}px; padding:0 ${flowSidePad('pc')}px; box-sizing:border-box; }\n`
    } else {
      css += `.p-${page.id} { --design-offset:max(0px, calc((100% - ${w}px) / 2)); width: ${w}px; min-height: ${pageMinHeight(comps, 'layout', 600)}px; background: ${cssValue(page.background || '#ffffff')}; }\n`
    }
    for (const c of comps) {
      const hide = c.hidden ? ' display:none;' : ''
      const placed = navbarPlacementCss(c)
      // inlineNode types paint their own look on the inner node; repeating it on
      // the wrapper would apply padding and borders twice.
      const own = INLINE_NODE_TYPES.has(c.type) ? '' : `${baseRules(c.type)} ${styleBlock(c.styles)}`
      if (page.flowMode) {
        const fixed = FLOW_FIXED_HEIGHT_TYPES.has(c.type)
        css += `.c-${c.id} { ${styleObjectBlock(wrapperStyle(c, 'pc', w, true))} overflow:${fixed ? 'hidden' : 'visible'}; ${own}${hide} }\n`
        if (FLOW_FULL_WIDTH_TYPES.has(c.type) && !isVerticalNavbar(c)) {
          css += `.c-${c.id} > .nav-inner, .c-${c.id} > .section-inner { max-width:${Math.round(Number(c.props?.contentWidth) || c.layout?.w || w)}px; }\n`
        }
        if (placed) {
          if (placed.row) css += `.c-${c.id} > .nav-inner { ${placed.row} }\n`
          if (placed.brand) css += `.c-${c.id} > .nav-inner > .brand { ${placed.brand} }\n`
          if (placed.links) css += `.c-${c.id} > .nav-inner > .links { ${placed.links} }\n`
        }
      } else {
        css += `.c-${c.id} { ${styleObjectBlock(wrapperStyle(c, 'pc', w, false, 'layout', railInset))} ${own}${hide} }\n`
        if (c.type === 'navbar' && !isVerticalNavbar(c)) {
          css += `.c-${c.id} > .nav-inner { max-width:${Math.round(Number(c.props?.contentWidth) || c.layout?.w || w)}px; }\n`
        }
        if (placed) {
          if (placed.row) css += `.c-${c.id} > .nav-inner { ${placed.row} }\n`
          if (placed.brand) css += `.c-${c.id} > .nav-inner > .brand { ${placed.brand} }\n`
          if (placed.links) css += `.c-${c.id} > .nav-inner > .links { ${placed.links} }\n`
        }
      }
      // Desktop geometry for a section's free-placed children, so the mobile
      // block below (which reflows them into the phone's width) has something to
      // override. Inline styles here could not be overridden at all.
      if (c.type === 'region') {
        const designW = regionContentWidth(c)
        for (const child of c.children || []) {
          css += `.region-${esc(c.id)}-${esc(child.id)} { ${regionChildInlineStyle(child, designW)} }\n`
        }
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
      css += `  .p-${page.id} { --design-offset:max(0px, calc((100% - ${mw}px) / 2)); width: ${mw}px; min-height: ${pageMinHeight(comps, 'mobileLayout', 400)}px; background: ${cssValue(page.backgroundMobile || page.background || '#ffffff')}; }\n`
    }
    for (const c of comps) {
      const hide = c.hiddenMobile
        ? ' display:none;'
        : c.hidden
          ? ` display:${baseDisplay(c.type)};`
          : ''
      // Per-breakpoint style overrides (stylesMobile) ride the same media
      // block — the cascade merges them over the desktop rule above. Skipped for
      // inlineNode types for the same reason their desktop `styles` are: the
      // look lives on the inner node, not on this wrapper.
      const mobileStyles =
        c.stylesMobile && !INLINE_NODE_TYPES.has(c.type) ? ` ${styleBlock(c.stylesMobile)}` : ''
      if (page.flowMode) {
        const fixed = FLOW_FIXED_HEIGHT_TYPES.has(c.type)
        css += `  .c-${c.id} { ${styleObjectBlock(wrapperStyle(c, 'mobile', mw, true))} overflow:${fixed ? 'hidden' : 'visible'};${mobileStyles}${hide} }\n`
      } else {
        css += `  .c-${c.id} { ${styleObjectBlock(wrapperStyle(c, 'mobile', mw, false, 'mobileLayout'))}${mobileStyles}${hide} }\n`
        // An embed's iframe is written with the desktop height baked in (flow
        // pages have no fixed box to fill, so it can't just be 100%). On an
        // absolute page the phone box has its own height — resize the iframe to
        // match, or the embed keeps its PC height inside a taller mobile frame.
        if (c.type === 'html') {
          const mh = Math.max(40, Math.round((c.mobileLayout || c.layout || {}).h || 240))
          css += `  .c-${c.id} > iframe { height:${mh}px; }\n`
        }
      }
      if (c.type === 'region') {
        for (const child of c.children || []) {
          const layout = child.mobileLayout || child.layout || {}
          const rawX = Math.max(0, Math.round(layout.x || 0))
          const childX = Math.min(rawX, Math.max(0, mw - 8))
          const childWidth = Math.min(Math.max(8, Math.round(layout.w || 200)), Math.max(8, mw - childX))
          css += `  .region-${esc(c.id)}-${esc(child.id)} { left:${childX}px;right:auto;top:${Math.max(0, Math.round(layout.y || 0))}px;width:${childWidth}px;height:${Math.max(4, Math.round(layout.h || 80))}px;max-width:100%;transform:none;${child.hiddenMobile ? 'display:none;' : ''} }\n`
        }
      }
    }
  }
  css += `  .nav-inner:not(.nav-vertical):not(.nav-mobile-stack) { position:relative; flex-direction:row; align-items:center; justify-content:space-between; gap:10px; flex-wrap:nowrap; }\n`
  css += `  .nav-inner:not(.nav-vertical):not(.nav-mobile-stack) .mobile-nav-toggle { display:inline-flex; }\n`
  css += `  .nav-inner:not(.nav-vertical):not(.nav-mobile-stack) .links { display:none; position:absolute; z-index:100; top:calc(100% + 8px); left:0; right:0; width:100%; flex-direction:column; align-items:stretch; gap:6px; padding:10px; border:1px solid currentColor; border-radius:10px; background:var(--builder-nav-menu-bg,#1d1d1f); box-shadow:0 12px 28px rgba(0,0,0,.2); }\n`
  css += `  .nav-inner:not(.nav-vertical):not(.nav-mobile-stack)[data-mobile-open="true"] .links { display:flex; }\n`
  css += `  .nav-inner:not(.nav-vertical):not(.nav-mobile-stack) .links a { display:block; width:100%; padding:10px 12px; border-radius:8px; }\n`
  css += `  .nav-mobile-stack { flex-direction:column; align-items:flex-start; justify-content:flex-start; gap:10px; }\n`
  css += `  .nav-mobile-stack .links { gap:16px; row-gap:6px; }\n`
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
export function schemaToSingleHtml(schema, title = 'My Site', options = {}) {
  const page = (schema?.pages || [])[0] || {}
  if (!page.flowMode) return schemaToScaledHtml(page, title, schema, options)

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

// The editor's phone mockup asks for this: a desktop iframe paints a classic
// scrollbar that EATS layout width, so a 360px design would really get ~345 and
// the preview would disagree with the edit canvas — and a real phone shows no
// such bar anyway. Preview-only; the published page keeps normal scrollbars.
function overlayScrollbarCss(options = {}) {
  if (!options.overlayScrollbars) return ''
  return `      html { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar { width: 0; height: 0; }
`
}

function schemaToScaledHtml(page, title = 'My Site', schema = {}, options = {}) {
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
  const fixedBody = pageBody(page, { fixed: 'only' })

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
      .export-stage { position: relative; display: flex; justify-content: center; width: 100%; overflow: hidden; background: inherit; }
      .export-stage .page { flex: 0 0 auto; margin: 0; transform-origin: top center; }
      .export-fixed { position: fixed; left: 0; top: 0; width: ${desktopW}px; height: 100vh; transform: scale(1); transform-origin: top left; pointer-events: none; z-index: 2147483000; }
      .export-fixed > * { pointer-events: auto; }
${overlayScrollbarCss(options)}${customCssBlock(schema?.customCss)}
    </style>
  </head>
  <body>
    <div class="export-viewport">
      <div class="export-stage">
        <div class="page p-${page.id}">
${pageBody(page, { fixed: 'exclude' })}
        </div>
      </div>
${fixedBody ? `      <div class="export-fixed">\n${fixedBody}\n      </div>` : ''}
    </div>
    <script>
      (function () {
        var cfg = ${cfg};
        var viewport = document.querySelector('.export-viewport');
        var stage = document.querySelector('.export-stage');
        var page = document.querySelector('.page');
        var fixedLayer = document.querySelector('.export-fixed');
        function applyLayout() {
          var screenW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || cfg.desktop.w);
          var screenH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || cfg.desktop.h);
          var mode = screenW <= cfg.breakpoint ? cfg.mobile : cfg.desktop;
          var renderW = Math.max(screenW, mode.w);
          var scale = Math.min(1, screenW / mode.w);
          var left = Math.max(0, (screenW - renderW * scale) / 2);
          document.body.style.background = mode.bg;
          viewport.style.background = mode.bg;
          stage.style.height = Math.ceil(mode.h * scale) + 'px';
          page.style.width = renderW + 'px';
          page.style.minHeight = mode.h + 'px';
          page.style.transform = 'scale(' + scale + ')';
          if (fixedLayer) {
            fixedLayer.style.left = Math.round(left) + 'px';
            fixedLayer.style.width = renderW + 'px';
            fixedLayer.style.height = Math.ceil(screenH / scale) + 'px';
            fixedLayer.style.transform = 'scale(' + scale + ')';
            fixedLayer.style.setProperty('--design-offset', Math.max(0, (renderW - mode.w) / 2) + 'px');
          }
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
