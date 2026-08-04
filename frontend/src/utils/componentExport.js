// Lifting one component off a page so it can live on somebody else's.
//
// This is the part the whole sharing idea rests on. A block that arrives at its
// new home looking like a naked <ul> is worse than no feature at all, so the
// job here is not "copy the HTML" — it is to work out everything that decides
// how this element looks and bring exactly that, and nothing else.
//
// Four things travel:
//   markup    the subtree, with the editor's own chrome stripped
//   css       ONLY the rules that match it, scoped so it cannot collide
//   fonts     the families it actually renders in, by name
//   assets    images, with relative URLs resolved against the source site
//
// And one thing does not: behaviour. A shared block runs on a stranger's site
// in front of their visitors, so scripts are refused rather than sanitised —
// see auditSharedHtml. The sandbox the published page uses (allow-scripts
// without allow-same-origin) stops a script reading the host's data, but it
// does not stop a convincing fake login form, and that is the risk that
// actually matters when the author is not the site owner.

import { cleanElementHtml } from './elementSpotlight.js'

// Every scoped rule carries this, so two copies of the same shared block on one
// page cannot fight, and neither can the host's own `.card`.
export const SHARED_SCOPE_ATTR = 'data-pwb-shared'

// Text-ish properties whose value can pull in a font we have to name.
const FONT_PROPS = ['font-family', 'font']

// ---------------------------------------------------------------------------
// Selector matching
// ---------------------------------------------------------------------------

// `.btn:hover` never matches an element that is not being hovered, and
// `.card::after` matches nothing at all — but both style the block and both
// have to come along. Match on the selector with its states removed.
export function matchableSelector(selector) {
  return String(selector || '')
    .replace(/::?[a-z-]+(\([^)]*\))?/gi, (match) => (
      // Structural pseudo-classes are part of what an element IS, so they stay;
      // state and element pseudos are dropped.
      /^:(not|is|where|has|nth-child|nth-of-type|first-child|last-child|only-child|first-of-type|last-of-type)\b/i.test(match)
        ? match
        : ''
    ))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Does this selector style the root or anything inside it?
