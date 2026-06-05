import { useDraggable } from '@dnd-kit/core'
import { paletteItems } from '../registry.jsx'
import PagesPanel from './PagesPanel.jsx'

// When the editor is in HTML-site mode the canvas is an iframe + textarea
// rather than a dnd droppable, so we can't drag — instead the user CLICKS
// a palette item and the parent appends a default HTML snippet for that
// type. The component prop `onAppend(type)` opts into the click path; when
// it's absent (component mode) the item only drags.
function PaletteItem({ item, onAppend }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { from: 'palette', type: item.type },
  })
  const clickable = !!onAppend
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={clickable ? () => onAppend(item.type) : undefined}
      title={clickable ? `Append ${item.label} to the HTML document` : `Drag ${item.label} onto the canvas`}
      className={`flex items-center gap-3 rounded-[2px] border border-[#e1dfdd] bg-white px-3 py-2 text-sm select-none hover:border-[#2b579a] hover:bg-[#eff3fb] ${
        clickable ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-[#f3f2f1] text-base">
        {item.icon}
      </span>
      <span className="font-medium text-[#323130]">{item.label}</span>
    </div>
  )
}

export default function Sidebar({ onAppendComponent }) {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-[#e1dfdd] bg-[#faf9f8] p-4">
      <PagesPanel />
      <div className="mb-3 border-t border-[#e1dfdd]" />
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
        Components
      </h2>
      <div className="space-y-2">
        {paletteItems.map((item) => (
          <PaletteItem key={item.type} item={item} onAppend={onAppendComponent} />
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[#605e5c]">
        {onAppendComponent
          ? 'Click a component to append it to the HTML document.'
          : 'Drag a component onto the canvas to add it.'}
      </p>
    </aside>
  )
}
