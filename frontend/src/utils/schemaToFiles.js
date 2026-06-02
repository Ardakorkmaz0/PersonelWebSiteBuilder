// Turns the design schema into a small read-only "project" of files: one
// self-contained .html per page plus schema.json.
//
// This is for DISPLAY (the VS Code-style code panel) and export. It never runs
// user input: text is HTML-escaped, URLs go through sanitizeUrl, style keys are
// whitelisted by sanitizeStyles, and CSS values are stripped of `;{}<` so a
// value can't break out of its rule.
import { sanitizeStyles, sanitizeUrl } from './sanitize.js'
import { customCssBlock, themeVariablesCss } from './theme.js'
import {
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
      return esc(p.text)
    case 'section':
      return `<div class="section-inner">${p.heading ? `<h2 class="m0">${esc(p.heading)}</h2>` : ''}</div>`
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
${pageBody(page)}
    </div>
  </body>
</html>`
}

function pageBody(page) {
  const comps = Array.isArray(page.components) ? page.components : []
  return comps
    .map((c) => {
      const tag = tagFor(c.type)
      if (tag === 'img') return `      ${openTag(c)}`
      const inner = innerHtml(c)
      return `      ${openTag(c)}${inner ? `\n        ${inner}\n      ` : ''}</${tag}>`
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
  const html = pageHtml(page, title)
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
