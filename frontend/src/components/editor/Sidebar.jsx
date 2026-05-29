import { useDraggable } from '@dnd-kit/core'
import { paletteItems } from '../registry.jsx'

function PaletteItem({ item }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { from: 'palette', type: item.type },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm select-none hover:border-blue-400 hover:bg-blue-50 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded bg-gray-100 text-base">
        {item.icon}
      </span>
      <span className="font-medium text-gray-700">{item.label}</span>
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Components
      </h2>
      <div className="space-y-2">
        {paletteItems.map((item) => (
          <PaletteItem key={item.type} item={item} />
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-gray-400">
        Drag a component onto the canvas to add it.
      </p>
    </aside>
  )
}
