import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { paletteItems } from '../registry.jsx'
import { DRAG_MIME } from '../../utils/htmlPlacement.js'
import { presetsForType, componentPresetStyles } from '../../utils/componentPresets.js'
import { BLOCKS } from '../../utils/blocks.js'
import { useEditorStore } from '../../store/editorStore.js'
import { FolderIcon, LayersIcon, ImageIcon } from '../icons.jsx'

// A draggable ready-made section block. Carries the BUILT component list (using
// the live theme) so the drop just stamps it onto the canvas.
function BlockCard({ block, theme }) {
  const items = block.build(theme)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { from: 'palette', block: block.id, items },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`Drag onto the canvas — ${block.label} section`}
      className={`cursor-grab rounded-lg border border-[#e5e7eb] bg-white p-2.5 transition hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <BlockThumb block={block} theme={theme} />
      <div className="mt-1.5 text-sm font-medium text-[#374151]">{block.label}</div>
      <div className="truncate text-[11px] text-[#9ca3af]">{block.desc}</div>
    </div>
  )
}

// A tiny abstract wireframe preview per block so the palette reads at a glance.
function BlockThumb({ block, theme }) {
  const bar = (w, h, c, key, extra) => (
    <div key={key} style={{ width: w, height: h, background: c, borderRadius: 3, ...extra }} />
  )
  const p = theme.primaryColor
  const soft = theme.softColor
  const muted = 'rgba(0,0,0,0.18)'
  let inner
  if (block.id === 'hero') {
    inner = (
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        {bar(70, 8, muted, 'a')}{bar(50, 5, 'rgba(0,0,0,0.1)', 'b')}{bar(28, 9, p, 'c', { borderRadius: 5 })}
      </div>
    )
  } else if (block.id === 'features' || block.id === 'stats' || block.id === 'pricing') {
    inner = (
      <div className="flex h-full items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1" style={{ width: 22 }}>
            {block.id === 'pricing'
              ? bar(22, 30, soft, 'c', { border: `1px solid ${i === 1 ? p : muted}` })
              : <>{bar(12, 12, i === 1 ? p : muted, 'd', { borderRadius: 99 })}{bar(20, 4, muted, 'e')}</>}
          </div>
        ))}
      </div>
    )
  } else if (block.id === 'cta') {
    inner = (
      <div className="flex h-full items-center justify-center" style={{ background: p, borderRadius: 4 }}>
        <div className="flex flex-col items-center gap-1">{bar(60, 6, 'rgba(255,255,255,0.85)', 'a')}{bar(26, 8, '#fff', 'b', { borderRadius: 4 })}</div>
      </div>
    )
  } else {
    inner = (
      <div className="flex h-full flex-col items-center justify-center gap-1.5" style={{ background: soft, borderRadius: 4 }}>
        {bar(78, 5, muted, 'a')}{bar(60, 5, muted, 'b')}{bar(30, 4, 'rgba(0,0,0,0.1)', 'c')}
      </div>
    )
  }
  return <div className="h-[52px] w-full overflow-hidden rounded-md bg-[#f3f4f6] p-1">{inner}</div>
}

// Short sample shown inside each variant swatch so the drop target reads at a
// glance which component it is.
const SWATCH_SAMPLE = {
  navbar: 'Brand', heading: 'Aa', text: 'Text', button: 'Button', linkbutton: 'Link →',
  image: '', section: 'Section', card: 'Card', list: '• List', quote: '“ ”',
  badge: 'Badge', icon: '★', input: 'Field', divider: '——', container: 'Box',
  tabs: 'Tabs', select: 'Select', alert: 'Alert', accordion: 'Accordion',
  spacer: ' ', html: '</>',
}

// Build a compact swatch style from a variant's resolved styles so the palette
// preview actually looks like the variant you'll drop.
function swatchStyle(type, s, theme) {
  const base = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 34, borderRadius: 8, fontSize: 11, fontWeight: 600,
    background: theme.softColor, color: theme.textColor, overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.06)',
  }
  if (!s) return base
  const hasBorder = s.borderWidth && s.borderStyle && s.borderStyle !== 'none'
  return {
    ...base,
    background: s.backgroundImage || s.backgroundColor || base.background,
    color: s.color || base.color,
    borderRadius: s.borderRadius || base.borderRadius,
    border: hasBorder ? `1.5px solid ${s.borderColor || 'rgba(0,0,0,0.2)'}` : base.border,
    fontStyle: s.fontStyle || undefined,
    textDecoration: s.textDecoration || undefined,
    fontWeight: s.fontWeight || base.fontWeight,
    boxShadow: s.boxShadow && s.boxShadow !== 'none' ? '0 4px 10px rgba(0,0,0,0.12)' : undefined,
  }
}

// One draggable variant swatch. Carries `preset` so the drop bakes its styles in.
function VariantSwatch({ type, preset, label, theme }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}-${preset || 'base'}`,
    data: { from: 'palette', type, preset: preset || null },
  })
  const styles = preset ? componentPresetStyles(type, preset, theme) : null
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`Drag onto the canvas — ${label}`}
      className={`cursor-grab rounded-lg border border-[#e5e7eb] bg-white p-1.5 transition hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <div style={swatchStyle(type, styles, theme)}>
        {type === 'image'
          ? <ImageIcon size={16} className="text-[#9ca3af]" />
          : SWATCH_SAMPLE[type] ?? type}
      </div>
      <div className="mt-1 truncate text-center text-[10px] text-[#6b7280]">{label}</div>
    </div>
  )
}

// A component category in the palette: click the row to reveal its variants
// (Default + presets), each draggable onto the canvas pre-styled.
function PaletteCategory({ item, theme, open, onToggle }) {
  const variants = presetsForType(item.type)
  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-3 py-2 text-sm select-none hover:bg-[#eef2ff] ${open ? 'bg-[#f5f5ff]' : ''}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-base text-[#374151]">
          {item.icon}
        </span>
        <span className="flex-1 text-left font-medium text-[#374151]">{item.label}</span>
        {variants.length > 0 && (
          <span className="text-[11px] text-[#9ca3af]">{variants.length + 1}</span>
        )}
        <span className="w-3 text-[10px] text-[#9ca3af]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-[#f1f1f4] bg-[#fafafa] p-2">
          <VariantSwatch type={item.type} preset={null} label="Default" theme={theme} />
          {variants.map((v) => (
            <VariantSwatch key={v.id} type={item.type} preset={v.id} label={v.label} theme={theme} />
          ))}
        </div>
      )}
    </div>
  )
}

const TABS = [
  ['files', 'Files', FolderIcon],
  ['components', 'Components', LayersIcon],
]

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

// Shared left rail for BOTH editor modes: VS Code-style Files | Components
// tabs. `filesPanel` is the page/file explorer node rendered by the editor;
// `onPickComponent(type)` opts the palette into HTML-placement mode (omitted
// → classic dnd-kit canvas palette). `onCollapse` hides the whole rail.
export default function Sidebar({ onPickComponent, onCollapse, filesPanel }) {
  const [tab, setTab] = useState(filesPanel ? 'files' : 'components')
  const [openType, setOpenType] = useState(null)
  const theme = useEditorStore((s) => s.schema.theme)
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-[#f9fafb]">
      <div className="flex shrink-0 items-center border-b border-[#e5e7eb] bg-white">
        {filesPanel ? (
          TABS.map(([id, label, TabIcon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold ${
                tab === id
                  ? 'border-b-2 border-[#4f46e5] text-[#4f46e5]'
                  : 'text-[#6b7280] hover:text-[#111827]'
              }`}
            >
              <TabIcon size={15} /> {label}
            </button>
          ))
        ) : (
          <span className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            Components
          </span>
        )}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Hide panel"
            className="px-2 py-2 text-xs text-[#9ca3af] hover:text-[#374151]"
          >
            «
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {filesPanel && tab === 'files' ? (
          filesPanel
        ) : (
          <>
            {/* Ready-made section blocks (component canvas only). */}
            {!onPickComponent && (
              <div className="mb-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Sections
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCKS.map((b) => (
                    <BlockCard key={b.id} block={b} theme={theme} />
                  ))}
                </div>
              </div>
            )}
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Components
            </h2>
            <div className="space-y-2">
              {onPickComponent
                ? paletteItems.map((item) => (
                    <PaletteItem key={item.type} item={item} onPick={onPickComponent} />
                  ))
                : paletteItems.map((item) => (
                    <PaletteCategory
                      key={item.type}
                      item={item}
                      theme={theme}
                      open={openType === item.type}
                      onToggle={() => setOpenType((t) => (t === item.type ? null : item.type))}
                    />
                  ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[#6b7280]">
              {onPickComponent
                ? 'Click a component, then click in the page where it should go — or drag it straight onto the spot.'
                : 'Click a component to see its styles, then drag the one you want onto the canvas.'}
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
