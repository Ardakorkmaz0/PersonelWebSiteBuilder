import { useEffect, useRef, useState } from 'react'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { RenderComponent } from '../renderer/Renderer.jsx'
import { ContainerEditor, RegionEditor, TabsEditor } from './FlowCanvasItem.jsx'
import { snapDraggedRect, snapThresholdFor } from '../../utils/snapping.js'
import { beginDragScroll } from '../../utils/dragAutoScroll.js'
import { trackPointerDrag } from '../../utils/pointerDrag.js'
import { embedAspectLock } from '../../utils/htmlSnippetSizing.js'
import { fixedRailInset } from '../../utils/railInset.js'
import { BRUSH_CURSOR } from './brushCursor.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import {
  HOVER_RING_CLASS,
  chromeBadgeStyle,
  chromeMetrics,
  frameOutsets as frameOutsetsFor,
  hoverRingStyle,
  resizeEdgeHitZones,
  resizeHandles,
} from './selectionChrome.js'
import { ResizeAffordances, SelectionFrame } from './ChromeAffordances.jsx'

const MIN = 20
// Native types sized by their own content rather than the palette's guess.
const CONTENT_GROW_TYPES = new Set(['tabs'])

export default function FreeCanvasItem({
  component,
  canvasScale = 1,
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const { t } = useLanguage()
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const toggleSelect = useEditorStore((s) => s.toggleSelect)
  const setLayout = useEditorStore((s) => s.setLayout)
  const setLayoutMany = useEditorStore((s) => s.setLayoutMany)
  const updateProps = useEditorStore((s) => s.updateProps)
  const setDragGuides = useEditorStore((s) => s.setDragGuides)
  const clearDragGuides = useEditorStore((s) => s.clearDragGuides)
  const paintComponent = useEditorStore((s) => s.paintComponent)

  // Component-canvas link tool: when armed, a click picks this component as the
  // link source or target instead of selecting/moving it.
  const linkMode = useEditorStore((s) => s.linkMode)
  const linkSourceId = useEditorStore((s) => s.linkSourceId)
  const pickLinkNode = useEditorStore((s) => s.pickLinkNode)
  const isLinkSource = linkMode && linkSourceId === component.id

  const isSelected = selectedIds.includes(component.id)
  // Resize handles + Delete only on a SOLE selection — a multi-selection just
  // gets the outline (handles on every item would be noise).
  const isPrimarySingle = !brushMode && selectedIds.length <= 1 && selectedId === component.id
  // Edit the layout of the active breakpoint only.
  const layout =
    viewport === 'mobile'
      ? component.mobileLayout || component.layout
      : component.layout
  const page = useEditorStore(selectCurrentPage)
  const canvasWidth = viewport === 'mobile' ? page.mobileWidth || 390 : page.canvasWidth || 1000
  const viewportStretch = component.type === 'region' || (
    component.type === 'navbar' &&
    component.props?.navLayout !== 'vertical' &&
    component.props?.widthMode !== 'boxed'
  )
  const stackedRegion = component.type === 'region'
  // A fixed VERTICAL navbar publishes as a full-height side rail (top:0 →
  // bottom:0). Edit used to draw it at its short design height, so the canvas
  // looked nothing like View. Measure the visible canvas band and render the
  // rail at that height, so Edit frames it exactly like the published page.
  const isFullHeightRail =
    component.type === 'navbar' &&
    component.props?.navLayout === 'vertical' &&
    component.props?.scrollBehavior === 'fixed'
  const [railHeight, setRailHeight] = useState(0)
  useEffect(() => {
    if (!isFullHeightRail) return undefined
    const scroller = document.getElementById('canvas-scroll')
    if (!scroller) return undefined
    // The band is measured in SCREEN pixels but the layout box lives in canvas
    // coordinates, so undo the artboard's fit-scale. Measure once up front —
    // a ResizeObserver alone never yields a first value in environments where
    // it does not fire — then keep it in sync with the observer + resize.
    const measure = () => {
      const scale = canvasScale > 0 ? canvasScale : 1
      const next = Math.max(120, Math.round(scroller.getBoundingClientRect().height / scale))
      setRailHeight((prev) => (prev === next ? prev : next))
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(scroller)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isFullHeightRail, canvasScale])
  // Same rule the published page uses: a fixed full-width top bar starts after
  // any fixed side rail, so its brand can't be swallowed by the rail and the
  // bar sits in the same place here as it does live. DESKTOP ONLY — the phone
  // layout stacks its blocks full-width (the exported mobile CSS insets
  // nothing), so applying a desktop rail's width here would squeeze the bar
  // into a sliver and make Edit disagree with View on mobile.
  const railInset =
    viewport !== 'mobile' &&
    component.type === 'navbar' &&
    component.props?.navLayout !== 'vertical' &&
    component.props?.scrollBehavior === 'fixed' &&
    component.props?.widthMode !== 'boxed'
      ? fixedRailInset(page.components)
      : { left: 0, right: 0 }
  const railInsetLeft = railInset.left
  const railInsetRight = railInset.right
  const x = viewportStretch ? railInset.left : layout.x
  const y = layout.y
  const w = viewportStretch ? Math.max(40, canvasWidth - railInset.left - railInset.right) : layout.w
  const h = isFullHeightRail && railHeight ? railHeight : layout.h
  const chromeRect = {
    x,
    y,
    w,
    h,
    maxW: viewport === 'mobile' ? page.mobileWidth || 390 : page.canvasWidth || 1000,
  }
  const chrome = chromeMetrics(canvasScale)
  const frameOutsets = frameOutsetsFor(chromeRect, chrome)
  const handles = resizeHandles(chromeRect, chrome).filter(([dir]) => (
    stackedRegion ? dir === 's' : !viewportStretch || dir === 'n' || dir === 's'
  ))
  const edgeHitZones = resizeEdgeHitZones(chromeRect, chrome).filter(([dir]) => (
    stackedRegion ? dir === 's' : !viewportStretch || dir === 'n' || dir === 's'
  ))
  const hidden =
    viewport === 'mobile' ? component.hiddenMobile : component.hidden

  // Pinned (fixed/sticky) components stay glued to the visible canvas band
  // while the user scrolls — mirroring how the published site pins them to
  // the viewport. The wrapper keeps its absolute layout position (drag /
  // resize math is untouched); a transform written straight to the DOM on
  // each scroll tick moves it visually, so scrolling never re-renders React.
  const props = component.props || {}
  const pinMode =
    props.scrollBehavior === 'fixed' || props.scrollBehavior === 'sticky'
      ? props.scrollBehavior
      : null
  const wrapRef = useRef(null)

  // Native components whose height is decided by their CONTENT, not by the box
  // the palette guessed. A tabs block with three panels renders ~212px tall in
  // the 220px box it ships with, but any smaller box and it spills out — in the
  // edit canvas AND on the published page, since neither clips. Grow the box
  // onto the content so the selection frame keeps telling the truth. Grow only:
  // shrinking is the user's call, and only growing can't oscillate.
  useEffect(() => {
    if (!CONTENT_GROW_TYPES.has(component.type)) return undefined
    const timer = window.setTimeout(() => {
      const node = wrapRef.current?.firstElementChild?.firstElementChild
      if (!node) return
      const needed = Math.ceil(node.getBoundingClientRect().height / canvasScale)
      if (needed > (layout.h || 0) + 1) setLayout(component.id, { h: needed })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [
    component.id,
    component.type,
    component.props,
    component.children,
    layout.h,
    canvasScale,
    setLayout,
  ])
  const pinY = props.pinY === 'bottom' ? 'bottom' : 'top'
  const pinX = ['right', 'center'].includes(props.pinX) ? props.pinX : 'left'
  const pinOffsetY = Number(props.pinOffsetY) || 0
  const pinOffsetX = Number(props.pinOffsetX) || 0
  useEffect(() => {
    const el = wrapRef.current
    if (!pinMode || !el) return undefined
    const scroller = document.getElementById('canvas-scroll')
    const canvas = document.getElementById('free-canvas')
    if (!scroller || !canvas) return undefined
    const apply = () => {
      const sRect = scroller.getBoundingClientRect()
      const cRect = canvas.getBoundingClientRect()
      // getBoundingClientRect reports SCREEN pixels, but the layout box (x/y/w/h)
      // and this element's transform live in CANVAS coordinates — divide by the
      // artboard's fit-scale or a scaled-down canvas would un-glue pinned items.
      const scale = canvasScale > 0 ? canvasScale : 1
      const canvasH = cRect.height / scale
      const canvasWidthPx = cRect.width / scale
      const viewTop = (sRect.top - cRect.top) / scale
      const viewBottom = viewTop + sRect.height / scale
      let targetY = pinY === 'bottom' ? viewBottom - h - pinOffsetY : viewTop + pinOffsetY
      if (pinMode === 'sticky') {
        // Sticky scrolls with the page until it reaches the pinned edge.
        targetY = pinY === 'bottom' ? Math.min(y, targetY) : Math.max(y, targetY)
      }
      // A NEGATIVE top offset parks the bar slightly off the top edge, exactly
      // as the published page does with `top: <pinOffsetY>`. Clamping the lower
      // bound to 0 swallowed that, so the same bar sat 7px lower in Edit than in
      // View. Let the offset through; the upper clamp still keeps it on-canvas.
      const lowerBound = pinY === 'bottom' ? 0 : Math.min(0, pinOffsetY)
      targetY = Math.min(Math.max(targetY, lowerBound), Math.max(0, canvasH - h))
      // Fixed pins X to the artboard (= the site viewport); sticky keeps design X.
      let targetX = x
      if (pinMode === 'fixed') {
        // The rail inset is part of the pinned position — without it the pin
        // would drag an inset top bar back over the rail it just cleared.
        targetX =
          pinX === 'right'
            ? canvasWidthPx - w - pinOffsetX - railInsetRight
            : pinX === 'center'
              ? (canvasWidthPx - w) / 2 + pinOffsetX
              : pinOffsetX + railInsetLeft
        targetX = Math.min(Math.max(targetX, 0), Math.max(0, canvasWidthPx - w))
      }
      const tx = Math.round(targetX - x)
      const ty = Math.round(targetY - y)
      el.style.transform = tx || ty ? `translate(${tx}px, ${ty}px)` : ''
    }
    apply()
    scroller.addEventListener('scroll', apply, { passive: true })
    window.addEventListener('resize', apply)
    return () => {
      scroller.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      el.style.transform = ''
    }
  }, [pinMode, pinY, pinX, pinOffsetY, pinOffsetX, x, y, w, h, viewport, canvasScale, railInsetLeft, railInsetRight])

  function startMove(e) {
    if (e.button !== 0) return
    if (brushMode) {
      e.stopPropagation()
      e.preventDefault()
      paintComponent(component.id, brushColor, brushTarget)
      onBrushUse(brushColor)
      return
    }
    // Link tool owns the pointer — don't drag/select while arming a link.
    if (linkMode) { e.stopPropagation(); return }
    e.stopPropagation()
    // Shift-click toggles multi-selection (no drag).
    if (e.shiftKey) { toggleSelect(component.id); return }
    if (stackedRegion) { select(component.id); return }
    const state = useEditorStore.getState()
    // Dragging an item that's already part of a multi-selection moves the WHOLE
    // group; otherwise it becomes the single selection first.
    const alreadyMulti = state.selectedIds.length > 1 && state.selectedIds.includes(component.id)
    if (!alreadyMulti) select(component.id)
    const groupIds = alreadyMulti ? state.selectedIds : [component.id]
    const grid = state.gridStep
    const sx = e.clientX
    const sy = e.clientY
    // A FIXED-pinned item ignores its design x/y on the published site, so
    // dragging it edits the PIN OFFSETS instead — the item follows the
    // pointer and stays pinned (the scroll effect repositions it live).
    if (pinMode === 'fixed' && !alreadyMulti) {
      const baseOffX = pinOffsetX
      const baseOffY = pinOffsetY
      // A pinned bar is glued to the visible band, so its offsets are measured
      // against the viewport, not the page: scrolling must NOT feed into them.
      const onMovePin = (ev) => {
        const dx = (ev.clientX - sx) / canvasScale
        const dy = (ev.clientY - sy) / canvasScale
        updateProps(component.id, {
          pinOffsetX: Math.round(baseOffX + (pinX === 'right' ? -dx : dx)),
          pinOffsetY: Math.round(baseOffY + (pinY === 'bottom' ? -dy : dy)),
        })
      }
      state.beginHistoryGesture()
      trackPointerDrag(e, {
        onMove: onMovePin,
        onEnd: () => useEditorStore.getState().endHistoryGesture(),
      })
      return
    }
    // Snapshot the dragged group's origins + the snap siblings/artboard ONCE.
    const page = selectCurrentPage(state)
    const isMobile = state.viewport === 'mobile'
    const layoutKey = isMobile ? 'mobileLayout' : 'layout'
    const origins = {}
    for (const c of page.components || []) {
      if (groupIds.includes(c.id)) {
        const l = c[layoutKey] || c.layout || {}
        origins[c.id] = { x: l.x || 0, y: l.y || 0 }
      }
    }
    const siblings = (page.components || [])
      .filter((c) => !groupIds.includes(c.id))
      .map((c) => {
        const l = c[layoutKey] || c.layout || {}
        return { id: c.id, x: l.x || 0, y: l.y || 0, w: l.w || 0, h: l.h || 0 }
      })
    const artboard = {
      w: isMobile ? page.mobileWidth || 390 : page.canvasWidth || 1000,
      h: 0, // unbounded → vertical guides off the centre/bottom of the page
    }
    // Holding the pointer near the top or bottom edge scrolls the canvas, so a
    // long page can be reached in one drag. The scrolled distance is added to
    // the pointer delta below — without it the item would slide out from under
    // the finger by exactly however far the canvas moved.
    const drag = beginDragScroll((p) => moveTo(p.x, p.y))

    function moveTo(clientX, clientY) {
      const base = origins[component.id]
      // The pointer delta is in SCREEN pixels (÷ zoom); the scroll distance
      // already comes back in design pixels.
      const rawX = viewportStretch ? 0 : base.x + (clientX - sx) / canvasScale
      const rawY = base.y + (clientY - sy) / canvasScale + drag.scrolled()
      const snap = snapDraggedRect(
        { id: component.id, x: rawX, y: rawY, w, h },
        siblings,
        artboard,
        grid,
        snapThresholdFor(canvasScale),
      )
      if (groupIds.length === 1) {
        setLayout(component.id, { x: viewportStretch ? 0 : snap.x, y: snap.y })
      } else {
        const dx = snap.x - base.x
        const dy = snap.y - base.y
        const updates = {}
        for (const id of groupIds) {
          updates[id] = {
            x: Math.max(0, Math.round(origins[id].x + dx)),
            y: Math.max(0, Math.round(origins[id].y + dy)),
          }
        }
        setLayoutMany(updates)
      }
      setDragGuides(snap.guides)
    }
    state.beginHistoryGesture()
    trackPointerDrag(e, {
      onMove: (ev) => {
        drag.track(ev)
        moveTo(ev.clientX, ev.clientY)
      },
      onEnd: () => {
        drag.stop()
        clearDragGuides()
        useEditorStore.getState().endHistoryGesture()
      },
    })
  }

  function startResize(e, dir) {
    e.stopPropagation()
    e.preventDefault()
    select(component.id)
    const sx = e.clientX
    const sy = e.clientY
    const orig = { x, y, w, h }
    // Shape-locked embeds (profile photos, icons) keep a fixed box ratio so a
    // circular avatar can't be squashed into an oval.
    const aspect = embedAspectLock(component)
    // Same deal as dragging: pulling the bottom handle past the visible band
    // scrolls the canvas, and that distance counts as part of the pull.
    const drag = beginDragScroll((p) => resizeTo(p.x, p.y))

    function resizeTo(clientX, clientY) {
      const dx = (clientX - sx) / canvasScale
      const dy = (clientY - sy) / canvasScale + drag.scrolled()
      let { x: nx, y: ny, w: nw, h: nh } = orig
      if (dir.includes('e')) nw = Math.max(MIN, orig.w + dx)
      if (dir.includes('s')) nh = Math.max(MIN, orig.h + dy)
      if (dir.includes('w')) {
        nw = Math.max(MIN, orig.w - dx)
        nx = orig.x + (orig.w - nw)
      }
      if (dir.includes('n')) {
        nh = Math.max(MIN, orig.h - dy)
        ny = orig.y + (orig.h - nh)
      }
      if (aspect) {
        // Drive from the horizontal axis for any handle that moves an
        // east/west edge, else from the vertical axis; then re-anchor the
        // fixed corner so the opposite edge stays put.
        if (dir.includes('e') || dir.includes('w')) nh = Math.max(MIN, Math.round(nw / aspect))
        else nw = Math.max(MIN, Math.round(nh * aspect))
        if (dir.includes('n')) ny = orig.y + orig.h - nh
        if (dir.includes('w')) nx = orig.x + orig.w - nw
      }
      setLayout(component.id, { x: nx, y: ny, w: nw, h: nh })
    }
    useEditorStore.getState().beginHistoryGesture()
    trackPointerDrag(e, {
      onMove: (ev) => {
        drag.track(ev)
        resizeTo(ev.clientX, ev.clientY)
      },
      onEnd: () => {
        drag.stop()
        useEditorStore.getState().endHistoryGesture()
      },
    })
  }

  // Hidden on THIS breakpoint means gone from this canvas — exactly like the
  // published page. It can never get lost: hiding both breakpoints is refused,
  // so the other viewport still shows it, and while it stays selected its
  // actions (including un-hide) remain in the docked toolbar bar.
  if (hidden && !isSelected) return null

  return (
    <div
      ref={wrapRef}
      data-cid={component.id}
      onPointerDown={startMove}
      onClick={(e) => {
        if (!linkMode) return
        e.stopPropagation()
        pickLinkNode(component.id)
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        cursor: brushMode ? BRUSH_CURSOR : linkMode ? 'crosshair' : stackedRegion ? 'default' : 'move',
        // Pinned items float above the page content while scrolled, mirroring
        // their published z-order; selection chrome still wins.
        // Pinned items stack by their REAL published z-order (pinZIndex), not a
        // flat value — otherwise DOM order decided it here and, say, a top bar
        // painted over a side rail in Edit while the rail covered it on the
        // live site. Selection lifts the item so it stays editable.
        zIndex: isSelected || isLinkSource
          ? 1000
          : pinMode
            ? Number(props.pinZIndex) || (pinMode === 'fixed' ? 100 : 20)
            : 1,
        opacity: hidden ? 0.35 : 1,
        // Armed link source stays a solid blue ring (with a light wash) until
        // the next click picks the target — same affordance as HTML mode.
        background: isLinkSource ? 'rgba(79, 70, 229, 0.10)' : undefined,
        ...hoverRingStyle(chrome, frameOutsets),
      }}
      className={isSelected || linkMode || brushMode ? '' : HOVER_RING_CLASS}
    >
      {component.type === 'region' ? (
        <div className="h-full w-full overflow-visible">
          <RegionEditor
            component={component}
            canvasScale={canvasScale}
            brushMode={brushMode}
            brushColor={brushColor}
            brushTarget={brushTarget}
            onBrushUse={onBrushUse}
          />
        </div>
      ) : component.type === 'container' ? (
        <div className="h-full w-full overflow-visible">
          <ContainerEditor
            component={component}
            canvasScale={canvasScale}
            brushMode={brushMode}
            brushColor={brushColor}
            brushTarget={brushTarget}
            onBrushUse={onBrushUse}
          />
        </div>
      ) : component.type === 'tabs' ? (
        <div className="h-full w-full overflow-visible">
          <TabsEditor
            component={component}
            canvasScale={canvasScale}
            brushMode={brushMode}
            brushColor={brushColor}
            brushTarget={brushTarget}
            onBrushUse={onBrushUse}
          />
        </div>
      ) : (
        <div className="pointer-events-none h-full w-full select-none overflow-visible">
          <RenderComponent component={component} viewport={viewport} editorPreview />
        </div>
      )}

      {hidden && (
        <span
          style={chromeBadgeStyle(chrome, 'top-left')}
          className="rounded-lg bg-[#111827]/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {t('Hidden on {viewport}', { viewport: t(viewport === 'mobile' ? 'mobile' : 'PC') })}
        </span>
      )}

      {pinMode && (
        <span
          title={
            pinMode === 'fixed'
              ? 'Pinned to the screen — stays put while the page scrolls. Drag to adjust the pin offsets.'
              : 'Sticky — scrolls with the page until it reaches the edge, then stays.'
          }
          style={chromeBadgeStyle(chrome, 'bottom-left')}
          className="rounded-lg bg-[#4f46e5]/85 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {pinMode === 'fixed' ? 'Pinned' : 'Sticky'}
        </span>
      )}

      {((isSelected && !brushMode) || isLinkSource) && (
        <SelectionFrame outsets={frameOutsets} metrics={chrome} link={isLinkSource} />
      )}

      {/* The action bar itself is docked in the editor toolbar (one stable
          spot for every element) — only the resize affordances live here. */}
      {isPrimarySingle && !linkMode && (
        <ResizeAffordances
          handles={handles}
          edgeZones={edgeHitZones}
          metrics={chrome}
          onStart={startResize}
        />
      )}
    </div>
  )
}
