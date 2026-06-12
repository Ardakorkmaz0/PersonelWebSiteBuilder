import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  HTML_ALLOW,
  HTML_VIEW_SANDBOX,
  withBuilderRuntimeHtml,
  withViewportMeta,
} from '../../utils/htmlRuntime.js'
import {
  DRAG_MIME,
  closestPlaceableBlock,
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
  setSelectedElement,
  visibleAnchorIndex,
} from '../../utils/htmlPlacement.js'
import {
  applyElementPatch,
  describeElement,
  duplicateElement,
  moveElement,
  resolveSelectableElement,
} from '../../utils/htmlElementEdit.js'
import { componentToHtml } from '../../utils/componentToHtml.js'

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
//   way a real phone renders it.
const DEVICES = [
  { id: 'fit', label: 'Responsive - area width', w: 0, h: 0 },
  { id: 'desktop-16-9', label: 'Desktop 16:9 - 1280x720', w: 1280, h: 720 },
  { id: 'desktop-16-10', label: 'Desktop 16:10 - 1280x800', w: 1280, h: 800 },
  { id: 'laptop', label: 'Laptop - 1440x900', w: 1440, h: 900 },
  { id: 'fhd', label: 'Full HD - 1920x1080', w: 1920, h: 1080 },
  { id: 'ipad', label: 'iPad - 768x1024', w: 768, h: 1024 },
  { id: 'ipadpro', label: 'iPad Pro - 1024x1366', w: 1024, h: 1366 },
  { id: 'iphonese', label: 'iPhone SE - 375x667', w: 375, h: 667 },
  { id: 'iphone15', label: 'iPhone 15 - 393x852', w: 393, h: 852 },
  { id: 'iphonemax', label: 'iPhone Pro Max - 430x932', w: 430, h: 932 },
  { id: 'galaxys', label: 'Galaxy S - 360x780', w: 360, h: 780 },
  { id: 'galaxyultra', label: 'Galaxy Ultra - 384x824', w: 384, h: 824 },
  { id: 'android', label: 'Large Android - 412x915', w: 412, h: 915 },
]

