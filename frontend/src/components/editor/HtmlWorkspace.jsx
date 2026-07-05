import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  HTML_ALLOW,
  HTML_VIEW_SANDBOX,
  withBuilderRuntimeHtml,
  withViewportMeta,
} from '../../utils/htmlRuntime.js'
import { DEVICES } from '../../utils/htmlDevices.js'
import {
  DRAG_MIME,
  closestPlaceableBlock,
  placeableBlocks,
  diffAppendedBodyChildren,
  ensureEditHintChrome,
  ensurePlacementChrome,
  firstNewChildIndex,
  flashNode,
  insertPositionForY,
  insertSnippet,
  relocateAppendedAfterAnchor,
  removePlacementChrome,
  serializeDocument,
  setHoverTarget,
  setLinkSource,
  setSelectedElement,
  visibleAnchorIndex,
} from '../../utils/htmlPlacement.js'
import {
  applyElementPatch,
  bindLinkToTarget,
  describeElement,
  duplicateElement,
  ensureAnchor,
  moveElement,
  nearestAnchor,
  reorderToPoint,
  resolveSelectableElement,
  selectableParent,
} from '../../utils/htmlElementEdit.js'
import { componentToHtml } from '../../utils/componentToHtml.js'
import { matchingCssRules } from '../../utils/htmlFiles.js'
import { brushElementPatch } from '../../utils/htmlRecolor.js'
import BrushControls from './BrushControls.jsx'
import { EditIcon, MoveIcon, LinkIcon, PinIcon, LightbulbIcon, FileCodeIcon, WarningIcon, PaletteIcon } from '../icons.jsx'

// Editable, pixel-perfect HTML/JS workspace embedded in the site editor.
// - View: real document in a sandboxed iframe with scripts enabled.
//   NO allow-same-origin (isolated — cannot touch the app/visitor session).
// - Edit: sandbox allow-same-origin (NO scripts) + designMode for in-place text
//   editing; the parent reads the edited HTML back via the exposed getHtml().
// - Placement: when `pendingType` is set, the iframe captures the click/drop
//   point and splices that component's HTML snippet into the document right
//   where the user pointed (htmlPlacement.js picks the anchor block).
// - AI additions: applyAiHtml() relocates content the model appended to the
//   bottom of <body> so it lands near what the user is currently looking at,
//   then scrolls/flashes the new block after the reload.
// - Device sizes drive responsive testing; a viewport meta is injected
//   automatically when the document lacks one, so every page previews the
//   way a real phone renders it. The device selector itself lives in the
//   editor HEADER (shared chrome) — this component receives it as props.

function setDocumentDesignMode(doc, value) {
  try {
    doc.designMode = value
  } catch {
    /* ignore */
  }
}

function activateBuilderTab(root, tabId) {
  if (!root || !tabId) return
  root.querySelectorAll('[role="tab"][data-builder-tab]').forEach((tab) => {
    tab.setAttribute('aria-selected', tab.getAttribute('data-builder-tab') === tabId ? 'true' : 'false')
  })
  root.querySelectorAll('[role="tabpanel"][data-builder-panel]').forEach((panel) => {
    if (panel.getAttribute('data-builder-panel') === tabId) {
      panel.removeAttribute('hidden')
      panel.style.display = ''
    } else {
      panel.setAttribute('hidden', '')
    }
  })
}

// Draw a persistent connector ARROW for EVERY in-document link→target binding
// (anchor href="#id" whose id resolves in the same doc). Replaces any prior
// layer, so a rebound link drops its old line immediately. Cross-page links
// (#pageId, #top) have no in-doc target → no arrow. The layer is data-pwb-chrome
// so serializeDocument strips it from saved HTML. Module-scope (no React deps)
// so it can be called from both the link listeners and the imperative API.
function paintConnections(doc) {
  if (!doc?.body) return
  doc.querySelectorAll('svg[data-pwb-connections]').forEach((s) => s.remove())
  const win = doc.defaultView
  if (!win) return
  const pairs = []
  for (const a of doc.querySelectorAll('a[href^="#"]')) {
    const id = a.getAttribute('href').slice(1)
    if (!id || id === 'top') continue
    const target = doc.getElementById(id)
    if (target && target !== a) pairs.push([a, target])
  }
  if (!pairs.length) return
  const ns = 'http://www.w3.org/2000/svg'
  const svg = doc.createElementNS(ns, 'svg')
  svg.setAttribute('data-pwb-connections', '')
  svg.setAttribute('data-pwb-chrome', '')
  // position:fixed → the SVG's (0,0) IS the viewport top-left, so a line drawn
  // at an element's getBoundingClientRect centre sits exactly over it. The
  // endpoints are recomputed every animation frame on scroll/resize
  // (positionConnections), so the lines track BOTH normal elements AND
  // position:fixed/sticky navbars (whose viewport coords stay put on scroll)
  // with no lag and no flicker — the in-place update never rebuilds the layer.
  svg.setAttribute(
    'style',
    'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;overflow:visible',
  )
  // An arrowhead marker so a binding reads as an arrow, not a plain dash.
  const defs = doc.createElementNS(ns, 'defs')
  const marker = doc.createElementNS(ns, 'marker')
  marker.setAttribute('id', 'pwb-arrowhead')
  marker.setAttribute('viewBox', '0 0 10 10')
  marker.setAttribute('refX', '9')
  marker.setAttribute('refY', '5')
  marker.setAttribute('markerWidth', '7')
  marker.setAttribute('markerHeight', '7')
  marker.setAttribute('orient', 'auto-start-reverse')
  const head = doc.createElementNS(ns, 'path')
  head.setAttribute('d', 'M0,0 L10,5 L0,10 z')
  head.setAttribute('fill', '#4f46e5')
  marker.appendChild(head)
  defs.appendChild(marker)
  svg.appendChild(defs)
  for (const [a, b] of pairs) {
    const line = doc.createElementNS(ns, 'line')
    line.__pwbSrc = a
    line.__pwbDst = b
    line.setAttribute('stroke', '#4f46e5')
    line.setAttribute('stroke-width', '2.5')
    line.setAttribute('stroke-dasharray', '6 4')
    line.setAttribute('opacity', '0.9')
    line.setAttribute('marker-end', 'url(#pwb-arrowhead)')
    svg.appendChild(line)
    // A dot anchors the source end so the direction is obvious.
    const dot = doc.createElementNS(ns, 'circle')
    dot.__pwbEl = a
    dot.setAttribute('r', '4.5')
    dot.setAttribute('fill', '#4f46e5')
    svg.appendChild(dot)
  }
  doc.body.appendChild(svg)
  positionConnections(doc)
}

// Recompute the connector endpoints from the live element rects and write them
// in place (no rebuild → no flicker). Cheap enough to run every animation frame
// while scrolling, which is what keeps fixed/sticky sources attached.
function positionConnections(doc) {
  const svg = doc?.querySelector('svg[data-pwb-connections]')
  if (!svg) return
  const center = (el) => {
    let r = el.getBoundingClientRect()
    // A `display:contents` link wrapper generates no box of its own (0×0) —
    // measure its content instead so the connector still lands on the element.
    if (r.width === 0 && r.height === 0 && el.firstElementChild) {
      r = el.firstElementChild.getBoundingClientRect()
    }
    return [r.left + r.width / 2, r.top + r.height / 2]
  }
  svg.querySelectorAll('line').forEach((line) => {
    if (!line.__pwbSrc || !line.__pwbDst || !line.__pwbSrc.isConnected || !line.__pwbDst.isConnected) return
    const [sx, sy] = center(line.__pwbSrc)
    const [tx, ty] = center(line.__pwbDst)
    line.setAttribute('x1', sx); line.setAttribute('y1', sy)
    line.setAttribute('x2', tx); line.setAttribute('y2', ty)
  })
  svg.querySelectorAll('circle').forEach((dot) => {
    if (!dot.__pwbEl || !dot.__pwbEl.isConnected) return
    const [cx, cy] = center(dot.__pwbEl)
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy)
  })
}

