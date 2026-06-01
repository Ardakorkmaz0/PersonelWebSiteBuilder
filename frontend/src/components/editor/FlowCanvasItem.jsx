import { useEditorStore } from '../../store/editorStore.js'
import { flowItemStyle, isHidden } from '../renderer/layout.js'
import { RenderComponent } from '../renderer/Renderer.jsx'

const ACCENT = '#2b579a'
const FIXED_HEIGHT_TYPES = new Set(['image', 'divider', 'spacer'])

export default function FlowCanvasItem({ component, canvasWidth }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const viewport = useEditorStore((s) => s.viewport)
  const select = useEditorStore((s) => s.selectComponent)
  const remove = useEditorStore((s) => s.removeComponent)

  const isSelected = selectedId === component.id
  const hidden = isHidden(component, viewport)
  const fixedHeight = FIXED_HEIGHT_TYPES.has(component.type)

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        select(component.id)
      }}
      style={{
        ...flowItemStyle(component, viewport, canvasWidth),
        cursor: 'pointer',
        opacity: hidden ? 0.35 : 1,
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
        <RenderComponent component={component} flowMode />
      </div>

      {hidden && (
        <span
          style={{ position: 'absolute', top: 2, left: 2, zIndex: 25 }}
          className="rounded-[2px] bg-[#201f1e]/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
        >
          Hidden on {viewport === 'mobile' ? 'mobile' : 'PC'}
        </span>
      )}

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
    </div>
  )
}