function selectorTouches(scope, selector) {
  const probe = matchableSelector(selector)
  if (!probe) return false
  for (const part of probe.split(',')) {
    const one = part.trim()
    if (!one) continue
    try {
      if (scope.root.matches(one)) return true
      if (scope.root.querySelector(one)) return true
    } catch {
      // An invalid or unsupported selector is not a reason to lose the export.
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Used-CSS collection
// ---------------------------------------------------------------------------

function ruleTextFor(rule, scope, seen) {
  // A plain style rule: keep it when it touches the subtree.
  if (rule.type === CSSRule.STYLE_RULE) {
    if (!selectorTouches(scope, rule.selectorText)) return ''
    noteUsage(rule, seen)
    return rule.cssText
  }
  // @media / @supports: keep the wrapper only if something inside it matched,
  // because the responsive behaviour is part of the component.
  if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
    const inner = [...(rule.cssRules || [])]
      .map((child) => ruleTextFor(child, scope, seen))
      .filter(Boolean)
    if (!inner.length) return ''
    const condition = rule.type === CSSRule.MEDIA_RULE
      ? `@media ${rule.conditionText || rule.media?.mediaText || 'all'}`
      : `@supports ${rule.conditionText}`
    return `${condition} {\n${inner.join('\n')}\n}`
  }
  return ''
}

// Remember the animations, fonts and custom properties a kept rule depends on,
// so their definitions can be collected afterwards. Missing these is how an
// exported block arrives without its animation or in the wrong typeface.
function noteUsage(rule, seen) {
  const style = rule.style
  if (!style) return
  const animation = `${style.animationName || ''} ${style.animation || ''}`
  animation.split(/[\s,]+/).filter(Boolean).forEach((name) => seen.animations.add(name))
  for (const prop of FONT_PROPS) {
    const value = style.getPropertyValue(prop)
    if (value) seen.fontValues.add(value)
  }
  for (const variable of String(rule.cssText || '').matchAll(/var\(\s*(--[\w-]+)/g)) {
    seen.variables.add(variable[1])
  }
}

// The custom properties a kept rule reads have to be defined somewhere, and
// that somewhere is usually :root — which is NOT part of the subtree, so it
// would otherwise be dropped and every colour would fall back to nothing.
function collectVariables(sheets, seen) {
  const found = new Map()
  let pass = 0
  // A variable can be defined in terms of another; two passes covers the
  // nesting real stylesheets actually use.
  while (pass < 2 && seen.variables.size > found.size) {
    pass += 1
    for (const rules of sheets) {
      for (const rule of rules) {
        if (rule.type !== CSSRule.STYLE_RULE || !rule.style) continue
        for (const name of seen.variables) {
          if (found.has(name)) continue
          const value = rule.style.getPropertyValue(name)
          if (!value) continue
          found.set(name, value.trim())
          for (const nested of value.matchAll(/var\(\s*(--[\w-]+)/g)) seen.variables.add(nested[1])
        }
      }
    }
  }
  return found
}

function collectAtRules(sheets, seen) {
  const out = []
  for (const rules of sheets) {
    for (const rule of rules) {
      if (rule.type === CSSRule.KEYFRAMES_RULE && seen.animations.has(rule.name)) {
        out.push(rule.cssText)
      }
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        const family = (rule.style?.getPropertyValue('font-family') || '').replace(/['"]/g, '').trim()
        if (family && [...seen.fontValues].some((value) => value.includes(family))) out.push(rule.cssText)
      }
    }
  }
  return out
}

// Every readable rule in the document, flattened per sheet. A cross-origin
// sheet throws on access — that is expected for Google Fonts and is reported
// rather than swallowed, because it changes what the author should be told.
function readableSheets(doc) {
  const sheets = []
  const blocked = []
  for (const sheet of doc?.styleSheets || []) {
    try {
      sheets.push([...(sheet.cssRules || [])])
    } catch {
      blocked.push(sheet.href || 'inline')
    }
  }
  return { sheets, blocked }
}

// ---------------------------------------------------------------------------
// Scoping
// ---------------------------------------------------------------------------

// Prefix every selector so the rules can only ever reach this block. Both forms
// are emitted because the root itself may be the thing being styled:
//   .menu  →  [scope].menu, [scope] .menu
export function scopeSelector(selector, scopeValue) {
  const scope = `[${SHARED_SCOPE_ATTR}="${scopeValue}"]`
  return String(selector || '')
    .split(',')
    .map((part) => {
      const one = part.trim()
      if (!one) return ''
      // A selector already rooted at html/body/:root becomes the scope itself —
      // page-level rules must not escape onto the host's page.
      if (/^(html|body|:root)\b/i.test(one)) {
        return one.replace(/^(html|body|:root)/i, scope)
      }
      return `${scope}${one}, ${scope} ${one}`
    })
    .filter(Boolean)
    .join(', ')
}

// Walk the collected CSS text and scope every selector in it, including the
// ones nested inside @media / @supports.
export function scopeCss(css, scopeValue) {
  return String(css || '').replace(
    /(^|\}|\{|\n)\s*([^{}@]+?)\s*\{/g,
    (match, lead, selector) => {
      // Declarations inside a keyframe step (`0% {`) are not selectors.
      if (/^\d+%$|^(from|to)$/i.test(selector.trim())) return match
      return `${lead}\n${scopeSelector(selector, scopeValue)} {`
    },
  )
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

// A relative `/media/photo.jpg` means nothing on another domain. Resolve
// against the source page so the image still loads, and report anything that
// cannot travel — a silently broken image is the worst outcome here.
export function absoluteAssetUrl(value, baseUrl) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^(data:|https?:|\/\/)/i.test(raw)) return raw
  if (/^(javascript|vbscript|file):/i.test(raw)) return ''
  try {
    return new URL(raw, baseUrl).href
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

// What a shared block may not contain. These are REFUSALS, not fixes: a block
// that quietly loses its form action is a block that behaves differently for
// the person who shared it than for the person who takes it.
export function auditSharedHtml(root, { allowScripts = false } = {}) {
  const problems = []
  const add = (kind, detail) => problems.push({ kind, detail })
  const nodes = [root, ...root.querySelectorAll('*')]

  for (const node of nodes) {
    const tag = node.tagName?.toLowerCase()
    if (!allowScripts && tag === 'script') add('script', 'A <script> tag')
    if (tag === 'iframe') add('iframe', `An <iframe> (${node.getAttribute('src') || 'no src'})`)
    if (tag === 'object' || tag === 'embed') add('embed', `A <${tag}> element`)

    for (const attr of node.attributes || []) {
      const name = attr.name.toLowerCase()
      if (!allowScripts && name.startsWith('on')) add('handler', `${name} on <${tag}>`)
      if (/^(href|src|action|formaction)$/.test(name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(attr.value)) {
        add('url', `${name}="${attr.value.slice(0, 40)}…"`)
      }
    }

    if (tag === 'form') {
      const action = (node.getAttribute('action') || '').trim()
      // A form posting somewhere else is the phishing shape, and it is the one
      // the iframe sandbox does nothing about.
      if (action && !action.startsWith('#')) add('form', `A form posting to ${action.slice(0, 60)}`)
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// The export
// ---------------------------------------------------------------------------

let scopeCounter = 0

export function nextScopeId() {
  scopeCounter += 1
  return `s${Date.now().toString(36)}${scopeCounter.toString(36)}`
}

// Turn one element into a block that can stand on its own somewhere else.
// Returns { ok, html, css, fonts, assets, warnings, problems, scope, size }.
// `ok:false` means the policy refused it — the caller shows `problems` and the
// author decides what to change, rather than us shipping something altered.
export function exportComponent(doc, el, { allowScripts = false, scope = nextScopeId() } = {}) {
  if (!doc || !el || el.nodeType !== 1) {
    return { ok: false, problems: [{ kind: 'empty', detail: 'Nothing to share.' }], warnings: [] }
  }
  const view = doc.defaultView
  const baseUrl = doc.baseURI || view?.location?.href || ''
  const warnings = []

  // A clone, always: the page being exported must be untouched by exporting it.
  const holder = doc.createElement('div')
  holder.innerHTML = cleanElementHtml(el)
  const root = holder.firstElementChild
  if (!root) {
    return { ok: false, problems: [{ kind: 'empty', detail: 'Nothing to share.' }], warnings }
  }

  const problems = auditSharedHtml(root, { allowScripts })
  if (problems.length) return { ok: false, problems, warnings, scope }

  // ---- CSS -------------------------------------------------------------
  // Matching runs against the LIVE element, not the clone: the clone is not in
  // the document, so `matches()` on descendant selectors would be answering a
  // different question.
  const { sheets, blocked } = readableSheets(doc)
  if (blocked.length) {
    warnings.push({
      kind: 'blocked-stylesheet',
      detail: `${blocked.length} stylesheet(s) could not be read (cross-origin); fonts are carried by name instead.`,
    })
  }
  const seen = { animations: new Set(), fontValues: new Set(), variables: new Set() }
  const scopeCtx = { root: el }
  const matched = []
  for (const rules of sheets) {
    for (const rule of rules) {
      const text = ruleTextFor(rule, scopeCtx, seen)
      if (text) matched.push(text)
    }
  }
  const variables = collectVariables(sheets, seen)
  const atRules = collectAtRules(sheets, seen)

  const variableBlock = variables.size
    ? `[${SHARED_SCOPE_ATTR}="${scope}"] {\n${[...variables].map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
    : ''
  const css = [
    variableBlock,
    scopeCss(matched.join('\n'), scope),
    // Keyframes and @font-face are global by nature and are left unscoped.
    ...atRules,
  ].filter(Boolean).join('\n\n')

  // ---- Fonts -----------------------------------------------------------
  // By NAME, not by <link>: the host page decides how to load them, and a
  // stylesheet URL from someone else's site is a tracking vector.
  const fonts = []
  try {
    for (const node of [el, ...el.querySelectorAll('*')]) {
      const family = view?.getComputedStyle(node)?.fontFamily
      const first = String(family || '').split(',')[0].replace(/['"]/g, '').trim()
      if (first && !/^(inherit|initial|-apple-system|system-ui|sans-serif|serif|monospace|cursive)$/i.test(first)) {
        if (!fonts.includes(first)) fonts.push(first)
      }
    }
  } catch { /* computed styles are a nicety here, not a requirement */ }

  // ---- Assets ----------------------------------------------------------
  const assets = []
  for (const node of [root, ...root.querySelectorAll('*')]) {
    const src = node.getAttribute?.('src')
    if (src) {
      const abs = absoluteAssetUrl(src, baseUrl)
      if (abs) { node.setAttribute('src', abs); assets.push(abs) }
      else warnings.push({ kind: 'asset', detail: `An image could not travel: ${src.slice(0, 60)}` })
    }
    const srcset = node.getAttribute?.('srcset')
    // A srcset resolved against the wrong origin is worse than none at all.
    if (srcset) node.removeAttribute('srcset')
  }

  root.setAttribute(SHARED_SCOPE_ATTR, scope)

  const rect = el.getBoundingClientRect?.()
  return {
    ok: true,
    scope,
    html: root.outerHTML,
    css,
    fonts,
    assets,
    warnings,
    problems: [],
    size: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
  }
}

// What the receiving side inserts: one self-contained block. Kept here so the
// two ends of the trip are described in the same file and cannot drift.
export function sharedBlockHtml({ html, css }) {
  const style = String(css || '').trim()
  return `${style ? `<style>\n${style}\n</style>\n` : ''}${String(html || '')}`
}
