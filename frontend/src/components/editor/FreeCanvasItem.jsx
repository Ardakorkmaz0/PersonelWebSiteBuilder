import { useEffect, useRef } from 'react'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { RenderComponent } from '../renderer/Renderer.jsx'
import { ContainerEditor, RegionEditor, TabsEditor } from './FlowCanvasItem.jsx'
import CanvasSelectionActions from './CanvasSelectionActions.jsx'
import { snapDraggedRect } from '../../utils/snapping.js'
import { BRUSH_CURSOR } from './brushCursor.js'
import { useLanguage } from '../../i18n/useLanguage.js'

const MIN = 20
const ACCENT = '#4f46e5'
const HANDLE_SIZE = 10
const HANDLE_OFFSET = HANDLE_SIZE / 2
const EDGE_HIT_SIZE = 14
const EDGE_HIT_OFFSET = EDGE_HIT_SIZE / 2
const FRAME_OUTSET = 2

function edgeOutsets(rect, amount) {
  const maxW = rect.maxW || 0
  const maxH = rect.maxH || 0
  return {
    top: rect.y <= amount ? 0 : -amount,
    left: rect.x <= amount ? 0 : -amount,
    right: maxW && rect.x + rect.w >= maxW - amount ? 0 : -amount,
    bottom: maxH && rect.y + rect.h >= maxH - amount ? 0 : -amount,
  }
}

// [direction, absolute-position style, cursor]
function resizeHandles(rect) {
  const edge = edgeOutsets(rect, HANDLE_OFFSET)
  return [
    ['nw', { top: edge.top, left: edge.left }, 'nwse-resize'],
    ['n', { top: edge.top, left: '50%', marginLeft: -HANDLE_OFFSET }, 'ns-resize'],
    ['ne', { top: edge.top, right: edge.right }, 'nesw-resize'],
    ['e', { top: '50%', right: edge.right, marginTop: -HANDLE_OFFSET }, 'ew-resize'],
    ['se', { bottom: edge.bottom, right: edge.right }, 'nwse-resize'],
    ['s', { bottom: edge.bottom, left: '50%', marginLeft: -HANDLE_OFFSET }, 'ns-resize'],
    ['sw', { bottom: edge.bottom, left: edge.left }, 'nesw-resize'],
    ['w', { top: '50%', left: edge.left, marginTop: -HANDLE_OFFSET }, 'ew-resize'],
  ]
}

