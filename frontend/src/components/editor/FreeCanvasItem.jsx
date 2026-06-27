import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { RenderComponent } from '../renderer/Renderer.jsx'
import { ContainerEditor, TabsEditor } from './FlowCanvasItem.jsx'
import { snapDraggedRect } from '../../utils/snapping.js'

const MIN = 20
const ACCENT = '#4f46e5'
const HANDLE_SIZE = 8
const HANDLE_INSET = 3

// [direction, absolute-position style, cursor]
const HANDLES = [
  ['nw', { top: HANDLE_INSET, left: HANDLE_INSET }, 'nwse-resize'],
  ['n', { top: HANDLE_INSET, left: '50%', marginLeft: -HANDLE_SIZE / 2 }, 'ns-resize'],
  ['ne', { top: HANDLE_INSET, right: HANDLE_INSET }, 'nesw-resize'],
  ['e', { top: '50%', right: HANDLE_INSET, marginTop: -HANDLE_SIZE / 2 }, 'ew-resize'],
  ['se', { bottom: HANDLE_INSET, right: HANDLE_INSET }, 'nwse-resize'],
  ['s', { bottom: HANDLE_INSET, left: '50%', marginLeft: -HANDLE_SIZE / 2 }, 'ns-resize'],
  ['sw', { bottom: HANDLE_INSET, left: HANDLE_INSET }, 'nesw-resize'],
  ['w', { top: '50%', left: HANDLE_INSET, marginTop: -HANDLE_SIZE / 2 }, 'ew-resize'],
]

export default function FreeCanvasItem({ component }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const toggleSelect = useEditorStore((s) => s.toggleSelect)
  const setLayout = useEditorStore((s) => s.setLayout)
  const setLayoutMany = useEditorStore((s) => s.setLayoutMany)
  const setDragGuides = useEditorStore((s) => s.setDragGuides)
  const clearDragGuides = useEditorStore((s) => s.clearDragGuides)
  const remove = useEditorStore((s) => s.removeComponent)

  // Component-canvas link tool: when armed, a click picks this component as the
  // link source or target instead of selecting/moving it.
  const linkMode = useEditorStore((s) => s.linkMode)
  const linkSourceId = useEditorStore((s) => s.linkSourceId)
  const pickLinkNode = useEditorStore((s) => s.pickLinkNode)
  const isLinkSource = linkMode && linkSourceId === component.id

  const isSelected = selectedIds.includes(component.id)
  // Resize handles + Delete only on a SOLE selection — a multi-selection just
  // gets the outline (handles on every item would be noise).
  const isPrimarySingle = selectedIds.length <= 1 && selectedId === component.id
  // Edit the layout of the active breakpoint only.
  const layout =
    viewport === 'mobile'
      ? component.mobileLayout || component.layout
      : component.layout
  const { x, y, w, h } = layout
  const hidden =
    viewport === 'mobile' ? component.hiddenMobile : component.hidden

  function startMove(e) {
    if (e.button !== 0) return
    // Link tool owns the pointer — don't drag/select while arming a link.
    if (linkMode) { e.stopPropagation(); return }
    e.stopPropagation()
    // Shift-click toggles multi-selection (no drag).
    if (e.shiftKey) { toggleSelect(component.id); return }
    const state = useEditorStore.getState()
    // Dragging an item that's already part of a multi-selection moves the WHOLE
    // group; otherwise it becomes the single selection first.
    const alreadyMulti = state.selectedIds.length > 1 && state.selectedIds.includes(component.id)
    if (!alreadyMulti) select(component.id)
    const groupIds = alreadyMulti ? state.selectedIds : [component.id]
    const grid = state.gridStep
    const sx = e.clientX
    const sy = e.clientY
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
      const rawX = base.x + (ev.clientX - sx)
      const rawY = base.y + (ev.clientY - sy)
      const snap = snapDraggedRect(
        { id: component.id, x: rawX, y: rawY, w, h },
        siblings,
        artboard,
        grid,
      )
      if (groupIds.length === 1) {
        setLayout(component.id, { x: snap.x, y: snap.y })
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
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
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
        cursor: linkMode ? 'crosshair' : 'move',
        zIndex: isSelected || isLinkSource ? 20 : 1,
        opacity: hidden ? 0.35 : 1,
        // Armed link source stays a solid blue ring (with a light wash) until
        // the next click picks the target — same affordance as HTML mode.
        boxShadow: isLinkSource
          ? `inset 0 0 0 2px ${ACCENT}, 0 0 0 1px rgba(255,255,255,0.9)`
          : isSelected
            ? `inset 0 0 0 1.5px ${ACCENT}`
            : undefined,
        background: isLinkSource ? 'rgba(79, 70, 229, 0.10)' : undefined,
      }}
      className={
        isSelected || linkMode ? '' : 'hover:shadow-[inset_0_0_0_1px_#a6b7d6]'
      }
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

      {isPrimarySingle && !linkMode && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              remove(component.id)
            }}
            style={{ position: 'absolute', top: 2, right: 2, zIndex: 30 }}
            className="rounded-lg bg-[#a4262c] px-2 py-0.5 text-xs font-medium text-white shadow"
          >
            Delete
          </button>
          {HANDLES.map(([dir, pos, cursor]) => (
            <div
              key={dir}
              onPointerDown={(e) => startResize(e, dir)}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: ACCENT,
                border: '1px solid #ffffff',
                borderRadius: 999,
                boxShadow: '0 1px 4px rgba(15,23,42,0.18)',
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
