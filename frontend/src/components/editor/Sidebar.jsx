import { useDraggable } from '@dnd-kit/core'
import { paletteItems } from '../registry.jsx'
import PagesPanel from './PagesPanel.jsx'
import { DRAG_MIME } from '../../utils/htmlPlacement.js'

// Palette item with two interaction modes:
//  - Component mode (default): dnd-kit draggable, dropped onto the canvas.
//  - HTML mode (onPick set): native HTML5 draggable (so it can drop INTO the
//    cross-document edit iframe) + click-to-place. Both routes set the same
//    pendingType so HtmlWorkspace's placement flow handles the actual insert.
function PaletteItem({ item, onPick }) {
  // useDraggable is always called (rules of hooks); its listeners are only
  // applied in component mode.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { from: 'palette', type: item.type },
  })
  const htmlMode = !!onPick

  if (htmlMode) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          // Native drag payload the edit iframe's drop handler checks for.
          e.dataTransfer.setData(DRAG_MIME, item.type)
          e.dataTransfer.setData('text/plain', item.label)
          e.dataTransfer.effectAllowed = 'copy'
          // Defer the state update one tick: Chrome cancels a native drag
          // when React re-renders the dragged node in the same task as
          // dragstart — which is exactly why dragging from the palette
          // "did nothing" while clicking worked.
          window.setTimeout(() => onPick(item.type), 0)
        }}
        onClick={() => onPick(item.type)}
        title={`Click to place, or drag onto the page — ${item.label}`}
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm select-none hover:border-[#4f46e5] hover:bg-[#eef2ff] active:cursor-grabbing"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f3f4f6] text-base">
          {item.icon}
        </span>
        <span className="font-medium text-[#374151]">{item.label}</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm select-none hover:border-[#4f46e5] hover:bg-[#eef2ff] active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f3f4f6] text-base">
        {item.icon}
      </span>
      <span className="font-medium text-[#374151]">{item.label}</span>
    </div>
  )
}

// `onPickComponent(type)` opts the sidebar into HTML-placement mode. When
// omitted the palette behaves as the classic dnd-kit canvas palette.
export default function Sidebar({ onPickComponent }) {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-[#e5e7eb] bg-[#f9fafb] p-4">
      <PagesPanel />
      <div className="mb-3 border-t border-[#e5e7eb]" />
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
        Components
      </h2>
      <div className="space-y-2">
        {paletteItems.map((item) => (
          <PaletteItem key={item.type} item={item} onPick={onPickComponent} />
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[#6b7280]">
        {onPickComponent
          ? 'Click a component, then click in the page where it should go — or drag it straight onto the spot.'
          : 'Drag a component onto the canvas to add it.'}
      </p>
    </aside>
  )
}