function resizeEdgeHitZones(rect) {
  const edge = edgeOutsets(rect, EDGE_HIT_OFFSET)
  return [
    ['n', { top: edge.top, left: 0, right: 0, height: EDGE_HIT_SIZE }, 'ns-resize'],
    ['e', { top: 0, right: edge.right, bottom: 0, width: EDGE_HIT_SIZE }, 'ew-resize'],
    ['s', { bottom: edge.bottom, left: 0, right: 0, height: EDGE_HIT_SIZE }, 'ns-resize'],
    ['w', { top: 0, left: edge.left, bottom: 0, width: EDGE_HIT_SIZE }, 'ew-resize'],
  ]
}

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
  const x = viewportStretch ? 0 : layout.x
  const y = layout.y
  const w = viewportStretch ? canvasWidth : layout.w
  const h = layout.h
  const chromeRect = {
    x,
    y,
    w,
    h,
    maxW: viewport === 'mobile' ? page.mobileWidth || 390 : page.canvasWidth || 1000,
  }
  const frameOutsets = edgeOutsets(chromeRect, FRAME_OUTSET)
  const handles = resizeHandles(chromeRect).filter(([dir]) => (
    stackedRegion ? dir === 's' : !viewportStretch || dir === 'n' || dir === 's'
  ))
  const edgeHitZones = resizeEdgeHitZones(chromeRect).filter(([dir]) => (
    stackedRegion ? dir === 's' : !viewportStretch || dir === 'n' || dir === 's'
  ))
  const actionBarWidth = 168
  const actionBarLeft = Math.max(
    4 - x,
    Math.min((w - actionBarWidth) / 2, canvasWidth - x - actionBarWidth - 4),
  )
  const actionBarTop = y >= 44 ? -40 : 8
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
      // The visible scrollport band, in canvas coordinates (edit mode is 1:1).
      const viewTop = sRect.top - cRect.top
      const viewBottom = viewTop + sRect.height
      let targetY = pinY === 'bottom' ? viewBottom - h - pinOffsetY : viewTop + pinOffsetY
      if (pinMode === 'sticky') {
        // Sticky scrolls with the page until it reaches the pinned edge.
        targetY = pinY === 'bottom' ? Math.min(y, targetY) : Math.max(y, targetY)
      }
      targetY = Math.min(Math.max(targetY, 0), Math.max(0, cRect.height - h))
      // Fixed pins X to the artboard (= the site viewport); sticky keeps design X.
      let targetX = x
      if (pinMode === 'fixed') {
        targetX =
          pinX === 'right'
            ? cRect.width - w - pinOffsetX
            : pinX === 'center'
              ? (cRect.width - w) / 2 + pinOffsetX
              : pinOffsetX
        targetX = Math.min(Math.max(targetX, 0), Math.max(0, cRect.width - w))
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
  }, [pinMode, pinY, pinX, pinOffsetY, pinOffsetX, x, y, w, h, viewport])

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
      const onMovePin = (ev) => {
        const dx = (ev.clientX - sx) / canvasScale
        const dy = (ev.clientY - sy) / canvasScale
        updateProps(component.id, {
          pinOffsetX: Math.round(baseOffX + (pinX === 'right' ? -dx : dx)),
          pinOffsetY: Math.round(baseOffY + (pinY === 'bottom' ? -dy : dy)),
        })
      }
      const onUpPin = () => {
        window.removeEventListener('pointermove', onMovePin)
        window.removeEventListener('pointerup', onUpPin)
      }
      window.addEventListener('pointermove', onMovePin)
      window.addEventListener('pointerup', onUpPin)
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
    function onMove(ev) {
      const base = origins[component.id]
      const rawX = viewportStretch ? 0 : base.x + (ev.clientX - sx) / canvasScale
      const rawY = base.y + (ev.clientY - sy) / canvasScale
      const snap = snapDraggedRect(
        { id: component.id, x: rawX, y: rawY, w, h },
        siblings,
        artboard,
        grid,
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
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      clearDragGuides()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(e, dir) {
    e.stopPropagation()
    e.preventDefault()
    select(component.id)
    const sx = e.clientX
    const sy = e.clientY
    const orig = { x, y, w, h }
    function onMove(ev) {
      const dx = (ev.clientX - sx) / canvasScale
      const dy = (ev.clientY - sy) / canvasScale
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
      setLayout(component.id, { x: nx, y: ny, w: nw, h: nh })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

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
        zIndex: isSelected || isLinkSource ? 20 : pinMode ? 10 : 1,
        opacity: hidden ? 0.35 : 1,
        // Armed link source stays a solid blue ring (with a light wash) until
        // the next click picks the target — same affordance as HTML mode.
        background: isLinkSource ? 'rgba(79, 70, 229, 0.10)' : undefined,
      }}
      className={
        isSelected || linkMode || brushMode ? '' : 'hover:shadow-[inset_0_0_0_1px_#a6b7d6]'
      }
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
          style={{ position: 'absolute', top: 2, left: 2, zIndex: 25 }}
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
          style={{ position: 'absolute', bottom: 2, left: 2, zIndex: 25 }}
          className="rounded-lg bg-[#4f46e5]/85 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {pinMode === 'fixed' ? 'Pinned' : 'Sticky'}
        </span>
      )}

      {((isSelected && !brushMode) || isLinkSource) && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: frameOutsets.top,
            right: frameOutsets.right,
            bottom: frameOutsets.bottom,
            left: frameOutsets.left,
            border: `${isLinkSource ? 3 : 2}px solid ${ACCENT}`,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 28,
          }}
        />
      )}

      {isPrimarySingle && !linkMode && (
        <>
          <CanvasSelectionActions
            componentId={component.id}
            style={{ top: actionBarTop, left: actionBarLeft }}
          />
          {edgeHitZones.map(([dir, pos, cursor]) => (
            <div
              key={`edge-${dir}`}
              aria-hidden="true"
              onPointerDown={(e) => startResize(e, dir)}
              style={{
                position: 'absolute',
                zIndex: 29,
                cursor,
                touchAction: 'none',
                ...pos,
              }}
            />
          ))}
          {handles.map(([dir, pos, cursor]) => (
            <div
              key={dir}
              onPointerDown={(e) => startResize(e, dir)}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: ACCENT,
                border: '1px solid #ffffff',
                borderRadius: 2,
                boxShadow: '0 1px 5px rgba(15,23,42,0.22)',
                zIndex: 30,
                cursor,
                ...pos,
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