function setDocumentDesignMode(doc, value) {
  try {
    doc.designMode = value
  } catch {
    /* ignore */
  }
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
    var prev = el.style.outline
    var prevOffset = el.style.outlineOffset
    el.style.outline = '3px solid #2563eb'
    el.style.outlineOffset = '2px'
    setTimeout(function () { el.style.outline = prev; el.style.outlineOffset = prevOffset }, 1600)
  }
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go)
})()</scr` + `ipt>`
}

// Editor-only extras appended to the view srcDoc (kept out of saved HTML —
// saving reads the html prop / edit DOM, never the view document).
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
  onCommit,
  onRequestSave,
  onElementSelect,
  onStartBlank,
  onOpenTemplates,
  onImportFile,
  pendingType,
  onPlaced,
  onCancelPlacement,
}, ref) {
  const [mode, setMode] = useState('view')
  const [deviceId, setDeviceId] = useState('fit')
  const [landscape, setLandscape] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [editSeed, setEditSeed] = useState(html)
  const [sourceDraft, setSourceDraft] = useState(html)

  const iframeRef = useRef(null)
  const stageRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const placing = !!pendingType
  // Keep the latest pendingType in a ref so the iframe listeners (bound once
  // per load) always read the current value without re-binding.
  const pendingRef = useRef(pendingType)
  useEffect(() => { pendingRef.current = pendingType }, [pendingType])
  // The element currently selected in the properties panel (edit mode only).
  // A ref, not state: it's a live DOM node inside the iframe.
  const selectedRef = useRef(null)
  const selectRefreshTimer = useRef(null)

  const clearSelection = useCallback(() => {
    selectedRef.current = null
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc) setSelectedElement(doc, null)
    } catch { /* iframe gone */ }
    onElementSelect?.(null)
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

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
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
    if (next === 'edit') setEditSeed(currentHtml)
    if (next === 'source') setSourceDraft(currentHtml)
    clearSelection() // the selected node dies with the edit document
    setNonce((n) => n + 1)
    setMode(next)
  }, [clearSelection, mode, onCommit, readHtml])

  // When a palette component is picked (click or drag), force the iframe into
  // edit mode so its document is same-origin + mutable for placement.
  useEffect(() => {
    if (!pendingType || mode === 'edit') return undefined
    const timer = window.setTimeout(() => switchMode('edit'), 0)
    return () => window.clearTimeout(timer)
  }, [pendingType, mode, switchMode])

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
    if (!doc?.body || !el || !el.isConnected) return
    const result = fn(doc, el)
    const next = result === null ? null : result || el
    selectedRef.current = next
    setSelectedElement(doc, next)
    onCommit?.(serializeDocument(doc))
    onElementSelect?.(next ? describeElement(next) : null)
  }, [onCommit, onElementSelect])

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
  }), [applyAiHtml, clearSelection, mode, mutateSelected, readHtml, setDocument, switchMode])

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
    const node = insertSnippet(doc, componentToHtml(type), target, position)
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

  function onIframeLoad() {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    if (mode === 'edit') {
      // designMode ON for free-text editing, but OFF while placing so clicks
      // are insertions, not caret moves.
      setDocumentDesignMode(doc, placing ? 'off' : 'on')
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
      if (pendingRef.current) return // placement owns clicks right now
      const el = resolveSelectableElement(e.target, doc.body)
      selectedRef.current = el
      setSelectedElement(doc, el)
      onElementSelect?.(el ? describeElement(el) : null)
    })
    doc.addEventListener('input', () => {
      const el = selectedRef.current
      if (!el) return
      if (selectRefreshTimer.current) window.clearTimeout(selectRefreshTimer.current)
      selectRefreshTimer.current = window.setTimeout(() => {
        const cur = selectedRef.current
        if (cur && cur.isConnected) onElementSelect?.(describeElement(cur))
      }, 250)
    })
  }

  // (Re)bind placement listeners whenever placement turns on for an already
  // loaded edit iframe (e.g. user clicks a second component without leaving
  // edit mode → no iframe reload, so onIframeLoad won't fire again).
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || mode !== 'edit') return undefined
    if (placing) {
      setDocumentDesignMode(doc, 'off')
      clearSelection() // placement clicks shouldn't fight the element panel
      const cleanup = attachPlacementListeners(doc)
      return cleanup
    }
    // leaving placement → restore caret editing + clear chrome
    setDocumentDesignMode(doc, 'on')
    removePlacementChrome(doc)
    return undefined
  }, [attachPlacementListeners, clearSelection, placing, mode, nonce])

  // Don't fire a stale panel refresh after unmount.
  useEffect(() => () => {
    if (selectRefreshTimer.current) window.clearTimeout(selectRefreshTimer.current)
  }, [])

  const viewScrollIndex = scrollOnce && scrollOnce.html === html ? scrollOnce.index : null
  // View mode always gets a viewport meta when the document lacks one, so the
  // phone-size device frames preview what a real phone will actually render —
  // no separate "compatibility mode" toggle needed.
  const srcDoc =
    mode === 'view'
      ? withViewExtras(withBuilderRuntimeHtml(withViewportMeta(html)), viewScrollIndex)
      : editSeed
  const sandbox = mode === 'view' ? HTML_VIEW_SANDBOX : 'allow-same-origin'

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
          </div>
          {mode !== 'source' && (
            <>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                title="Screen / device width"
                className="rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium text-[#374151] focus:border-[#4f46e5] focus:outline-none"
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setLandscape((v) => !v)}
                disabled={isFit}
                title="Landscape / portrait"
                className="rounded-lg px-2 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-40"
              >
                {landscape ? '⟲' : '⟳'}
              </button>
            </>
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
              title="Apply the source code and save — to the server AND the linked local file (💾 in the toolbar)"
              className="rounded-lg bg-[#4f46e5] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4338ca]"
            >
              Apply &amp; Save
            </button>
          )}
          <span className="ml-auto text-xs text-[#6b7280]">
            {mode === 'view'
              ? 'Live preview: JavaScript, links, forms, and scrolling are enabled'
              : mode === 'source'
                ? `${fileName} source file`
                : 'Click any text in the page and type — like a document'}
          </span>
        </div>

        {/* Placement banner — shows the active component + how to cancel. */}
        {placing && (
          <div className="flex items-center gap-2 border-b border-[#bfdbfe] bg-[#eff6ff] px-4 py-1.5 text-xs text-[#1e40af]">
            <span aria-hidden>📍</span>
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

        {mode === 'source' ? (
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
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-2xl">
                📄
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
            <div style={{ width: Math.round(contentW * scale), height: Math.round(contentH * scale) }}>
              <div
                className="bg-white"
                style={{
                  width: contentW,
                  height: contentH,
                  position: 'relative',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  boxShadow: isFit ? 'none' : '0 1px 6px rgba(0,0,0,0.15)',
                  border: isFit ? 'none' : '1px solid #d1d5db',
                  outline: placing ? '2px solid #2563eb' : 'none',
                }}
              >
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
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

export default forwardRef(HtmlWorkspace)
