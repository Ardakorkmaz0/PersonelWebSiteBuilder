import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useEditorStore } from '../../store/editorStore.js'
import { BanIcon } from '../icons.jsx'
import {
  absoluteChildrenHeight,
  flowItemStyle,
  isHidden,
  isFlowFullWidth,
  stylesFor,
} from '../renderer/layout.js'
import { RenderComponent } from '../renderer/Renderer.jsx'
import { TAB_STYLES } from '../renderer/constants.js'
import { sanitizeStyles } from '../../utils/sanitize.js'
import { BRUSH_CURSOR } from './brushCursor.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import {
  regionContentWidth,
  regionDisplayPatchToDesign,
  responsiveRegionChildLayout,
} from '../../utils/regionLayout.js'
import { autoLayoutChildStyle, autoLayoutContainerStyle } from '../../utils/autoLayout.js'

const ACCENT = '#4f46e5'
const MIN = 20
const HANDLE_SIZE = 10
const HANDLE_OFFSET = HANDLE_SIZE / 2
const EDGE_HIT_SIZE = 14
const EDGE_HIT_OFFSET = EDGE_HIT_SIZE / 2
const FRAME_OUTSET = 2
const FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])

// Resize handles for flow mode. Width (E) controls how the block packs in its row;
// Height (S) sets the box height; SE does both. Full-bleed blocks only expose
// height. Width only matters on PC (mobile blocks are full-width), but HEIGHT is
// editable on mobile too so the spacing can be tuned there like on PC.
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

