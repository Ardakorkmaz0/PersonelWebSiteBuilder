import { useEditorStore } from '../../store/editorStore.js'
import { RenderComponent } from '../renderer/Renderer.jsx'

const MIN = 20

// [direction, absolute-position style, cursor]
const HANDLES = [
  ['nw', { top: -5, left: -5 }, 'nwse-resize'],
  ['n', { top: -5, left: '50%', marginLeft: -5 }, 'ns-resize'],
  ['ne', { top: -5, right: -5 }, 'nesw-resize'],
  ['e', { top: '50%', right: -5, marginTop: -5 }, 'ew-resize'],
  ['se', { bottom: -5, right: -5 }, 'nwse-resize'],
  ['s', { bottom: -5, left: '50%', marginLeft: -5 }, 'ns-resize'],
  ['sw', { bottom: -5, left: -5 }, 'nesw-resize'],
  ['w', { top: '50%', left: -5, marginTop: -5 }, 'ew-resize'],
]

export default function FreeCanvasItem({ component }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const setLayout = useEditorStore((s) => s.setLayout)
  const remove = useEditorStore((s) => s.removeComponent)

  const isSelected = selectedId === component.id
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
        outline: isSelected ? '2px solid #3b82f6' : undefined,
      }}
      className={
        isSelected ? '' : 'hover:outline hover:outline-1 hover:outline-blue-300'
      }
    >
      <div className="pointer-events-none h-full w-full select-none overflow-hidden">
        <RenderComponent component={component} />
      </div>

      {hidden && (
        <span
          style={{ position: 'absolute', top: 2, left: 2, zIndex: 25 }}
          className="rounded bg-gray-800/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          Hidden on {viewport === 'mobile' ? 'mobile' : 'PC'}
        </span>
      )}

      {isSelected && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              remove(component.id)
            }}
            style={{ position: 'absolute', top: 2, right: 2, zIndex: 30 }}
            className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white shadow"
          >
            Delete
          </button>
          {HANDLES.map(([dir, pos, cursor]) => (
            <div
              key={dir}
              onPointerDown={(e) => startResize(e, dir)}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                background: '#3b82f6',
                border: '1px solid #ffffff',
                borderRadius: 2,
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
