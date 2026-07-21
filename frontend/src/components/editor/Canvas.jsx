import { useEffect, useMemo, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { canvasHeight, flowCanvasHeight, flowGap, flowSidePad } from '../renderer/layout.js'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import FreeCanvasItem from './FreeCanvasItem.jsx'
import FlowCanvasItem from './FlowCanvasItem.jsx'
import CanvasMultiActions from './CanvasMultiActions.jsx'
import { PAGE_SHEET_SHADOW } from './pageSheet.js'
import { DEFAULT_THEME } from '../../utils/theme.js'
import { BRUSH_CURSOR } from './brushCursor.js'

// One editable free canvas, rendered at the active breakpoint's chosen artboard
// width. PC edits each component's `layout`; Mobile edits its `mobileLayout` on a
// true device-width phone canvas (1:1, no scaling) — independent designs. The
// "fold" guide (if set) marks the visible screen height for the chosen device.
export default function Canvas({
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
  // Tap-to-place: an armed palette item (touch fallback for drag-and-drop).
  // A click/tap on the bare canvas calls onPlaceAt with canvas coordinates.
  pendingPlace = null,
  onPlaceAt = () => {},
}) {
  const { t } = useLanguage()
  const page = useEditorStore(selectCurrentPage)
  const components = page.components
  const viewport = useEditorStore((s) => s.viewport)
  const bg = page.background || '#ffffff'
  const bgMobile = page.backgroundMobile || page.background || '#ffffff'
  const pcWidth = page.canvasWidth || CANVAS_WIDTH
  const pcFold = page.canvasFold || 0
  const mobileWidth = page.mobileWidth || MOBILE_CANVAS_WIDTH
  const mobileFold = page.mobileFold || 0
  const select = useEditorStore((s) => s.selectComponent)
  const selectMany = useEditorStore((s) => s.selectMany)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const linkMode = useEditorStore((s) => s.linkMode)
  const setPageBackground = useEditorStore((s) => s.setPageBackground)
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })
  // Marquee (rubber-band) selection: drag a box on the empty canvas to select
  // every component it touches, then align/distribute them. Works in both the PC
  // and Mobile breakpoints (it reads the active viewport's layout).
  const canvasElRef = useRef(null)
  const scrollElRef = useRef(null)
  const marqueeRef = useRef(null)
  const [marquee, setMarquee] = useState(null)
  const [editorWidth, setEditorWidth] = useState(0)
  const setCanvasRef = (el) => { canvasElRef.current = el; setNodeRef(el) }
  // The theme's font is what the published page paints in; reflect it on the
  // canvas root so brand-new components inherit it immediately AND the empty
  // canvas already previews the right typography. Inline inheritance only
  // affects descendants that don't override fontFamily themselves — the
  // existing per-component baked-in fonts still win, which is the contract
  // the "Apply to design" button operates on.
  const themeFontFamily = useEditorStore((s) => s.schema?.theme?.fontFamily) || DEFAULT_THEME.fontFamily

  const isMobile = viewport === 'mobile'
  const flowMode = !!page.flowMode
  const dragGuides = useEditorStore((s) => s.dragGuides)
  const gridStep = useEditorStore((s) => s.gridStep)
  const canvasW = isMobile ? mobileWidth : pcWidth
  const sidePad = flowSidePad(viewport)
  const fold = isMobile ? mobileFold : pcFold
  const background = isMobile ? bgMobile : bg
  const contentH = flowMode ? flowCanvasHeight(components, viewport, canvasW) : canvasHeight(components, viewport)
  const minHeight = fold > 0 ? Math.max(contentH, fold + 40) : contentH
  const frameW = canvasW + (isMobile ? 24 : 0)
  useEffect(() => {
    const el = scrollElRef.current
    if (!el) return undefined
    const update = () => setEditorWidth(Math.max(1, el.clientWidth - 64))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isMobile])
  const canvasScale = !editorWidth ? 1 : Math.min(1, editorWidth / frameW)

  // Bounding box of a MULTI selection (top-level free-canvas items), so a group
  // toolbar (align / distribute / delete) can float above it.
  const multiBox = useMemo(() => {
    if (flowMode || selectedIds.length < 2) return null
    const rects = selectedIds
      .map((sid) => {
        const c = components.find((x) => x.id === sid)
        if (!c) return null
        const l = (viewport === 'mobile' ? c.mobileLayout || c.layout : c.layout) || {}
        return { x: l.x || 0, y: l.y || 0, w: l.w || 0, h: l.h || 0 }
      })
      .filter(Boolean)
    if (rects.length < 2) return null
    const minX = Math.min(...rects.map((r) => r.x))
    const minY = Math.min(...rects.map((r) => r.y))
    return { x: Math.max(0, minX), y: Math.max(0, minY) }
  }, [flowMode, selectedIds, components, viewport])

  // Link-tool connectors: an arrow from each link component to the in-page
  // component it targets (href="#<componentId>"). Drawn in canvas coordinates,
  // so they live inside the artboard and need no scroll math. Page links
  // (href="#<pageId>") have no matching component here → no arrow. Only shown
  // while the link tool is active to keep the canvas clean otherwise.
  const linkPairs = (linkMode ? components : [])
    .map((c) => {
      const href = c.props?.href || ''
      if (!href.startsWith('#')) return null
      const target = components.find((k) => k.id === href.slice(1))
      if (!target || target.id === c.id) return null
      const sL = (isMobile ? c.mobileLayout || c.layout : c.layout) || {}
      const tL = (isMobile ? target.mobileLayout || target.layout : target.layout) || {}
      return {
        id: c.id,
        x1: (sL.x || 0) + (sL.w || 0) / 2,
        y1: (sL.y || 0) + (sL.h || 0) / 2,
        x2: (tL.x || 0) + (tL.w || 0) / 2,
        y2: (tL.y || 0) + (tL.h || 0) / 2,
      }
    })
    .filter(Boolean)

  function startMarquee(e) {
    // An armed palette item places itself where the user taps/clicks —
    // before marquee/deselect logic so placement always wins while armed.
    if (pendingPlace) {
      if (e.button !== 0) return
      const rect = canvasElRef.current.getBoundingClientRect()
      onPlaceAt((e.clientX - rect.left) / canvasScale, (e.clientY - rect.top) / canvasScale)
      return
    }
    if (brushMode) {
      if (e.button !== 0) return
      if (e.target === canvasElRef.current && (brushTarget === 'smart' || brushTarget === 'fill')) {
        e.preventDefault()
        setPageBackground(brushColor)
        onBrushUse(brushColor)
      }
      return
    }
    // Only a plain left-drag on the bare canvas (not on a component, which stops
    // its own pointerdown) begins a marquee. A click that doesn't move just
    // deselects, exactly like before.
    if (flowMode || e.button !== 0 || e.target !== canvasElRef.current) {
      select(null)
      return
    }
    const rect = canvasElRef.current.getBoundingClientRect()
    const startX = (e.clientX - rect.left) / canvasScale
    const startY = (e.clientY - rect.top) / canvasScale
    marqueeRef.current = { startX, startY, curX: startX, curY: startY, moved: false }

    const onMove = (ev) => {
      const m = marqueeRef.current
      if (!m) return
      m.curX = (ev.clientX - rect.left) / canvasScale
      m.curY = (ev.clientY - rect.top) / canvasScale
      if (!m.moved && Math.abs(m.curX - m.startX) + Math.abs(m.curY - m.startY) < 5) return
      m.moved = true
      setMarquee({
        x1: Math.min(m.startX, m.curX), y1: Math.min(m.startY, m.curY),
        x2: Math.max(m.startX, m.curX), y2: Math.max(m.startY, m.curY),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const m = marqueeRef.current
      marqueeRef.current = null
      setMarquee(null)
      if (!m || !m.moved) { select(null); return }
      const x1 = Math.min(m.startX, m.curX)
      const y1 = Math.min(m.startY, m.curY)
      const x2 = Math.max(m.startX, m.curX)
      const y2 = Math.max(m.startY, m.curY)
      const ids = components
        .filter((c) => {
          if (c.hidden || (isMobile && c.hiddenMobile)) return false
          const L = (isMobile ? c.mobileLayout || c.layout : c.layout) || {}
          const bx = L.x || 0
          const by = L.y || 0
          const bw = L.w || 0
          const bh = L.h || 0
          // Box intersection (any overlap counts).
          return !(bx > x2 || bx + bw < x1 || by > y2 || by + bh < y1)
        })
        .map((c) => c.id)
      selectMany(ids)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const canvas = (
    <div
      id="free-canvas"
      data-builder-canvas-scale={canvasScale}
      ref={setCanvasRef}
      onPointerDown={startMarquee}
      style={{
        position: 'relative',
        width: canvasW,
        minHeight,
        // backgroundColor (not the `background` shorthand) so it can coexist with
        // the grid overlay's backgroundImage/backgroundSize without React warning.
        backgroundColor: background,
        cursor: pendingPlace ? 'crosshair' : brushMode ? BRUSH_CURSOR : undefined,
        fontFamily: themeFontFamily,
        // Clip selection chrome (resize handles, outline) and any off-artboard
        // content at the canvas edge so you can't scroll into empty space beside
        // the page. Vertical content is unaffected (clip is X-only).
        overflowX: 'clip',
        ...(flowMode
          ? {
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              alignContent: 'flex-start',
              justifyContent: 'flex-start',
              gap: flowGap(viewport),
              padding: `0 ${sidePad}px`,
              boxSizing: 'border-box',
            }
          : {}),
        // Grid overlay (free canvas only) — drawn over the background colour so
        // the snap-to-grid step is visible while arranging.
        ...(!flowMode && gridStep > 0
          ? {
              backgroundImage:
                'linear-gradient(to right, rgba(79,70,229,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(79,70,229,0.08) 1px, transparent 1px)',
              backgroundSize: `${gridStep}px ${gridStep}px`,
            }
          : {}),
        // Page sheet shadow (desktop artboard only — the phone frame supplies
        // its own on mobile) so Edit frames the page exactly like View does.
        ...(isMobile ? {} : { boxShadow: PAGE_SHEET_SHADOW }),
      }}
      className={`${isOver ? 'ring-2 ring-[#4f46e5]' : ''}`}
    >
      {components.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-gray-400">
          <p className="text-lg font-medium">{t('Your canvas is empty')}</p>
          <p className="text-sm">
            {t('Drag a component from the left onto the canvas.')}
          </p>
        </div>
      )}
      {components.map((component) =>
        flowMode ? (
          <FlowCanvasItem
            key={component.id}
            component={component}
            canvasWidth={canvasW}
            brushMode={brushMode}
            brushColor={brushColor}
            brushTarget={brushTarget}
            onBrushUse={onBrushUse}
            canvasScale={canvasScale}
          />
        ) : (
          <FreeCanvasItem
            key={component.id}
            component={component}
            brushMode={brushMode}
            brushColor={brushColor}
            brushTarget={brushTarget}
            onBrushUse={onBrushUse}
            canvasScale={canvasScale}
          />
        ),
      )}

      {/* Rubber-band selection box. */}
      {marquee && (
        <div
          className="pointer-events-none absolute rounded-sm border border-[#4f46e5]"
          style={{
            left: marquee.x1,
            top: marquee.y1,
            width: marquee.x2 - marquee.x1,
            height: marquee.y2 - marquee.y1,
            backgroundColor: 'rgba(79,70,229,0.12)',
            zIndex: 50,
          }}
        />
      )}

      {/* Group toolbar for a multi selection — align, distribute, group delete.
          Sits above the group's bounding box; when the group hugs the top of
          the artboard it drops just inside instead, so it can never be pushed
          off-canvas out of reach (same rule as the single-item toolbar). */}
      {multiBox && !marquee && (
        <CanvasMultiActions
          count={selectedIds.length}
          canvasScale={canvasScale}
          style={
            multiBox.y >= 48
              ? { left: multiBox.x, top: multiBox.y, transform: 'translateY(calc(-100% - 8px))' }
              : { left: multiBox.x, top: multiBox.y + 8 }
          }
        />
      )}

      {fold > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{ top: fold, zIndex: 40 }}
        >
          <div className="border-t-2 border-dashed border-amber-500" />
          <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
            {t('Visible screen limit')} · {fold}px
          </span>
        </div>
      )}

      {/* Link-tool connector arrows (component → in-page target). */}
      {linkMode && linkPairs.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={canvasW}
          height={minHeight}
          style={{ zIndex: 46, overflow: 'visible' }}
        >
          <defs>
            <marker
              id="canvas-arrowhead"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#4f46e5" />
            </marker>
          </defs>
          {linkPairs.map((p) => (
            <g key={p.id}>
              <line
                x1={p.x1}
                y1={p.y1}
                x2={p.x2}
                y2={p.y2}
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                opacity="0.9"
                markerEnd="url(#canvas-arrowhead)"
              />
              <circle cx={p.x1} cy={p.y1} r="4.5" fill="#4f46e5" />
            </g>
          ))}
        </svg>
      )}

      {/* Live snap guides rendered during free-canvas drags. Each guide is a
          dashed magenta line at the snapped edge/centre coordinate, extending
          across the whole artboard so the alignment is obvious. */}
      {!flowMode && dragGuides && dragGuides.length > 0 &&
        dragGuides.map((g, i) =>
          g.type === 'v' ? (
            <div
              key={`v${i}`}
              className="pointer-events-none absolute"
              style={{
                left: g.pos,
                top: 0,
                bottom: 0,
                width: 0,
                borderLeft: '1px dashed #ec4899',
                zIndex: 45,
              }}
            />
          ) : (
            <div
              key={`h${i}`}
              className="pointer-events-none absolute"
              style={{
                top: g.pos,
                left: 0,
                right: 0,
                height: 0,
                borderTop: '1px dashed #ec4899',
                zIndex: 45,
              }}
            />
          ),
        )}
    </div>
  )

  // Canvas anchor clicks would navigate the EDITOR away (e.g. # adds a hash to
  // /editor/:id, an absolute href like "/login" routes the SPA to a login
  // page, and an external http link replaces the editor) — leaving the user
  // staring at a white or broken screen. `pointer-events-none` on the
  // FlowCanvasItem wrapper blocks real mouse clicks for top-level items, but
  // synthetic clicks, anchors inside containers/tabs, and any element with
  // its own pointer-events override all bypass that guard. Intercept anchor
  // clicks here as a fail-safe so design mode never leaves the editor.
  function preventCanvasAnchorClicks(e) {
    const a = e.target && e.target.closest && e.target.closest('a[href]')
    if (!a) return
    e.preventDefault()
    e.stopPropagation()
  }

  if (isMobile) {
    return (
      <main
        id="canvas-scroll"
        ref={scrollElRef}
        className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--studio-shell)] p-8"
        onClickCapture={preventCanvasAnchorClicks}
      >
        <div
          className="mx-auto"
          style={{ width: frameW * canvasScale, height: (minHeight + 24) * canvasScale }}
        >
          <div
            style={{
              width: frameW,
              transform: canvasScale < 1 ? `scale(${canvasScale})` : undefined,
              transformOrigin: 'top left',
            }}
          >
            <div
              className="overflow-hidden rounded-[44px] border-[12px] border-gray-900 bg-white shadow-2xl"
              style={{ width: frameW }}
            >
              {canvas}
            </div>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-[360px] text-center text-xs text-gray-400">
          {flowMode
            ? t('Flow layout ({width}px) — the same order adapts to mobile and PC.', { width: canvasW })
            : t('Mobile layout ({width}px) — a separate design from PC. Drag and resize freely, or use "Auto-arrange" in the panel.', { width: canvasW })}
        </p>
      </main>
    )
  }

  return (
    <main
      id="canvas-scroll"
      ref={scrollElRef}
      className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--studio-shell)] p-8"
      onClickCapture={preventCanvasAnchorClicks}
    >
      <div
        className="mx-auto"
        style={{ width: canvasW * canvasScale, height: minHeight * canvasScale }}
      >
        <div
          style={{
            width: canvasW,
            transform: canvasScale < 1 ? `scale(${canvasScale})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {canvas}
        </div>
      </div>
    </main>
  )
}