function freeResizeHandles(rect) {
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

function freeResizeEdgeHitZones(rect) {
  const edge = edgeOutsets(rect, EDGE_HIT_OFFSET)
  return [
    ['n', { top: edge.top, left: 0, right: 0, height: EDGE_HIT_SIZE }, 'ns-resize'],
    ['e', { top: 0, right: edge.right, bottom: 0, width: EDGE_HIT_SIZE }, 'ew-resize'],
    ['s', { bottom: edge.bottom, left: 0, right: 0, height: EDGE_HIT_SIZE }, 'ns-resize'],
    ['w', { top: 0, left: edge.left, bottom: 0, width: EDGE_HIT_SIZE }, 'ew-resize'],
  ]
}

function flowResizeHandles({ full, viewport }) {
  const horizontal = full ? 0 : -HANDLE_OFFSET
  const bottom = -HANDLE_OFFSET
  const handles = [
    ['s', { bottom, left: '50%', marginLeft: -HANDLE_OFFSET }, 'ns-resize'],
  ]
  if (!full && viewport === 'pc') {
    handles.unshift(['e', { top: '50%', right: horizontal, marginTop: -HANDLE_OFFSET }, 'ew-resize'])
    handles.push(['se', { bottom, right: horizontal }, 'nwse-resize'])
  }
  return handles
}

function flowResizeEdgeHitZones({ full, viewport }) {
  const edges = [
    ['s', { bottom: -EDGE_HIT_OFFSET, left: 0, right: 0, height: EDGE_HIT_SIZE }, 'ns-resize'],
  ]
  if (!full && viewport === 'pc') {
    edges.push(['e', { top: 0, right: -EDGE_HIT_OFFSET, bottom: 0, width: EDGE_HIT_SIZE }, 'ew-resize'])
  }
  return edges
}

export default function FlowCanvasItem({
  component,
  canvasWidth,
  canvasScale = 1,
  parentDirection = 'row',
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const { t } = useLanguage()
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const setLayout = useEditorStore((s) => s.setLayout)
  const paintComponent = useEditorStore((s) => s.paintComponent)

  const isSelected = selectedId === component.id
  const hidden = isHidden(component, viewport)
  const fixedHeight = FIXED_HEIGHT_TYPES.has(component.type)
  const full = isFlowFullWidth(component)

  // Pinned behavior mirrored in the edit canvas (same idea as FreeCanvasItem):
  // sticky uses NATIVE position:sticky — flow items are in flow, so it engages
  // against #canvas-scroll exactly like the published page. Fixed keeps its
  // flow slot (so the layout stays editable) but a scroll-driven transform
  // glues it to the visible band, matching what visitors see.
  const props = component.props || {}
  const pinMode =
    props.scrollBehavior === 'fixed' || props.scrollBehavior === 'sticky'
      ? props.scrollBehavior
      : null
  const pinY = props.pinY === 'bottom' ? 'bottom' : 'top'
  const pinX = ['right', 'left'].includes(props.pinX) ? props.pinX : 'center'
  const pinOffsetY = Number(props.pinOffsetY) || 0
  const pinOffsetX = Number(props.pinOffsetX) || 0
  const pinRef = useRef(null)
  useEffect(() => {
    const el = pinRef.current
    if (pinMode !== 'fixed' || !el) return undefined
    const scroller = document.getElementById('canvas-scroll')
    const canvas = document.getElementById('free-canvas')
    if (!scroller || !canvas) return undefined
    let prev = { x: 0, y: 0 }
    const apply = () => {
      const sRect = scroller.getBoundingClientRect()
      const cRect = canvas.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      // The item's untransformed flow position, in canvas coordinates (1:1).
      const baseX = r.left - cRect.left - prev.x
      const baseY = r.top - cRect.top - prev.y
      const viewTop = sRect.top - cRect.top
      const viewBottom = viewTop + sRect.height
      let targetY = pinY === 'bottom' ? viewBottom - r.height - pinOffsetY : viewTop + pinOffsetY
      targetY = Math.min(Math.max(targetY, 0), Math.max(0, cRect.height - r.height))
      let targetX =
        pinX === 'right'
          ? cRect.width - r.width - pinOffsetX
          : pinX === 'left'
            ? pinOffsetX
            : (cRect.width - r.width) / 2 + pinOffsetX
      targetX = Math.min(Math.max(targetX, 0), Math.max(0, cRect.width - r.width))
      prev = { x: Math.round(targetX - baseX), y: Math.round(targetY - baseY) }
      el.style.transform = prev.x || prev.y ? `translate(${prev.x}px, ${prev.y}px)` : ''
    }
    apply()
    scroller.addEventListener('scroll', apply, { passive: true })
    window.addEventListener('resize', apply)
    return () => {
      scroller.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      el.style.transform = ''
    }
  }, [pinMode, pinY, pinX, pinOffsetY, pinOffsetX, viewport])

  function startResize(e, dir) {
    e.stopPropagation()
    e.preventDefault()
    select(component.id)
    const sx = e.clientX
    const sy = e.clientY
    const orig = {
      w: Math.round(component.layout?.w || 240),
      h: Math.round(component.layout?.h || 80),
    }
    function onMove(ev) {
      const patch = {}
      if (dir.includes('e')) patch.w = Math.max(MIN, orig.w + (ev.clientX - sx) / canvasScale)
      if (dir.includes('s')) patch.h = Math.max(MIN, orig.h + (ev.clientY - sy) / canvasScale)
      setLayout(component.id, patch)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Hidden on this breakpoint: don't render the full (faded) box — it just leaves a
  // big empty gap. Show a slim marker instead, so the layout matches the published
  // page while staying clickable to bring the block back (via the panel's "Show on…").
  if (hidden) {
    return (
      <div
        onPointerDown={(e) => {
          e.stopPropagation()
          if (brushMode) {
            paintComponent(component.id, brushColor, brushTarget)
            onBrushUse(brushColor)
          } else {
            select(component.id)
          }
        }}
        style={{ flex: '0 0 100%', width: '100%', cursor: brushMode ? BRUSH_CURSOR : 'pointer', zIndex: isSelected ? 20 : 1 }}
      >
        <div
          className={`flex items-center gap-2 rounded-lg border border-dashed px-2 py-1 text-[11px] ${
            isSelected
              ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]'
              : 'border-[#d1d5db] bg-[#f9fafb] text-[#9ca3af] hover:text-[#6b7280]'
          }`}
        >
          <BanIcon size={13} aria-hidden />
          <span className="font-medium capitalize">{component.type}</span>
          <span>· {t('hidden on {viewport}', { viewport: t(viewport === 'mobile' ? 'mobile' : 'PC') })}</span>
          <span className="ml-auto opacity-70">{t('select to show')}</span>
        </div>
      </div>
    )
  }

  const horizontalFrameOutset = full || viewport !== 'pc' || parentDirection === 'column'
    ? 0
    : -FRAME_OUTSET
  const frameOutsets = {
    top: -FRAME_OUTSET,
    right: horizontalFrameOutset,
    bottom: -FRAME_OUTSET,
    left: horizontalFrameOutset,
  }
  const handles = isSelected && !brushMode ? flowResizeHandles({ full, viewport }) : []
  const edgeHitZones = isSelected && !brushMode ? flowResizeEdgeHitZones({ full, viewport }) : []

  return (
    <div
      ref={pinRef}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (brushMode) {
          paintComponent(component.id, brushColor, brushTarget)
          onBrushUse(brushColor)
        } else {
          select(component.id)
        }
      }}
      style={{
        ...flowItemStyle(component, viewport, canvasWidth, { parentDirection }),
        // Sticky is native here — flow items are in flow, so the canvas scroll
        // engages it exactly like the published page does.
        ...(pinMode === 'sticky'
          ? { position: 'sticky', [pinY === 'bottom' ? 'bottom' : 'top']: pinOffsetY }
          : {}),
        cursor: brushMode ? BRUSH_CURSOR : 'pointer',
        zIndex: isSelected ? 20 : pinMode ? 10 : 1,
      }}
      className={isSelected || brushMode ? '' : 'hover:shadow-[inset_0_0_0_1px_#a6b7d6]'}
    >
      {pinMode && (
        <span
          title={
            pinMode === 'fixed'
              ? 'Pinned to the screen — stays put while the page scrolls.'
              : 'Sticky — scrolls with the page until it reaches the edge, then stays.'
          }
          style={{ position: 'absolute', bottom: 2, left: 2, zIndex: 25 }}
          className="rounded-lg bg-[#4f46e5]/85 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          {pinMode === 'fixed' ? 'Pinned' : 'Sticky'}
        </span>
      )}
      {component.type === 'region' ? (
        <RegionEditor
          component={component}
          canvasScale={canvasScale}
          brushMode={brushMode}
          brushColor={brushColor}
          brushTarget={brushTarget}
          onBrushUse={onBrushUse}
        />
      ) : component.type === 'container' ? (
        <ContainerEditor
          component={component}
          canvasScale={canvasScale}
          brushMode={brushMode}
          brushColor={brushColor}
          brushTarget={brushTarget}
          onBrushUse={onBrushUse}
        />
      ) : component.type === 'tabs' ? (
        <TabsEditor
          component={component}
          canvasScale={canvasScale}
          brushMode={brushMode}
          brushColor={brushColor}
          brushTarget={brushTarget}
          onBrushUse={onBrushUse}
        />
      ) : (
        <div
          className="pointer-events-none w-full select-none"
          style={{
            height: fixedHeight ? '100%' : 'auto',
            minHeight: fixedHeight ? undefined : '100%',
            overflow: 'visible',
          }}
        >
          <RenderComponent component={component} flowMode viewport={viewport} editorPreview />
        </div>
      )}

      {isSelected && !brushMode && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: frameOutsets.top,
            right: frameOutsets.right,
            bottom: frameOutsets.bottom,
            left: frameOutsets.left,
            border: `2px solid ${ACCENT}`,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 28,
          }}
        />
      )}

      {/* Element actions are docked in the editor toolbar — one stable spot for
          every selection, nested ones included, so nothing floats over the design. */}

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
    </div>
  )
}