// The view iframe runs with an opaque origin (no allow-same-origin), so the
// parent can't read its scroll position. This injected reporter posts the
// index of the topmost visible <body> child instead — applyAiHtml uses it as
// the "user is looking here" anchor. Mirrors visibleAnchorIndex().
const ANCHOR_REPORTER_SCRIPT = `<script data-pwb-anchor-reporter>(function () {
  function report() {
    var body = document.body
    if (!body || !body.children.length) return
    var kids = body.children
    var probe = (window.innerHeight || 0) * 0.4
    var idx = kids.length - 1
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect()
      if (r.height > 0 && r.bottom >= probe) { idx = i; break }
    }
    parent.postMessage({ type: 'pwb-visible-anchor', index: idx }, '*')
  }
  var pending = null
  window.addEventListener('scroll', function () {
    if (pending) return
    pending = setTimeout(function () { pending = null; report() }, 120)
  }, { passive: true })
  window.addEventListener('load', report)
})()</scr` + `ipt>`

// One-shot "show me what just changed": scrolls body.children[index] into
// view and flashes an outline. Only ever injected into the editor's view
// iframe srcDoc — never written into the saved HTML.
function scrollOnceScript(index) {
  return `<script data-pwb-scroll-once>(function () {
  function go() {
    var el = document.body && document.body.children[${Number(index)}]
    if (!el) return
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (e) { el.scrollIntoView() }
    var prev = el.style.boxShadow
    el.style.boxShadow = 'inset 0 0 0 3px #2563eb'
    setTimeout(function () { el.style.boxShadow = prev }, 1600)
  }
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go)
})()</scr` + `ipt>`
}

// Editor-only extras appended to the view srcDoc (kept out of saved HTML —
// saving reads the html prop / edit DOM, never the view document).
const HTML_RESIZE_OVERLAY_ATTR = 'data-pwb-resize-overlay'
const HTML_RESIZE_MIN = 20
const HTML_RESIZE_EDGE = 14
const HTML_RESIZE_HANDLE = 10
const HTML_RESIZE_HANDLE_OFFSET = HTML_RESIZE_HANDLE / 2

const HTML_RESIZE_PARTS = [
  ['n', 'edge', 'top:-7px;left:0;right:0;height:14px;cursor:ns-resize'],
  ['e', 'edge', 'top:0;right:-7px;bottom:0;width:14px;cursor:ew-resize'],
  ['s', 'edge', 'bottom:-7px;left:0;right:0;height:14px;cursor:ns-resize'],
  ['w', 'edge', 'top:0;left:-7px;bottom:0;width:14px;cursor:ew-resize'],
  ['nw', 'handle', `top:-${HTML_RESIZE_HANDLE_OFFSET}px;left:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:nwse-resize`],
  ['n', 'handle', `top:-${HTML_RESIZE_HANDLE_OFFSET}px;left:50%;margin-left:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:ns-resize`],
  ['ne', 'handle', `top:-${HTML_RESIZE_HANDLE_OFFSET}px;right:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:nesw-resize`],
  ['e', 'handle', `top:50%;right:-${HTML_RESIZE_HANDLE_OFFSET}px;margin-top:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:ew-resize`],
  ['se', 'handle', `bottom:-${HTML_RESIZE_HANDLE_OFFSET}px;right:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:nwse-resize`],
  ['s', 'handle', `bottom:-${HTML_RESIZE_HANDLE_OFFSET}px;left:50%;margin-left:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:ns-resize`],
  ['sw', 'handle', `bottom:-${HTML_RESIZE_HANDLE_OFFSET}px;left:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:nesw-resize`],
  ['w', 'handle', `top:50%;left:-${HTML_RESIZE_HANDLE_OFFSET}px;margin-top:-${HTML_RESIZE_HANDLE_OFFSET}px;cursor:ew-resize`],
]

function removeSelectionResizeChrome(doc) {
  doc?.querySelectorAll?.(`[${HTML_RESIZE_OVERLAY_ATTR}]`).forEach((el) => el.remove())
}

function updateSelectionResizeChrome(doc, el) {
  const overlay = doc?.querySelector?.(`[${HTML_RESIZE_OVERLAY_ATTR}]`)
  if (!overlay) return
  if (!el || !el.isConnected || el === doc.body || el === doc.documentElement) {
    overlay.remove()
    return
  }
  const rect = el.getBoundingClientRect()
  if (!rect.width && !rect.height) {
    overlay.style.display = 'none'
    return
  }
  overlay.style.display = 'block'
  overlay.style.left = `${Math.round(rect.left)}px`
  overlay.style.top = `${Math.round(rect.top)}px`
  overlay.style.width = `${Math.max(1, Math.round(rect.width))}px`
  overlay.style.height = `${Math.max(1, Math.round(rect.height))}px`
}

function installSelectionResizeChrome(doc, el, onStartResize) {
  removeSelectionResizeChrome(doc)
  if (!doc?.body || !el || !el.isConnected) return
  const overlay = doc.createElement('div')
  overlay.setAttribute(HTML_RESIZE_OVERLAY_ATTR, '')
  overlay.setAttribute('data-pwb-chrome', '')
  overlay.setAttribute('contenteditable', 'false')
  overlay.setAttribute(
    'style',
    [
      'position:fixed',
      'box-sizing:border-box',
      'pointer-events:none',
      'border:2px solid #2563eb',
      'box-shadow:0 0 0 1px rgba(255,255,255,0.9)',
      'z-index:2147483646',
    ].join(';'),
  )
  for (const [dir, kind, placement] of HTML_RESIZE_PARTS) {
    const part = doc.createElement('div')
    part.setAttribute('data-pwb-resize-dir', dir)
    part.setAttribute('data-pwb-resize-kind', kind)
    part.setAttribute(
      'style',
      [
        'position:absolute',
        'box-sizing:border-box',
        'pointer-events:auto',
        'touch-action:none',
        kind === 'handle'
          ? `width:${HTML_RESIZE_HANDLE}px;height:${HTML_RESIZE_HANDLE}px;background:#2563eb;border:1px solid #fff;border-radius:2px;box-shadow:0 1px 5px rgba(15,23,42,0.22)`
          : `min-width:${HTML_RESIZE_EDGE}px;min-height:${HTML_RESIZE_EDGE}px;background:transparent`,
        placement,
      ].join(';'),
    )
    part.addEventListener('pointerdown', (e) => onStartResize(e, dir), true)
    part.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
    }, true)
    overlay.appendChild(part)
  }
  doc.body.appendChild(overlay)
  updateSelectionResizeChrome(doc, el)
}

function withViewExtras(html, scrollIndex) {
  let inject = ANCHOR_REPORTER_SCRIPT
  if (scrollIndex != null && scrollIndex >= 0) inject += scrollOnceScript(scrollIndex)
  const out = String(html || '')
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, inject + '</body>')
  return out + inject
}

