import { useEditorStore } from '../../store/editorStore.js'
import { flowItemStyle, isHidden, isFlowFullWidth } from '../renderer/layout.js'
import { RenderComponent } from '../renderer/Renderer.jsx'

const ACCENT = '#2b579a'
const MIN = 20
const FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])

// Resize handles for flow mode. Width (E) controls how the block packs in its row;
// Height (S) sets the box height; SE does both. Full-bleed blocks only expose
// height. Width only matters on PC (mobile blocks are full-width), but HEIGHT is
// editable on mobile too so the spacing can be tuned there like on PC.
const WIDTH_HANDLE = ['e', { top: '50%', right: -5, marginTop: -5 }, 'ew-resize']
const HEIGHT_HANDLE = ['s', { bottom: -5, left: '50%', marginLeft: -5 }, 'ns-resize']
const CORNER_HANDLE = ['se', { bottom: -5, right: -5 }, 'nwse-resize']

export default function FlowCanvasItem({ component, canvasWidth }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const remove = useEditorStore((s) => s.removeComponent)
  const setLayout = useEditorStore((s) => s.setLayout)

  const isSelected = selectedId === component.id
  const hidden = isHidden(component, viewport)
  const fixedHeight = FIXED_HEIGHT_TYPES.has(component.type)
  const full = isFlowFullWidth(component)

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
          className={`flex items-center gap-2 rounded-[2px] border border-dashed px-2 py-1 text-[11px] ${
            isSelected
              ? 'border-[#2b579a] bg-[#eff3fb] text-[#2b579a]'
              : 'border-[#c8c6c4] bg-[#faf9f8] text-[#a19f9d] hover:text-[#605e5c]'
          }`}
        >
          <span aria-hidden>🚫</span>
          <span className="font-medium capitalize">{component.type}</span>
          <span>· hidden on {viewport === 'mobile' ? 'mobile' : 'PC'}</span>
          <span className="ml-auto opacity-70">select to show</span>
        </div>
      </div>
    )
  }

  const handles = isSelected
    ? full
      ? [HEIGHT_HANDLE]
      : viewport === 'pc'
        ? [WIDTH_HANDLE, HEIGHT_HANDLE, CORNER_HANDLE]
        : [HEIGHT_HANDLE]
    : []

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        select(component.id)
      }}
      style={{
        ...flowItemStyle(component, viewport, canvasWidth),
        cursor: 'pointer',
        outline: isSelected ? `2px solid ${ACCENT}` : undefined,
        zIndex: isSelected ? 20 : 1,
      }}
      className={isSelected ? '' : 'hover:outline hover:outline-1 hover:outline-[#a6b7d6]'}
    >
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

      {isSelected && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            remove(component.id)
          }}
          style={{ position: 'absolute', top: 2, right: 2, zIndex: 30 }}
          className="rounded-[2px] bg-[#a4262c] px-2 py-0.5 text-xs font-medium text-white shadow"
        >
          Delete
        </button>
      )}

      {handles.map(([dir, pos, cursor]) => (
        <div
          key={dir}
          onPointerDown={(e) => startResize(e, dir)}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            background: ACCENT,
            border: '1px solid #ffffff',
            zIndex: 30,
            cursor,
            ...pos,
          }}
        />
      ))}
    </div>
  )
}