// Measure a ref's actual rendered width and return a {scale, height} pair that
// fits a virtual `designW` x `designH` mini-canvas into it. When the rendered
// width matches or exceeds the design width, scale=1 (no shrink). Used so
// container/tabs panels stay visually responsive on the mobile artboard even
// though their children are positioned in PC design pixels.
function useFitToWidth(designW, designH) {
  const ref = useRef(null)
  const [actualW, setActualW] = useState(designW || 1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setActualW(el.clientWidth || designW || 1)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [designW])
  const safeDesign = Math.max(1, designW || 1)
  const scale = actualW < safeDesign ? actualW / safeDesign : 1
  return { ref, actualW, scale, scaledHeight: Math.max(0, designH * scale) }
}

// Wix-like section: the background fills the browser, while attached elements
// stay readable inside gridlines. Desktop uses docking; mobile edits the same
// content through its own layout instead of shrinking the whole section.
export function RegionEditor({
  component,
  canvasScale = 1,
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const { t } = useLanguage()
  const viewport = useEditorStore((s) => s.viewport)
  const selectedId = useEditorStore((s) => s.selectedId)
  const kids = Array.isArray(component.children) ? component.children : []
  const designW = regionContentWidth(component)
  const activeRegionLayout = viewport === 'mobile'
    ? component.mobileLayout || component.layout || {}
    : component.layout || {}
  const designH = Math.max(80, Math.round(activeRegionLayout.h || 360))
  const { setNodeRef, isOver } = useDroppable({ id: component.id })
  const userStyles = sanitizeStyles(stylesFor(component, viewport))
  const { ref, actualW } = useFitToWidth(designW, designH)
  const safeW = Math.max(1, Math.min(designW, actualW || designW))
  const showGrid = selectedId === component.id || isOver || kids.length === 0
  const setRefs = (el) => {
    ref.current = el
    setNodeRef(el)
  }
  return (
    <section
      style={{
        ...userStyles,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: userStyles.overflow || 'hidden',
      }}
    >
      <div
        ref={setRefs}
        data-builder-droppable-id={component.id}
        data-builder-fit-scale="1"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: designW,
          height: '100%',
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        {showGrid && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 border-l border-dashed border-[#4f46e5]/55" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 border-r border-dashed border-[#4f46e5]/55" />
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-[#4f46e5]/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {t('Content grid')} · {Math.round(safeW)}px
            </span>
          </>
        )}
        {kids.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-[#6b7280]">
            {t('Drop components inside the content grid.')}
          </div>
        ) : kids.map((c) => {
          const displayLayout = responsiveRegionChildLayout(c, designW, safeW, viewport)
          return (
            <TabsCanvasItem
              key={c.id}
              component={c}
              bounds={{ w: safeW, h: designH }}
              layoutOverride={displayLayout}
              layoutMapper={(patch) => regionDisplayPatchToDesign(
                c,
                patch,
                displayLayout,
                designW,
                safeW,
                viewport,
              )}
              interactionScale={canvasScale}
              brushMode={brushMode}
              brushColor={brushColor}
              brushTarget={brushTarget}
              onBrushUse={onBrushUse}
            />
          )
        })}
      </div>
    </section>
  )
}

// The editable inside of a container: a droppable mini-canvas whose children
// are positioned freely. Children live in PC design coordinates, so on a
// narrower artboard we scale the inner mini-canvas down with transform so it
// fits without horizontal scroll AND keeps its proportions.
export function ContainerEditor({
  component,
  canvasScale = 1,
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const { t } = useLanguage()
  const viewport = useEditorStore((s) => s.viewport)
  const kids = Array.isArray(component.children) ? component.children : []
  const designW = Math.max(1, Math.round(component.layout?.w || 600))
  const designH = absoluteChildrenHeight(kids, Math.round(component.layout?.h || 160))
  const boundsH = Math.max(1, Math.round(component.layout?.h || designH))
  const { setNodeRef, isOver } = useDroppable({ id: component.id })
  const userStyles = sanitizeStyles(stylesFor(component, viewport))
  const { ref, scale, scaledHeight } = useFitToWidth(designW, designH)
  const setRefs = (el) => {
    ref.current = el
    setNodeRef(el)
  }

  // Auto-layout: children FLOW (flex/grid) exactly as they render/publish, so
  // the editor is WYSIWYG. Each child is a click-to-select cell (no absolute
  // handles); dropping onto the container appends, and the layer arrows reorder.
  const autoStyle = autoLayoutContainerStyle(component.props)
  if (autoStyle) {
    return (
      <div
        ref={setRefs}
        data-builder-droppable-id={component.id}
        data-builder-fit-scale={1}
        style={{
          ...userStyles,
          ...autoStyle,
          width: '100%',
          height: 'auto',
          boxSizing: 'border-box',
          outline: isOver ? `2px dashed ${ACCENT}` : undefined,
          outlineOffset: -2,
        }}
      >
        {kids.length === 0 ? (
          <div className="pointer-events-none flex min-h-16 items-center justify-center py-4 text-center text-xs text-[#9ca3af]">
            {t('Drop components here')}
          </div>
        ) : (
          kids.map((c) => (
            <FlowChildItem
              key={c.id}
              component={c}
              container={component}
              brushMode={brushMode}
              brushColor={brushColor}
              brushTarget={brushTarget}
              onBrushUse={onBrushUse}
            />
          ))
        )}
      </div>
    )
  }
  return (
    <div
      ref={setRefs}
      data-builder-droppable-id={component.id}
      data-builder-fit-scale={scale}
      style={{
        ...userStyles,
        width: '100%',
        minHeight: scaledHeight,
        boxSizing: 'border-box',
        position: 'relative',
        overflowX: userStyles.overflow || userStyles.overflowX || 'clip',
        outline: isOver ? `2px dashed ${ACCENT}` : undefined,
        outlineOffset: -2,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: designW,
          height: designH,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {kids.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center py-4 text-center text-xs text-[#9ca3af]">
            {t('Drop components here')}
          </div>
        ) : (
          kids.map((c) => (
            <TabsCanvasItem
              key={c.id}
              component={c}
              bounds={{ w: designW, h: boundsH }}
              interactionScale={canvasScale * scale}
              brushMode={brushMode}
              brushColor={brushColor}
              brushTarget={brushTarget}
              onBrushUse={onBrushUse}
            />
          ))
        )}
      </div>
    </div>
  )
}

// One child inside an auto-layout container: an in-flow cell that renders the
// real component and selects on click. Sizing comes from autoLayoutChildStyle
// so the editor matches the published flow exactly.
function FlowChildItem({
  component,
  container,
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const paintComponent = useEditorStore((s) => s.paintComponent)
  if (isHidden(component, viewport)) return null
  const isSelected = selectedId === component.id
  const childStyle = autoLayoutChildStyle(component, container.props) || {}
  return (
    <div
      data-cid={component.id}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        if (brushMode) {
          paintComponent(component.id, brushColor, brushTarget)
          onBrushUse(brushColor)
          return
        }
        select(component.id)
      }}
      style={{
        ...childStyle,
        position: 'relative',
        boxSizing: 'border-box',
        cursor: brushMode ? BRUSH_CURSOR : 'pointer',
        outline: isSelected ? `2px solid ${ACCENT}` : undefined,
        outlineOffset: 1,
        borderRadius: 4,
      }}
    >
      <div className="pointer-events-none h-full w-full">
        <RenderComponent component={component} viewport={viewport} editorPreview />
      </div>
    </div>
  )
}

function TabsCanvasItem({
  component,
  bounds,
  layoutOverride = null,
  layoutMapper = null,
  interactionScale = 1,
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const { t } = useLanguage()
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const setLayout = useEditorStore((s) => s.setLayout)
  const paintComponent = useEditorStore((s) => s.paintComponent)
  const isSelected = selectedId === component.id
  const hidden = isHidden(component, viewport)
  const l = layoutOverride || component.layout || {}
  const x = Math.round(l.x || 0)
  const y = Math.round(l.y || 0)
  const w = Math.max(MIN, Math.round(l.w || 200))
  const h = Math.max(MIN, Math.round(l.h || 80))
  const chromeRect = {
    x,
    y,
    w,
    h,
    maxW: bounds?.w,
    maxH: bounds?.h,
  }
  const frameOutsets = edgeOutsets(chromeRect, FRAME_OUTSET)
  const handles = brushMode ? [] : freeResizeHandles(chromeRect)
  const edgeHitZones = brushMode ? [] : freeResizeEdgeHitZones(chromeRect)
  const applyLayout = (patch) => setLayout(
    component.id,
    layoutMapper ? layoutMapper(patch, { x, y, w, h }) : patch,
  )

  function startMove(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    if (brushMode) {
      e.preventDefault()
      paintComponent(component.id, brushColor, brushTarget)
      onBrushUse(brushColor)
      return
    }
    select(component.id)
    const sx = e.clientX
    const sy = e.clientY
    const orig = { x, y }
    function onMove(ev) {
      applyLayout({
        x: orig.x + (ev.clientX - sx) / interactionScale,
        y: orig.y + (ev.clientY - sy) / interactionScale,
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
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
      const dx = (ev.clientX - sx) / interactionScale
      const dy = (ev.clientY - sy) / interactionScale
      let nx = orig.x
      let ny = orig.y
      let nw = orig.w
      let nh = orig.h
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
      applyLayout({ x: nx, y: ny, w: nw, h: nh })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Hidden on THIS breakpoint means gone from this canvas, like the published
  // page. Selected items stay so the docked toolbar can un-hide them.
  if (hidden && !isSelected) return null

  return (
    <div
      onPointerDown={startMove}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        cursor: brushMode ? BRUSH_CURSOR : 'move',
        zIndex: isSelected ? 20 : 1,
        opacity: hidden ? 0.35 : 1,
      }}
      className={isSelected || brushMode ? '' : 'hover:shadow-[inset_0_0_0_1px_#a6b7d6]'}
    >
      {component.type === 'region' ? (
        <div className="h-full w-full overflow-visible">
          <RegionEditor
            component={component}
            canvasScale={interactionScale}
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
            canvasScale={interactionScale}
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
            canvasScale={interactionScale}
            brushMode={brushMode}
            brushColor={brushColor}
            brushTarget={brushTarget}
            onBrushUse={onBrushUse}
          />
        </div>
      ) : (
        <div className="pointer-events-none h-full w-full select-none overflow-hidden">
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

      {isSelected && !brushMode && (
        <>
          {/* Actions live in the docked toolbar bar; only the frame is drawn here. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: frameOutsets.top,
              right: frameOutsets.right,
              bottom: frameOutsets.bottom,
              left: frameOutsets.left,
              border: `2px solid ${ACCENT}`,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 28,
            }}
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

// Editable tabs container: header strip switches the design's active panel and
// the active panel is a droppable target so new components land in the tab the
// user is looking at. Children carry `tabId` to remember which panel they belong
// to. Static export emits all panels and a tiny JS shim toggles between them.
export function TabsEditor({
  component,
  canvasScale = 1,
  brushMode = false,
  brushColor = '#4f46e5',
  brushTarget = 'smart',
  onBrushUse = () => {},
}) {
  const { t } = useLanguage()
  const tabsViewport = useEditorStore((s) => s.viewport)
  const p = component.props || {}
  const tabsList = Array.isArray(p.tabs) && p.tabs.length
    ? p.tabs.filter((tab) => tab && tab.id)
    : [{ id: 't1', label: 'Tab' }]
  const activeId = tabsList.some((tab) => tab.id === p.activeId) ? p.activeId : tabsList[0].id
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const select = useEditorStore((s) => s.selectComponent)
  const kids = Array.isArray(component.children) ? component.children : []
  const panelKids = kids.filter((c) => (c.tabId || tabsList[0].id) === activeId)
  const designW = Math.max(1, Math.round(component.layout?.w || 600))
  const designH = absoluteChildrenHeight(panelKids, 120)
  const boundsH = Math.max(1, Math.round(component.layout?.h || designH))
  const { setNodeRef, isOver } = useDroppable({ id: component.id })
  const { ref: panelRef, scale, scaledHeight } = useFitToWidth(designW, designH)
  const setPanelRefs = (el) => {
    panelRef.current = el
    setNodeRef(el)
  }
  const tablistStyle = {
    ...TAB_STYLES.tablist,
    gap: p.tabGap || TAB_STYLES.tablist.gap,
    background: p.tablistBackgroundColor || 'transparent',
    borderBottom: `1px solid ${p.tablistBorderColor || '#e5e7eb'}`,
    padding: p.tablistPadding || TAB_STYLES.tablist.padding,
  }
  const tabBaseStyle = {
    ...TAB_STYLES.tab,
    background: p.tabBackgroundColor || 'transparent',
    color: p.tabTextColor || TAB_STYLES.tab.color,
    borderRadius: p.tabBorderRadius || 0,
    padding: p.tabPadding || TAB_STYLES.tab.padding,
  }
  const tabActiveStyle = {
    ...TAB_STYLES.tabActive,
    background: p.activeTabBackgroundColor || p.tabBackgroundColor || 'transparent',
    color: p.activeTabColor || TAB_STYLES.tabActive.color,
    borderBottomColor: p.activeTabBorderColor || TAB_STYLES.tabActive.borderBottomColor,
  }
  const panelStyle = {
    ...TAB_STYLES.panel,
    background: p.panelBackgroundColor || 'transparent',
    border: `1px solid ${p.panelBorderColor || 'transparent'}`,
    borderRadius: p.panelBorderRadius || 0,
    padding: p.panelPadding || 0,
    boxSizing: 'border-box',
  }
  return (
    <div
      style={{
        ...sanitizeStyles(stylesFor(component, tabsViewport)),
        width: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div role="tablist" style={tablistStyle}>
        {tabsList.map((tab) => {
          const sel = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                if (!brushMode) select(component.id)
              }}
              onPointerUp={(e) => {
                e.stopPropagation()
                if (!sel) setActiveTab(component.id, tab.id)
              }}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (!sel) setActiveTab(component.id, tab.id)
              }}
              style={{
                ...tabBaseStyle,
                ...(sel ? tabActiveStyle : null),
              }}
            >
              {tab.label || t('Tab')}
            </button>
          )
        })}
      </div>
      <div
        ref={setPanelRefs}
        data-builder-droppable-id={component.id}
        data-builder-fit-scale={scale}
        style={{
          ...panelStyle,
          position: 'relative',
          minHeight: scaledHeight,
          overflowX: 'clip',
          outline: isOver ? `2px dashed ${ACCENT}` : undefined,
          outlineOffset: -2,
          flex: 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: designW,
            height: designH,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {panelKids.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center py-4 text-center text-xs text-[#9ca3af]">
              {t('Drop components here')}
            </div>
          ) : (
            panelKids.map((c) => (
              <TabsCanvasItem
                key={c.id}
                component={c}
                bounds={{ w: designW, h: boundsH }}
                interactionScale={canvasScale * scale}
                brushMode={brushMode}
                brushColor={brushColor}
                brushTarget={brushTarget}
                onBrushUse={onBrushUse}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