function HtmlWorkspace({
  html,
  fileName = 'index.html',
  deviceId = 'fit',
  landscape = false,
  // Device frame picker (PC/Mobile + size dropdown) rendered by the editor —
  // lives in this toolbar so the single-row app header stays uncluttered.
  deviceControls = null,
  persistKey,
  onCommit,
  onRequestSave,
  onElementSelect,
  onLinkArmedChange,
  onStartBlank,
  onOpenTemplates,
  onImportFile,
  pendingType,
  pendingHtml,
  onPlaced,
  onCancelPlacement,
  // Brush tool (shared with the component canvas): when the 'brush' edit tool is
  // active, clicking an element recolors it (fill/text/border/smart) instead of
  // selecting it. Color/target are owned by the parent so the choice persists
  // across both editor modes; onBrushUse remembers the color in the recents.
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  brushRecentColors = [],
  onBrushColor,
  onBrushTarget,
  onBrushUse,
  // Code-project mode: when set, the View document and Edit seed are produced
  // by this async hook (HTML with its linked CSS/JS resolved from sibling
  // files) instead of using `html` verbatim. `assembleDeps` is a value that,
  // when it changes (e.g. a linked CSS file was edited), re-runs the View
  // assembly so the preview stays live. Absent → the classic single-document
  // flow, unchanged. readHtml() still returns serializeDocument(doc), which
  // strips the injected <style>/<script> so the file written back keeps its
  // original <link>/<script src> references.
  assemble,
  assembleDeps,
  // Code-project mode: when set (e.g. http://localhost:8000), a "Live" tab
  // appears that loads the REAL running dev server in an iframe — the only way
  // to preview a server-rendered app (Django/Rails/PHP…) with its database
  // content. The host app must serve it framable (X-Frame-Options/CSP); if not,
  // the "Open in new tab" button still works.
  liveUrl,
  // Bumped by the parent after a Save to reload the Live iframe.
  liveReloadKey = 0,
  // Opens (and reuses) a real browser window showing the dev server — the
  // reliable preview for servers that block iframe embedding (e.g. Django).
  onOpenLiveWindow,
  // Code-project mode: a short notice shown over the View when the page can't
  // be statically rendered (bundled app / server template) — points at ● Live.
  viewNotice,
}, ref) {
  // The view/edit/source surface and the edit sub-tool are restored from
  // localStorage (per site) so a browser refresh lands the user back exactly
  // where they were — index.html in, say, edit + link — instead of resetting
  // to the read-only View. Helpers swallow storage errors (private mode, etc.).
  const lsGet = (k, def) => {
    try { return localStorage.getItem(`pwb_${k}_${persistKey}`) || def } catch { return def }
  }
  const [mode, setMode] = useState(() => lsGet('htmlmode', 'view'))
  const [nonce, setNonce] = useState(0)
  const [editSeed, setEditSeed] = useState(html)
  const [sourceDraft, setSourceDraft] = useState(html)
  // Code-project mode only: the resolved View document (CSS/JS inlined from the
  // sibling files). Recomputed by an effect whenever the file or a linked file
  // changes; ignored entirely when `assemble` is absent.
  const [assembledView, setAssembledView] = useState('')
  // Bumped to force the Live iframe to reload the dev server (Reload button).
  const [liveNonce, setLiveNonce] = useState(0)
  // Edit sub-tool (only meaningful in edit mode): 'text' = click-to-type,
  // 'rearrange' = drag blocks to reorder, 'link' = connect a link to a target.
  const [editTool, setEditTool] = useState(() => lsGet('htmltool', 'text'))
  // Bumped on every iframe load so the tool manager rebinds AFTER the document
  // is ready — needed when edit/link is restored on mount (the first effect run
  // happens before the iframe body exists).
  const [loadTick, setLoadTick] = useState(0)
  const [linkHint, setLinkHint] = useState(null) // link-tool guidance text
  const linkSourceRef = useRef(null) // chosen <a> awaiting a target (link tool)

  const iframeRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const placing = !!pendingType
  // Keep the latest pendingType in a ref so the iframe listeners (bound once
  // per load) always read the current value without re-binding.
  const pendingRef = useRef(pendingType)
  useEffect(() => { pendingRef.current = pendingType }, [pendingType])
  // The exact HTML to insert for the pending item (a palette variant/block). When
  // unset we fall back to the type's default snippet.
  const pendingHtmlRef = useRef(pendingHtml)
  useEffect(() => { pendingHtmlRef.current = pendingHtml }, [pendingHtml])
  // Latest edit tool for the load-time selection listener (bound once).
  const editToolRef = useRef(editTool)
  useEffect(() => { editToolRef.current = editTool }, [editTool])
  // Brush color/target/onUse read through refs so attachBrushListeners stays a
  // stable factory (the tool effect must not rebind on every color change).
  const brushColorRef = useRef(brushColor)
  useEffect(() => { brushColorRef.current = brushColor }, [brushColor])
  const brushTargetRef = useRef(brushTarget)
  useEffect(() => { brushTargetRef.current = brushTarget }, [brushTarget])
  const onBrushUseRef = useRef(onBrushUse)
  useEffect(() => { onBrushUseRef.current = onBrushUse }, [onBrushUse])
  // Persist the surface + sub-tool so a refresh restores them (see lsGet).
  useEffect(() => {
    try { localStorage.setItem(`pwb_htmlmode_${persistKey}`, mode) } catch { /* ignore */ }
  }, [persistKey, mode])
  useEffect(() => {
    try { localStorage.setItem(`pwb_htmltool_${persistKey}`, editTool) } catch { /* ignore */ }
  }, [persistKey, editTool])
  // Latest onCommit in a ref so the tool listeners (link/placement) can call it
  // WITHOUT re-creating the listener factory on every parent render. The parent
  // passes a fresh onCommit arrow each render; depending on it directly made the
  // tool effect tear down + rebind mid-interaction, which silently un-armed the
  // link source the instant it was picked (no bind, no persistent highlight).
  const onCommitRef = useRef(onCommit)
  useEffect(() => { onCommitRef.current = onCommit }, [onCommit])
  // The element currently selected in the properties panel (edit mode only).
  // A ref, not state: it's a live DOM node inside the iframe.
  const selectedRef = useRef(null)
  const selectRefreshTimer = useRef(null)

  const clearSelection = useCallback(() => {
    selectedRef.current = null
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc) {
        setSelectedElement(doc, null)
        removeSelectionResizeChrome(doc)
      }
    } catch { /* iframe gone */ }
    onElementSelect?.(null)
  }, [onElementSelect])

  const startSelectedElementResize = useCallback((e, dir) => {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const doc = iframeRef.current?.contentDocument
    const win = doc?.defaultView
    const el = selectedRef.current
    if (!doc?.body || !win || !el?.isConnected) return
    const rect = el.getBoundingClientRect()
    const cs = win.getComputedStyle(el)
    const px = (value) => Number.parseFloat(value) || 0
    const widthInset = Math.max(0, rect.width - px(cs.width))
    const heightInset = Math.max(0, rect.height - px(cs.height))
    const startFontSize = Math.max(1, px(cs.fontSize))
    const start = {
      x: e.clientX,
      y: e.clientY,
      outerW: Math.max(HTML_RESIZE_MIN, rect.width),
      outerH: Math.max(HTML_RESIZE_MIN, rect.height),
    }

    function onMove(ev) {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      let nextOuterW = start.outerW
      let nextOuterH = start.outerH
      if (dir.includes('e')) nextOuterW = start.outerW + dx
      if (dir.includes('w')) nextOuterW = start.outerW - dx
      if (dir.includes('s')) nextOuterH = start.outerH + dy
      if (dir.includes('n')) nextOuterH = start.outerH - dy
      const nextW = Math.max(HTML_RESIZE_MIN, Math.round(nextOuterW - widthInset))
      const nextH = Math.max(HTML_RESIZE_MIN, Math.round(nextOuterH - heightInset))
      const fontScale = Math.sqrt(
        (Math.max(HTML_RESIZE_MIN, nextOuterW) * Math.max(HTML_RESIZE_MIN, nextOuterH)) /
        (start.outerW * start.outerH),
      )
      if (dir.includes('e') || dir.includes('w')) el.style.setProperty('width', `${nextW}px`, 'important')
      if (dir.includes('s') || dir.includes('n')) el.style.setProperty('height', `${nextH}px`, 'important')
      if (Number.isFinite(fontScale)) {
        el.style.setProperty('font-size', `${Math.max(1, Math.round(startFontSize * fontScale))}px`, 'important')
      }
      updateSelectionResizeChrome(doc, el)
    }

    function onUp() {
      win.removeEventListener('pointermove', onMove)
      win.removeEventListener('pointerup', onUp)
      updateSelectionResizeChrome(doc, el)
      onCommitRef.current?.(serializeDocument(doc))
      onElementSelect?.(describeElement(el))
    }

    win.addEventListener('pointermove', onMove)
    win.addEventListener('pointerup', onUp)
  }, [onElementSelect])
  // Topmost visible body-child index reported by the view iframe (it has an
  // opaque origin, so it tells us via postMessage). null = unknown.
  const viewAnchorRef = useRef(null)
  // One-shot scroll target after an AI apply: { html, index }. State (not a
  // ref) because the view srcDoc is derived from it during render; it's
  // compared against the current document so a stale target never fires.
  const [scrollOnce, setScrollOnce] = useState(null)

  useEffect(() => {
    // New document → the reported anchor belongs to the previous one.
    viewAnchorRef.current = null
  }, [html])

  useEffect(() => {
    const onMessage = (e) => {
      if (e.data?.type !== 'pwb-visible-anchor') return
      if (e.source !== iframeRef.current?.contentWindow) return
      const idx = Number(e.data.index)
      viewAnchorRef.current = Number.isInteger(idx) && idx >= 0 ? idx : null
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Callback ref for the preview stage. A plain useRef + one-shot effect missed
  // resizes: the stage element is (re)created when switching between the
  // starter card / source / preview branches, and may not exist on first mount,
  // so the observer either never attached or watched a detached node — leaving
  // the responsive iframe frozen at a stale width after collapsing a side rail.
  // Re-attaching on every element mount keeps the stage size always current.
  const stageRoRef = useRef(null)
  const stageRef = useCallback((el) => {
    if (stageRoRef.current) {
      stageRoRef.current.disconnect()
      stageRoRef.current = null
    }
    if (!el) return
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    stageRoRef.current = ro
  }, [])

  const readHtml = useCallback(() => {
    if (mode === 'source') return sourceDraft
    if (mode === 'edit' && iframeRef.current?.contentDocument) {
      try {
        // serializeDocument strips placement chrome (hover/flash hints) so
        // they can never leak into the saved site.
        return serializeDocument(iframeRef.current.contentDocument) || html
      } catch {
        return html
      }
    }
    return html
  }, [html, mode, sourceDraft])

  // Plain statements, NOT logic inside a setMode updater: updater functions
  // run during render, so calling onCommit (a parent setState) from one
  // triggers React's "cannot update a component while rendering" error.
  const switchMode = useCallback((next) => {
    if (next === mode) return
    const currentHtml = readHtml()
    if ((mode === 'edit' || mode === 'source') && onCommit) onCommit(currentHtml)
    // Edit seed: in code-project mode it's the assembled (linked-CSS-resolved)
    // document; otherwise the raw html. Source always stays the raw file text.
    if (next === 'edit') {
      if (assemble) assemble(currentHtml, { forEdit: true }).then(setEditSeed)
      else setEditSeed(currentHtml)
    }
    if (next === 'source') setSourceDraft(currentHtml)
    clearSelection() // the selected node dies with the edit document
    setEditTool('text') // always re-enter edit on the plain text tool
    setLinkHint(null)
    setNonce((n) => n + 1)
    setMode(next)
  }, [assemble, clearSelection, mode, onCommit, readHtml])

  // When a palette component is picked (click or drag), force the iframe into
  // edit mode so its document is same-origin + mutable for placement.
  useEffect(() => {
    if (!pendingType || mode === 'edit') return undefined
    const timer = window.setTimeout(() => switchMode('edit'), 0)
    return () => window.clearTimeout(timer)
  }, [pendingType, mode, switchMode])

  // Code-project View: resolve the linked CSS/JS into a self-contained,
  // runnable document whenever the file — or any linked file (via
  // assembleDeps) — changes, so the preview stays live.
  useEffect(() => {
    if (!assemble || mode !== 'view') return undefined
    let alive = true
    Promise.resolve(assemble(html, { forEdit: false })).then((doc) => {
      if (alive) setAssembledView(doc)
    })
    return () => { alive = false }
  }, [assemble, mode, html, assembleDeps])

  // Code-project Edit seed when the workspace MOUNTS already in edit mode
  // (restored from localStorage). Later entries are seeded by switchMode.
  // Mount-only on purpose: element edits change `html` via onCommit, and
  // reseeding on those would jump the caret.
  useEffect(() => {
    if (!assemble || mode !== 'edit') return undefined
    let alive = true
    Promise.resolve(assemble(html, { forEdit: true })).then((doc) => {
      if (alive) { setEditSeed(doc); setNonce((n) => n + 1) }
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Where is the user looking right now? Edit mode: measure directly (the
  // document is same-origin). View mode: last index the reporter posted.
  const currentAnchorIndex = useCallback(() => {
    if (mode === 'edit') {
      try {
        return visibleAnchorIndex(iframeRef.current?.contentDocument)
      } catch {
        return null
      }
    }
    if (mode === 'view') return viewAnchorRef.current
    return null
  }, [mode])

  // Apply an AI-generated document. When the model just appended new content
  // to the bottom of <body> (the usual failure mode for "add a section"),
  // relocate it to right after the block the user is currently viewing. In
  // all cases remember which child to scroll to / flash on the next load.
  // Returns the final HTML the parent should store as site.html.
  const applyAiHtml = useCallback((newHtml) => {
    const oldHtml = readHtml()
    let finalHtml = String(newHtml || '')
    let scrollIndex
    const diff = diffAppendedBodyChildren(oldHtml, finalHtml)
    if (diff) {
      const existingCount = diff.doc.body.children.length - diff.appended.length
      const anchor = currentAnchorIndex()
      if (anchor != null && anchor >= 0 && anchor < existingCount - 1) {
        relocateAppendedAfterAnchor(diff.doc, diff.appended, anchor)
        finalHtml = serializeDocument(diff.doc)
        scrollIndex = anchor + 1
      } else {
        // Already looking at the end (or no anchor known) — keep the append,
        // just make sure the user gets scrolled to it.
        scrollIndex = existingCount
      }
    } else {
      scrollIndex = firstNewChildIndex(oldHtml, finalHtml)
    }
    setScrollOnce(scrollIndex >= 0 ? { html: finalHtml, index: scrollIndex } : null)
    // An open edit/source surface still shows the previous document — reseed
    // it so the next mode switch can't clobber the AI result with stale HTML.
    if (mode === 'edit') {
      clearSelection() // the reload replaces the selected node
      setEditSeed(finalHtml)
      setNonce((n) => n + 1)
    } else if (mode === 'source') {
      setSourceDraft(finalHtml)
    }
    return finalHtml
  }, [clearSelection, currentAnchorIndex, mode, readHtml])

  // Run a mutation against the currently selected element, then re-serialize
  // the document and refresh the panel. `fn` may return a replacement element
  // to select (duplicate → the clone) or null to clear (delete).
  const mutateSelected = useCallback((fn) => {
    const doc = iframeRef.current?.contentDocument
    const el = selectedRef.current
    if (!doc?.body || !el) return
    if (!el.isConnected) {
      // The node died (deleted while typing, page reseeded, …). Close the
      // panel instead of silently swallowing edits — "Properties sometimes
      // doesn't work" was exactly this dead-end.
      clearSelection()
      return
    }
    const result = fn(doc, el)
    const next = result === null ? null : result || el
    selectedRef.current = next
    setSelectedElement(doc, next)
    if (next) installSelectionResizeChrome(doc, next, startSelectedElementResize)
    else removeSelectionResizeChrome(doc)
    onCommit?.(serializeDocument(doc))
    // Editing an href via the panel can add/change a connector — keep the
    // arrows in sync while the Link tool is showing them.
    if (editToolRef.current === 'link') paintConnections(doc)
    onElementSelect?.(next ? describeElement(next) : null)
  }, [clearSelection, onCommit, onElementSelect, startSelectedElementResize])

  // Replace the open document wholesale (undo/redo, template load) — without
  // this, an open edit/source surface would clobber the new HTML with its
  // stale copy on the next mode switch or save.
  const setDocument = useCallback((nextHtml) => {
    clearSelection()
    if (mode === 'edit') {
      setEditSeed(nextHtml)
      setNonce((n) => n + 1)
    } else if (mode === 'source') {
      setSourceDraft(nextHtml)
    }
    // view mode: srcDoc derives from the html prop — nothing to reseed.
  }, [clearSelection, mode])

  useImperativeHandle(ref, () => ({
    getHtml: readHtml,
    // Which CSS rules (in the given [{ path, content }] files) style the
    // currently-selected element — for the Code-project "jump to CSS" panel.
    matchCssRules: (cssFiles) => matchingCssRules(selectedRef.current, cssFiles),
    applyAiHtml,
    clearSelection,
    setDocument,
    // Files-panel affordance: clicking the open file toggles its source view.
    toggleSource: () => switchMode(mode === 'source' ? 'view' : 'source'),
    updateSelectedElement: (patch) =>
      mutateSelected((doc, el) => { applyElementPatch(el, patch) }),
    duplicateSelected: () =>
      mutateSelected((doc, el) => {
        const clone = duplicateElement(el)
        if (clone) flashNode(doc, clone)
        return clone
      }),
    moveSelected: (dir) =>
      mutateSelected((doc, el) => {
        if (!moveElement(el, dir)) return undefined
        try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } catch { /* jsdom */ }
      }),
    deleteSelected: () => mutateSelected((doc, el) => { el.remove(); return null }),
    // Climb to the containing element (section/div) — the only practical way
    // to select & style a container you can't click directly.
    selectParent: () => {
      const doc = iframeRef.current?.contentDocument
      const el = selectedRef.current
      if (!doc || !el) return
      const parent = selectableParent(el)
      if (!parent) return
      selectedRef.current = parent
      setSelectedElement(doc, parent)
      try { parent.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } catch { /* jsdom */ }
      onElementSelect?.(describeElement(parent))
    },
    // Link tool + Files panel: bind the picked source link to a whole page
    // (href = #pageId), which the published multi-page nav resolves.
    bindSourceToPage: (pageId) => {
      const doc = iframeRef.current?.contentDocument
      const src = linkSourceRef.current
      if (!doc || !src || !pageId) return false // not armed → caller navigates
      // The source may be any block — wrap it in <a> so the page link works.
      const anchor = ensureAnchor(src)
      anchor.setAttribute('href', `#${pageId}`)
      linkSourceRef.current = null
      onLinkArmedChange?.(false)
      setLinkSource(doc, null)
      setHoverTarget(doc, null)
      onCommit?.(serializeDocument(doc))
      paintConnections(doc) // the source's old in-doc line (if any) disappears
      setLinkHint(`Linked → page (#${pageId}). Click another element to connect more.`)
      flashNode(doc, anchor)
      return true
    },
  }), [applyAiHtml, clearSelection, mode, mutateSelected, onCommit, onElementSelect, onLinkArmedChange, readHtml, setDocument, switchMode])

  const device = DEVICES.find((d) => d.id === deviceId) || DEVICES[0]
  const isFit = device.id === 'fit'
  const contentW = isFit ? Math.max(320, Math.round(stage.w - 24)) : landscape ? device.h : device.w
  const contentH = isFit
    ? Math.max(420, Math.round(stage.h - 24))
    : landscape
      ? device.w
      : device.h
  const scale = Math.min(1, (stage.w - 24) / contentW || 1, (stage.h - 24) / contentH || 1)

  // ----- placement: splice the component's snippet into the document ---------
  const placeAt = useCallback((clientX, clientY) => {
    const type = pendingRef.current
    if (!type) return
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    const hit = doc.elementFromPoint(clientX, clientY)
    const target = closestPlaceableBlock(hit, doc.body)
    let position = 'beforeend' // body fallback: append at the end
    if (target && target !== doc.body) {
      const rect = target.getBoundingClientRect()
      position = insertPositionForY(rect.top, rect.height, clientY)
    }
    const node = insertSnippet(doc, pendingHtmlRef.current || componentToHtml(type), target, position)
    // Commit a clean document first, then flash — the flash attribute is
    // stripped by serializeDocument anyway, but no reason to race it.
    removePlacementChrome(doc)
    onCommit?.(serializeDocument(doc))
    if (node) flashNode(doc, node)
    onPlaced?.()
  }, [onCommit, onPlaced])

  // Binds click/drop placement + hover highlight + Esc-cancel onto the edit
  // iframe's document. Returns a cleanup that removes them all. Every handler
  // re-checks pendingRef because a load-time binding has no cleanup path.
  const attachPlacementListeners = useCallback((doc) => {
    if (!doc?.body) return () => {}
    ensurePlacementChrome(doc)
    // Dragging/aiming near the top/bottom edge scrolls the page, so a
    // component can be dropped below the fold of a long document. behavior:
    // 'instant' bypasses the page's own `scroll-behavior: smooth`, which
    // would swallow these rapid little nudges.
    const autoScroll = (clientY) => {
      const win = doc.defaultView
      if (!win) return
      const EDGE = 60
      if (clientY > win.innerHeight - EDGE) win.scrollBy({ top: 18, behavior: 'instant' })
      else if (clientY < EDGE && win.scrollY > 0) win.scrollBy({ top: -18, behavior: 'instant' })
    }
    const hover = (x, y) => {
      const hit = doc.elementFromPoint(x, y)
      const target = closestPlaceableBlock(hit, doc.body)
      setHoverTarget(doc, target === doc.body ? null : target)
    }
    const onClick = (e) => {
      if (!pendingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      placeAt(e.clientX, e.clientY)
    }
    const onKey = (e) => {
      if (!pendingRef.current) return
      if (e.key === 'Escape') onCancelPlacement?.()
    }
    const onMouseMove = (e) => {
      if (!pendingRef.current) return
      autoScroll(e.clientY)
      hover(e.clientX, e.clientY)
    }
    const onDragOver = (e) => {
      if (!pendingRef.current) return
      if (Array.from(e.dataTransfer?.types || []).includes(DRAG_MIME)) {
        e.preventDefault()
        autoScroll(e.clientY)
        hover(e.clientX, e.clientY)
      }
    }
    const onDrop = (e) => {
      if (!pendingRef.current) return
      e.preventDefault()
      placeAt(e.clientX, e.clientY)
    }
    doc.addEventListener('click', onClick, true)
    doc.addEventListener('keydown', onKey, true)
    doc.addEventListener('mousemove', onMouseMove, true)
    doc.addEventListener('dragover', onDragOver, true)
    doc.addEventListener('drop', onDrop, true)
    return () => {
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('keydown', onKey, true)
      doc.removeEventListener('mousemove', onMouseMove, true)
      doc.removeEventListener('dragover', onDragOver, true)
      doc.removeEventListener('drop', onDrop, true)
      removePlacementChrome(doc)
    }
  }, [onCancelPlacement, placeAt])

  // ----- rearrange: drag a block to a new position --------------------------
  const attachRearrangeListeners = useCallback((doc) => {
    if (!doc?.body) return () => {}
    ensurePlacementChrome(doc)
    let dragging = null
    // Every nested block is draggable (cards, list items, headings) — but never
    // the single page wrapper, which would drag everything. dragstart resolves
    // the exact block grabbed via closestPlaceableBlock(e.target).
    const blocks = () => placeableBlocks(doc.body)
    const arm = () => blocks().forEach((el) => { el.draggable = true; el.setAttribute('data-pwb-drag', '') })
    const disarm = () => doc.body.querySelectorAll('[data-pwb-drag]').forEach((el) => {
      el.removeAttribute('draggable')
      el.removeAttribute('data-pwb-drag')
    })
    arm()
    const onDragStart = (e) => {
      const block = closestPlaceableBlock(e.target, doc.body)
      if (!block || block === doc.body) return
      dragging = block
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', 'pwb-move') } catch { /* ignore */ }
    }
    const onDragOver = (e) => {
      if (!dragging) return
      e.preventDefault()
      const win = doc.defaultView
      const EDGE = 60
      if (e.clientY > win.innerHeight - EDGE) win.scrollBy({ top: 18, behavior: 'instant' })
      else if (e.clientY < EDGE && win.scrollY > 0) win.scrollBy({ top: -18, behavior: 'instant' })
      const target = closestPlaceableBlock(doc.elementFromPoint(e.clientX, e.clientY), doc.body)
      setHoverTarget(doc, target && target !== doc.body && target !== dragging ? target : null)
    }
    const onDrop = (e) => {
      if (!dragging) return
      e.preventDefault()
      const moved = reorderToPoint(doc, dragging, e.clientX, e.clientY, { closestPlaceableBlock, insertPositionForY })
      const node = dragging
      dragging = null
      setHoverTarget(doc, null)
      if (moved) {
        disarm()
        removePlacementChrome(doc)
        onCommit?.(serializeDocument(doc))
        flashNode(doc, node)
        // re-arm on the (now committed) live doc for the next drag
        arm()
        ensurePlacementChrome(doc)
      }
    }
    const onDragEnd = () => { dragging = null; setHoverTarget(doc, null) }
    doc.addEventListener('dragstart', onDragStart, true)
    doc.addEventListener('dragover', onDragOver, true)
    doc.addEventListener('drop', onDrop, true)
    doc.addEventListener('dragend', onDragEnd, true)
    return () => {
      disarm()
      doc.removeEventListener('dragstart', onDragStart, true)
      doc.removeEventListener('dragover', onDragOver, true)
      doc.removeEventListener('drop', onDrop, true)
      doc.removeEventListener('dragend', onDragEnd, true)
      removePlacementChrome(doc)
    }
  }, [onCommit])

  // ----- link: click a link, then click its target ---------------------------
  const attachLinkListeners = useCallback((doc) => {
    if (!doc?.body) return () => {}
    ensurePlacementChrome(doc)
    linkSourceRef.current = null
    onLinkArmedChange?.(false)
    paintConnections(doc)
    const win = doc.defaultView
    // Recompute the connector endpoints in place every animation frame while
    // scrolling/resizing, so the lines stay attached to BOTH normal elements
    // and position:fixed/sticky navbars (no rebuild → no flicker, no lag).
    let rafPending = false
    const onReflow = () => {
      if (rafPending) return
      rafPending = true
      win.requestAnimationFrame(() => { rafPending = false; positionConnections(doc) })
    }
    const onClick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!linkSourceRef.current) {
        // Source = the nearest existing link, or the SPECIFIC element clicked
        // (wrapped in <a> on bind) — so every element can become a link. NOTE:
        // we resolve the exact clicked element, NOT the top-level body block —
        // real pages wrap everything in one container, and using that container
        // made source and target collapse to the same node (link never bound).
        const src = nearestAnchor(e.target, doc.body) || resolveSelectableElement(e.target, doc.body)
        if (!src) { setLinkHint('Click any element to start the link, then click its target.'); return }
        linkSourceRef.current = src
        onLinkArmedChange?.(true)
        setLinkSource(doc, src) // persistent blue highlight until the next click
        setHoverTarget(doc, null)
        setLinkHint('Now click the target element — or click a PAGE in the left Files panel to link to another page.')
        return
      }
      const source = linkSourceRef.current
      const target = resolveSelectableElement(e.target, doc.body)
      if (!target || target === source || source.contains?.(target)) {
        setLinkHint('Pick a DIFFERENT element as the target.')
        return
      }
      const anchor = ensureAnchor(source)
      const href = bindLinkToTarget(anchor, target)
      linkSourceRef.current = null
      onLinkArmedChange?.(false)
      setLinkSource(doc, null)
      setHoverTarget(doc, null)
      if (href) {
        onCommitRef.current?.(serializeDocument(doc))
        paintConnections(doc)
        setLinkHint(`Linked → ${href}. Click another element to connect more.`)
        flashNode(doc, anchor)
      }
    }
    const onMove = (e) => {
      if (linkSourceRef.current) {
        const t = resolveSelectableElement(doc.elementFromPoint(e.clientX, e.clientY), doc.body)
        setHoverTarget(doc, t && t !== linkSourceRef.current ? t : null)
      }
    }
    doc.addEventListener('click', onClick, true)
    doc.addEventListener('mousemove', onMove, true)
    win.addEventListener('scroll', onReflow, { passive: true })
    win.addEventListener('resize', onReflow)
    return () => {
      linkSourceRef.current = null
      onLinkArmedChange?.(false)
      win.removeEventListener('scroll', onReflow)
      win.removeEventListener('resize', onReflow)
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('mousemove', onMove, true)
      doc.querySelectorAll('svg[data-pwb-connections]').forEach((s) => s.remove())
      setLinkSource(doc, null)
      setHoverTarget(doc, null)
      removePlacementChrome(doc)
    }
    // onCommit is read through a ref so this factory stays stable — otherwise the
    // tool effect tears down and rebinds on every parent render, un-arming the
    // link source mid-pick.
  }, [onLinkArmedChange])

  // ----- brush: click an element to paint its color --------------------------
  // Mirrors the component-canvas brush. Color/target come through refs (stable
  // factory); the patch is applied to the clicked element ONLY, then committed —
  // same semantics as a panel style edit, so it round-trips and undoes cleanly.
  const attachBrushListeners = useCallback((doc) => {
    if (!doc?.body) return () => {}
    ensurePlacementChrome(doc)
    const hover = (x, y) => {
      const t = resolveSelectableElement(doc.elementFromPoint(x, y), doc.body)
      setHoverTarget(doc, t && t !== doc.body ? t : null)
    }
    const onMove = (e) => hover(e.clientX, e.clientY)
    const onClick = (e) => {
      if (e.target?.closest?.('[data-pwb-chrome]')) return
      e.preventDefault()
      e.stopPropagation()
      const el = resolveSelectableElement(e.target, doc.body)
      if (!el || el === doc.body) return
      const patch = brushElementPatch(describeElement(el), brushColorRef.current, brushTargetRef.current)
      applyElementPatch(el, patch)
      onCommitRef.current?.(serializeDocument(doc))
      flashNode(doc, el)
      onBrushUseRef.current?.(brushColorRef.current)
    }
    doc.addEventListener('click', onClick, true)
    doc.addEventListener('mousemove', onMove, true)
    return () => {
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('mousemove', onMove, true)
      setHoverTarget(doc, null)
      removePlacementChrome(doc)
    }
  }, [])

  function onIframeLoad() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    // Tell the tool manager the document is now ready, so a restored edit/link
    // surface binds its listeners (the first effect pass ran before this load).
    setLoadTick((t) => t + 1)
    if (mode === 'edit') {
      // Drop any connection SVG baked into the document by an older app
      // version — it would otherwise show as a stale arrow that never updates.
      // The link tool repaints fresh ones from the live anchors when active.
      doc.querySelectorAll('svg[data-pwb-connections]').forEach((s) => s.remove())
      // designMode ON only for the free-text tool — off for placing and for
      // the rearrange/link tools so clicks/drags aren't caret moves.
      setDocumentDesignMode(doc, placing || editTool !== 'text' ? 'off' : 'on')
      // Dashed hover outlines + text cursor — makes "click anywhere and
      // type" discoverable. Stripped from every save by serializeDocument.
      ensureEditHintChrome(doc)
      attachSelectionListeners(doc)
      if (pendingRef.current) attachPlacementListeners(doc)
      // Edit iframes run no scripts, so the parent handles the post-AI
      // "scroll to what changed" hint directly.
      if (scrollOnce && scrollOnce.html === editSeed) {
        setScrollOnce(null)
        const el = doc.body?.children?.[scrollOnce.index]
        if (el) flashNode(doc, el)
      }
    }
  }

  // Click → select the element for the properties panel (alongside the
  // designMode caret), input → keep the panel's text field in sync with
  // in-page typing. Bound once per edit-iframe load; the document (and its
  // listeners) are discarded wholesale on reload, so no cleanup is needed.
  function attachSelectionListeners(doc) {
    doc.addEventListener('click', (e) => {
      if (e.target?.closest?.(`[${HTML_RESIZE_OVERLAY_ATTR}]`)) return
      if (pendingRef.current || editToolRef.current !== 'text') return // owned by another tool
      const tab = e.target?.closest?.('[data-builder-tabs] [role="tab"][data-builder-tab]')
      if (tab) {
        e.preventDefault()
        e.stopPropagation()
        activateBuilderTab(tab.closest('[data-builder-tabs]'), tab.getAttribute('data-builder-tab'))
        clearSelection()
        return
      }
      const el = resolveSelectableElement(e.target, doc.body)
      selectedRef.current = el
      setSelectedElement(doc, el)
      if (el) installSelectionResizeChrome(doc, el, startSelectedElementResize)
      else removeSelectionResizeChrome(doc)
      onElementSelect?.(el ? describeElement(el) : null)
    })
    doc.addEventListener('input', () => {
      const el = selectedRef.current
      if (!el) return
      updateSelectionResizeChrome(doc, el)
      if (selectRefreshTimer.current) window.clearTimeout(selectRefreshTimer.current)
      selectRefreshTimer.current = window.setTimeout(() => {
        const cur = selectedRef.current
        if (cur && cur.isConnected) {
          updateSelectionResizeChrome(doc, cur)
          onElementSelect?.(describeElement(cur))
        }
      }, 250)
    })
    const refreshChrome = () => updateSelectionResizeChrome(doc, selectedRef.current)
    doc.defaultView?.addEventListener('scroll', refreshChrome, { passive: true })
    doc.defaultView?.addEventListener('resize', refreshChrome)
  }

  // Single edit-mode tool manager: (re)binds the listeners for whatever is
  // active — palette placement, rearrange-drag, link-connect, or plain text
  // editing — and flips designMode accordingly. Re-runs when the tool or the
  // placement state changes without needing an iframe reload.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || mode !== 'edit') return undefined
    if (placing) {
      setDocumentDesignMode(doc, 'off')
      clearSelection() // placement clicks shouldn't fight the element panel
      return attachPlacementListeners(doc)
    }
    if (editTool === 'rearrange') {
      setDocumentDesignMode(doc, 'off')
      clearSelection()
      return attachRearrangeListeners(doc)
    }
    if (editTool === 'link') {
      setDocumentDesignMode(doc, 'off')
      clearSelection()
      return attachLinkListeners(doc)
    }
    if (editTool === 'brush') {
      setDocumentDesignMode(doc, 'off')
      clearSelection()
      return attachBrushListeners(doc)
    }
    // text tool → caret editing, no extra chrome
    setDocumentDesignMode(doc, 'on')
    removePlacementChrome(doc)
    return undefined
    // Intentionally NOT depending on the attach* factory identities: the parent
    // hands fresh onCommit/onPlaced arrows every render, which would otherwise
    // re-run this effect on EVERY render — tearing down the active tool's
    // listeners and un-arming an in-progress link pick. We only want to rebind
    // when the actual tool/placement/document changes (loadTick = iframe ready).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing, editTool, mode, nonce, loadTick])

  // Don't fire a stale panel refresh after unmount.
  useEffect(() => () => {
    if (selectRefreshTimer.current) window.clearTimeout(selectRefreshTimer.current)
  }, [])

  const viewScrollIndex = scrollOnce && scrollOnce.html === html ? scrollOnce.index : null
  // View mode always gets a viewport meta when the document lacks one, so the
  // phone-size device frames preview what a real phone will actually render —
  // no separate "compatibility mode" toggle needed.
  // In code-project mode the View renders the assembled (linked-CSS/JS-resolved)
  // document; otherwise the html prop is already self-contained.
  const viewHtml = assemble ? assembledView : html
  const srcDoc =
    mode === 'view'
      ? withViewExtras(withBuilderRuntimeHtml(withViewportMeta(viewHtml)), viewScrollIndex)
      : editSeed
  const sandbox = mode === 'view' ? HTML_VIEW_SANDBOX : 'allow-same-origin'

  // The preview iframe — rendered into either the CSS-filled responsive frame
  // or the scaled fixed-device frame below. One definition keeps its key/ref
  // identical across both so it isn't needlessly torn down.
  const stageIframe = (
    <iframe
      key={`${mode}-${nonce}`}
      ref={iframeRef}
      title="site"
      srcDoc={srcDoc}
      sandbox={sandbox}
      allow={HTML_ALLOW}
      allowFullScreen
      onLoad={onIframeLoad}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        background: '#ffffff',
        scrollbarGutter: 'stable',
      }}
    />
  )

  const toggleBtn = (active) =>
    active ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white' : 'px-2.5 py-1 text-[#374151]'

  return (
    <div className="flex min-h-0 flex-1">
      {/* The page/file list lives in the editor's left rail (Files tab) —
          the workspace itself is just the toolbar + stage. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-white px-4 py-1.5">
          <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
            <button onClick={() => switchMode('view')} className={toggleBtn(mode === 'view')}>
              View
            </button>
            <button onClick={() => switchMode('edit')} className={toggleBtn(mode === 'edit')}>
              Edit
            </button>
            <button onClick={() => switchMode('source')} className={toggleBtn(mode === 'source')}>
              Source
            </button>
            {liveUrl && (
              <button
                onClick={() => switchMode('live')}
                title="Preview the real running dev server (with its database content)"
                className={toggleBtn(mode === 'live')}
              >
                ● Live
              </button>
            )}
          </div>
          {deviceControls}
          {/* Edit sub-tools — sit right next to View/Edit/Source. Hidden on an
              empty page: there's no document to act on, so the starter card is
              the single clear action instead of dead chips. */}
          {mode === 'edit' && !placing && !!String(html || '').trim() && (
            <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
              {[
                ['text', EditIcon, 'Text', 'Click any text and type'],
                ['rearrange', MoveIcon, 'Move', 'Drag a block to reorder it'],
                ['link', LinkIcon, 'Link', 'Click a link, then click where it should go'],
                ['brush', PaletteIcon, 'Brush', 'Click any element to paint its color'],
              ].map(([id, ToolIcon, label, title]) => (
                <button
                  key={id}
                  type="button"
                  title={title}
                  onClick={() => { setEditTool(id); setLinkHint(id === 'link' ? 'Click a LINK (nav item / button-link), then click its target.' : null) }}
                  className={`flex items-center gap-1 ${editTool === id ? 'rounded-md bg-[#4f46e5] px-2.5 py-1 text-white' : 'px-2.5 py-1 text-[#374151]'}`}
                >
                  <ToolIcon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
          {mode === 'source' && (
            <button
              type="button"
              onClick={() => {
                // Apply = commit to the editor AND persist to the server, so
                // edited source survives a refresh without a separate Save.
                onCommit?.(sourceDraft)
                setMode('view')
                setNonce((n) => n + 1)
                onRequestSave?.()
              }}
              title="Apply the source code and save — to the server AND the linked local file (the disk chip in the toolbar)"
              className="rounded-lg bg-[#4f46e5] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4338ca]"
            >
              Apply &amp; Save
            </button>
          )}
          {mode === 'live' && liveUrl ? (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-xs text-[#6b7280]">Real running dev server</span>
              <button
                type="button"
                onClick={() => setLiveNonce((n) => n + 1)}
                title="Reload the embedded preview"
                className="rounded-lg border border-[#d1d5db] px-2.5 py-1 text-xs text-[#374151] hover:bg-[#f3f4f6]"
              >
                ↻ Reload
              </button>
              <button
                type="button"
                onClick={() => onOpenLiveWindow?.()}
                title="Open the dev server in a real window — works even when embedding is blocked (Django), and auto-reloads on Save"
                className="rounded-lg border border-[#4f46e5] bg-[#eef2ff] px-2.5 py-1 text-xs font-medium text-[#4f46e5] hover:bg-[#e0e7ff]"
              >
                Open live window ↗
              </button>
            </div>
          ) : (
            <span className="ml-auto text-xs text-[#6b7280]">
              {mode === 'view'
                ? 'Live preview: JavaScript, links, forms, and scrolling are enabled'
                : mode === 'source'
                  ? `${fileName} source file`
                  : editTool === 'rearrange'
                    ? 'Drag any block to reorder it'
                    : editTool === 'link'
                      ? 'Connect a link to a target'
                      : editTool === 'brush'
                        ? 'Brush: choose target + color, then click elements'
                        : 'Click any text in the page and type — like a document'}
            </span>
          )}
        </div>

        {/* "Can't statically render" banner — bundled apps / server templates
            stay blank/partial in View; point the user at the real dev server. */}
        {mode === 'view' && viewNotice && (
          <div className="flex items-center gap-2 border-b border-[#fde68a] bg-[#fffbeb] px-4 py-1.5 text-xs text-[#92400e]">
            <WarningIcon size={14} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1">{viewNotice}</span>
            <button
              type="button"
              onClick={() => switchMode('live')}
              className="shrink-0 rounded-lg border border-[#fbbf24] bg-white px-2 py-0.5 font-medium text-[#92400e] hover:bg-[#fef3c7]"
            >
              Switch to ● Live
            </button>
          </div>
        )}

        {/* Brush controls — same sub-toolbar as the component canvas. */}
        {mode === 'edit' && editTool === 'brush' && !placing && (
          <BrushControls
            brushColor={brushColor}
            brushTarget={brushTarget}
            recentColors={brushRecentColors}
            onColor={(c) => onBrushColor?.(c)}
            onTarget={(t) => onBrushTarget?.(t)}
          />
        )}

        {/* Link-tool guidance banner. */}
        {mode === 'edit' && editTool === 'link' && !placing && (
          <div className="flex items-center gap-2 border-b border-[#bfdbfe] bg-[#eff6ff] px-4 py-1.5 text-xs text-[#1e40af]">
            <LinkIcon size={13} aria-hidden />
            <span>{linkHint || 'Click a LINK (nav item / button-link), then click the element it should jump to.'}</span>
          </div>
        )}

        {/* Placement banner — shows the active component + how to cancel. */}
        {placing && (
          <div className="flex items-center gap-2 border-b border-[#bfdbfe] bg-[#eff6ff] px-4 py-1.5 text-xs text-[#1e40af]">
            <PinIcon size={13} aria-hidden />
            <span>
              Click in the page to place the <strong>{pendingType}</strong>, or drag it onto the spot.
            </span>
            <button
              type="button"
              onClick={() => onCancelPlacement?.()}
              className="ml-auto rounded-lg border border-[#93c5fd] bg-white px-2 py-0.5 font-medium text-[#1e40af] hover:bg-[#dbeafe]"
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        {mode === 'live' ? (
          liveUrl ? (
            <main className="relative flex min-h-0 flex-1 flex-col bg-[#0b0b0b]">
              <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#fffbe6] px-4 py-1.5 text-xs text-[#7a5d00]">
                <LightbulbIcon size={14} aria-hidden className="shrink-0" />
                <span className="truncate">
                  Embedded preview of <span className="font-mono">{liveUrl}</span>. Blank? Many servers
                  (Django) block embedding — click <strong>Open live window</strong>; it stays in sync
                  and auto-reloads every time you Save.
                </span>
              </div>
              <iframe
                key={`live-${liveNonce}-${liveReloadKey}`}
                title="live"
                src={liveUrl}
                className="min-h-0 w-full flex-1 border-0 bg-white"
                allow={HTML_ALLOW}
                allowFullScreen
              />
            </main>
          ) : (
            <main className="flex min-h-0 flex-1 items-center justify-center bg-[#f3f4f6] p-6 text-sm text-[#9ca3af]">
              Enter your dev-server URL in the header, then this tab shows the real running page.
            </main>
          )
        ) : mode === 'source' ? (
          <main className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e]">
            <div className="border-b border-white/10 bg-[#252526] px-4 py-2 font-mono text-xs text-gray-300">
              {fileName}
            </div>
            <textarea
              value={sourceDraft}
              onChange={(e) => setSourceDraft(e.target.value)}
              spellCheck={false}
              placeholder="This page has no HTML yet — paste or write a full document here, then Apply & Save."
              className="min-h-0 flex-1 resize-none bg-[#1e1e1e] p-4 font-mono text-sm leading-relaxed text-gray-100 outline-none placeholder:text-gray-500"
            />
          </main>
        ) : !String(html || '').trim() ? (
          /* Empty page: keep the full workspace chrome (toolbar, device bar)
             and put the starter actions where the page would render — the
             editor looks identical whether a page has HTML yet or not. */
          <main className="flex min-h-0 flex-1 items-center justify-center bg-[#f3f4f6] p-6">
            <div className="ms-card w-full max-w-md p-8 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                <FileCodeIcon size={24} />
              </div>
              <h2 className="text-base font-bold text-[#111827]">{fileName} is empty</h2>
              <p className="mt-1 text-sm text-[#6b7280]">
                Give this page its own HTML — every page of the site is its own file. You can also
                switch to Source and paste code directly.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={onStartBlank} className="ms-btn ms-btn-primary w-full py-2">
                  Start blank HTML
                </button>
                <button onClick={onOpenTemplates} className="ms-btn w-full py-2">
                  Choose a template…
                </button>
                <button onClick={onImportFile} className="ms-btn w-full py-2">
                  Import an HTML file…
                </button>
              </div>
            </div>
          </main>
        ) : (
          <main
            ref={stageRef}
            className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#f3f4f6] p-3"
          >
            {isFit ? (
              // Responsive ("area width") preview: the iframe simply FILLS the
              // stage via CSS, so its width tracks side-rail collapses and
              // window resizes with no JS measurement — a frozen ResizeObserver
              // can no longer leave the preview stuck at half width.
              <div
                className="h-full w-full overflow-hidden bg-white"
                style={{ boxShadow: placing ? 'inset 0 0 0 2px #2563eb' : 'none' }}
              >
                {stageIframe}
              </div>
            ) : (
              <div style={{ width: Math.round(contentW * scale), height: Math.round(contentH * scale) }}>
                <div
                  className="bg-white"
                  style={{
                    width: contentW,
                    height: contentH,
                    position: 'relative',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    border: '1px solid #d1d5db',
                    boxShadow: placing
                      ? '0 1px 6px rgba(0,0,0,0.15), inset 0 0 0 2px #2563eb'
                      : '0 1px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  {stageIframe}
                </div>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  )
}

export default forwardRef(HtmlWorkspace)
