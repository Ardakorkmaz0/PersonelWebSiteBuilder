import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useEditorStore } from '../../store/editorStore.js'
import { BanIcon, TrashIcon } from '../icons.jsx'
import {
  absoluteChildrenHeight,
  flowItemStyle,
  isHidden,
  isFlowFullWidth,
} from '../renderer/layout.js'
import { RenderComponent } from '../renderer/Renderer.jsx'
import { TAB_STYLES } from '../renderer/constants.js'
import { sanitizeStyles } from '../../utils/sanitize.js'

const ACCENT = '#4f46e5'
const MIN = 20
const HANDLE_SIZE = 10
const HANDLE_OFFSET = HANDLE_SIZE / 2
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

export default function FlowCanvasItem({ component, canvasWidth, parentDirection = 'row' }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const remove = useEditorStore((s) => s.removeComponent)
  const setLayout = useEditorStore((s) => s.setLayout)

  const isSelected = selectedId === component.id
  const hidden = isHidden(component, viewport)
  const fixedHeight = FIXED_HEIGHT_TYPES.has(component.type)
  const full = isFlowFullWidth(component)
  const canShowInlineDelete = Math.round(component.layout?.w || 240) >= 34 && Math.round(component.layout?.h || 80) >= 30

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
      if (dir.includes('e')) patch.w = Math.max(MIN, orig.w + (ev.clientX - sx))
      if (dir.includes('s')) patch.h = Math.max(MIN, orig.h + (ev.clientY - sy))
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
          select(component.id)
        }}
        style={{ flex: '0 0 100%', width: '100%', cursor: 'pointer', zIndex: isSelected ? 20 : 1 }}
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
          <span>· hidden on {viewport === 'mobile' ? 'mobile' : 'PC'}</span>
          <span className="ml-auto opacity-70">select to show</span>
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
  const handles = isSelected ? flowResizeHandles({ full, viewport }) : []

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        select(component.id)
      }}
      style={{
        ...flowItemStyle(component, viewport, canvasWidth, { parentDirection }),
        cursor: 'pointer',
        zIndex: isSelected ? 20 : 1,
      }}
      className={isSelected ? '' : 'hover:shadow-[inset_0_0_0_1px_#a6b7d6]'}
    >
      {component.type === 'container' ? (
        <ContainerEditor component={component} />
      ) : component.type === 'tabs' ? (
        <TabsEditor component={component} />
      ) : (
        <div
          className="pointer-events-none w-full select-none"
          style={{
            height: fixedHeight ? '100%' : 'auto',
            minHeight: fixedHeight ? undefined : '100%',
            overflow: 'visible',
          }}
        >
          <RenderComponent component={component} flowMode viewport={viewport} />
        </div>
      )}

      {isSelected && (
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

      {isSelected && (
        canShowInlineDelete && (
          <button
            type="button"
            aria-label="Delete component"
            title="Delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              remove(component.id)
            }}
            style={{ position: 'absolute', top: 3, right: 3, zIndex: 30 }}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a4262c] text-white shadow"
          >
            <TrashIcon size={13} />
          </button>
        )
      )}

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
  return { ref, scale, scaledHeight: Math.max(0, designH * scale) }
}

// The editable inside of a container: a droppable mini-canvas whose children
// are positioned freely. Children live in PC design coordinates, so on a
// narrower artboard we scale the inner mini-canvas down with transform so it
// fits without horizontal scroll AND keeps its proportions.
export function ContainerEditor({ component }) {
  const kids = Array.isArray(component.children) ? component.children : []
  const designW = Math.max(1, Math.round(component.layout?.w || 600))
  const designH = absoluteChildrenHeight(kids, Math.round(component.layout?.h || 160))
  const boundsH = Math.max(1, Math.round(component.layout?.h || designH))
  const { setNodeRef, isOver } = useDroppable({ id: component.id })
  const userStyles = sanitizeStyles(component.styles)
  const { ref, scale, scaledHeight } = useFitToWidth(designW, designH)
  const setRefs = (el) => {
    ref.current = el
    setNodeRef(el)
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
            Drop components here
          </div>
        ) : (
          kids.map((c) => (
            <TabsCanvasItem key={c.id} component={c} bounds={{ w: designW, h: boundsH }} />
          ))
        )}
      </div>
    </div>
  )
}

function TabsCanvasItem({ component, bounds }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const setLayout = useEditorStore((s) => s.setLayout)
  const remove = useEditorStore((s) => s.removeComponent)
  const isSelected = selectedId === component.id
  const hidden = isHidden(component, viewport)
  const l = component.layout || {}
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
  const handles = freeResizeHandles(chromeRect)
  const canShowInlineDelete = w >= 34 && h >= 30

  function startMove(e) {
    if (e.button !== 0) return
    e.stopPropagation()
    select(component.id)
    const sx = e.clientX
    const sy = e.clientY
    const orig = { x, y }
    function onMove(ev) {
      setLayout(component.id, {
        x: orig.x + (ev.clientX - sx),
        y: orig.y + (ev.clientY - sy),
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
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
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
      onPointerDown={startMove}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        cursor: 'move',
        zIndex: isSelected ? 20 : 1,
        opacity: hidden ? 0.35 : 1,
      }}
      className={isSelected ? '' : 'hover:shadow-[inset_0_0_0_1px_#a6b7d6]'}
    >
      {component.type === 'container' ? (
        <div className="h-full w-full overflow-hidden">
          <ContainerEditor component={component} />
        </div>
      ) : component.type === 'tabs' ? (
        <div className="h-full w-full overflow-hidden">
          <TabsEditor component={component} />
        </div>
      ) : (
        <div className="pointer-events-none h-full w-full select-none overflow-hidden">
          <RenderComponent component={component} viewport={viewport} />
        </div>
      )}

      {hidden && (
        <span
          style={{ position: 'absolute', top: 2, left: 2, zIndex: 25 }}
          className="rounded-lg bg-[#111827]/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          Hidden on {viewport === 'mobile' ? 'mobile' : 'PC'}
        </span>
      )}

      {isSelected && (
        <>
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
          {canShowInlineDelete && (
            <button
              type="button"
              aria-label="Delete component"
              title="Delete"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                remove(component.id)
              }}
              style={{ position: 'absolute', top: 3, right: 3, zIndex: 30 }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a4262c] text-white shadow"
            >
              <TrashIcon size={13} />
            </button>
          )}
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
export function TabsEditor({ component }) {
  const p = component.props || {}
  const tabsList = Array.isArray(p.tabs) && p.tabs.length
    ? p.tabs.filter((t) => t && t.id)
    : [{ id: 't1', label: 'Tab' }]
  const activeId = tabsList.some((t) => t.id === p.activeId) ? p.activeId : tabsList[0].id
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
        ...sanitizeStyles(component.styles),
        width: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div role="tablist" style={tablistStyle}>
        {tabsList.map((t) => {
          const sel = t.id === activeId
          return (
            <button
              key={t.id}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                select(component.id)
              }}
              onPointerUp={(e) => {
                e.stopPropagation()
                if (!sel) setActiveTab(component.id, t.id)
              }}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (!sel) setActiveTab(component.id, t.id)
              }}
              style={{
                ...tabBaseStyle,
                ...(sel ? tabActiveStyle : null),
              }}
            >
              {t.label || 'Tab'}
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
              Drop components here
            </div>
          ) : (
            panelKids.map((c) => (
              <TabsCanvasItem key={c.id} component={c} bounds={{ w: designW, h: boundsH }} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
