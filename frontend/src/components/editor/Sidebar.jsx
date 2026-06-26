import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { paletteItems } from '../registry.jsx'
import { DRAG_MIME } from '../../utils/htmlPlacement.js'
import { htmlVariantsFor, HTML_BLOCKS } from '../../utils/htmlVariants.js'
import { componentToHtml } from '../../utils/componentToHtml.js'
import { useEditorStore } from '../../store/editorStore.js'
import { FolderIcon, LayersIcon } from '../icons.jsx'

// Variants for a type, with a synthesized "Default" snippet for the types that
// have no curated variants yet (so every component is still placeable).
function variantsForType(type) {
  const vs = htmlVariantsFor(type)
  return vs.length ? vs : [{ id: 'default', label: 'Default', html: componentToHtml(type) }]
}

// ONE library powers BOTH editor modes. A palette item carries its HTML snippet;
// in HTML-upload mode it's inserted as raw HTML, on the free canvas it's dropped
// as an editable `html` component (HtmlEmbed). So the palette is identical in
// both modes.

// Types whose snippets are wide (full-width-ish) — previewed scaled-down from the
// top-left; the rest are inline and shown a bit larger, centered.
const WIDE_HTML = new Set(['navbar', 'section', 'card', 'image', 'list', 'input'])

// Sensible starting size (w,h) for the `html` component a snippet drops as on the
// free canvas — the user resizes from there.
const HTML_SIZE = {
  navbar: [1000, 84], section: [1000, 360], card: [360, 320], image: [480, 300],
  list: [420, 160], input: [440, 96], button: [220, 56], linkbutton: [240, 50],
  badge: [170, 44], heading: [620, 84], text: [560, 120], quote: [560, 130], divider: [560, 44],
}
function htmlSize(type) { return HTML_SIZE[type] || [380, 110] }

// Live, inert preview of a snippet's HTML, scaled to fit the palette swatch. The
// HTML is our own trusted template string (no user input), rendered pointer-
// events-none so it can't be interacted with in the palette.
function HtmlPreview({ html, wide }) {
  // Wide snippets render at a FIXED width then scale down centered, so the whole
  // element shows (a percentage width + top-left origin left navbars/sections
  // looking empty). Inline snippets just scale a touch from their natural size.
  return (
    <div className="flex h-[56px] w-full items-center justify-center overflow-hidden rounded-md bg-[#f8fafc]">
      <div
        style={
          wide
            ? { width: 380, transform: 'scale(0.26)', transformOrigin: 'center', flexShrink: 0, pointerEvents: 'none' }
            : { transform: 'scale(0.58)', transformOrigin: 'center', pointerEvents: 'none' }
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

// One variant swatch, dual-mode:
//  - HTML-upload mode (`onPick` set): native drag + click → onPick(type, html)
//    (click arms placement, drag drops the raw HTML into the page iframe).
//  - Free canvas (no `onPick`): dnd-kit draggable carrying the HTML + a size, so
//    onDragEnd drops it as an editable `html` component.
function VariantSwatch({ type, variant, onPick, wide }) {
  const [w, h] = htmlSize(type)
  // Hook is always called (rules of hooks); listeners used only on the canvas.
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `palette-${type}-${variant.id}`,
    data: { from: 'palette', html: variant.html, w, h, label: variant.label },
  })
  const preview = (
    <>
      <HtmlPreview html={variant.html} wide={wide} />
      <div className="mt-1 truncate text-center text-[10px] text-[#6b7280]">{variant.label}</div>
    </>
  )
  if (onPick) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, type)
          e.dataTransfer.setData('text/plain', variant.label)
          e.dataTransfer.effectAllowed = 'copy'
          window.setTimeout(() => onPick(type, variant.html), 0)
        }}
        onClick={() => onPick(type, variant.html)}
        title={`Click to place, or drag onto the page — ${variant.label}`}
        className="cursor-pointer rounded-lg border border-[#e5e7eb] bg-white p-1.5 transition select-none hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing"
      >
        {preview}
      </div>
    )
  }
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`Drag onto the canvas — ${variant.label}`}
      className={`cursor-grab rounded-lg border border-[#e5e7eb] bg-white p-1.5 transition hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      {preview}
    </div>
  )
}

// A component category: click the row to reveal its variants. Same in both modes.
function PaletteCategory({ item, onPick, open, onToggle }) {
  const variants = variantsForType(item.type)
  const wide = WIDE_HTML.has(item.type)
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
        {variants.length > 0 && <span className="text-[11px] text-[#9ca3af]">{variants.length}</span>}
        {variants.length > 0 && <span className="w-3 text-[10px] text-[#9ca3af]">{open ? '▾' : '▸'}</span>}
      </button>
      {open && variants.length > 0 && (
        <div className="grid grid-cols-2 gap-2 border-t border-[#f1f1f4] bg-[#fafafa] p-2">
          {variants.map((v) => (
            <VariantSwatch key={v.id} type={item.type} variant={v} onPick={onPick} wide={wide} />
          ))}
        </div>
      )}
    </div>
  )
}

// A ready-made section block, dual-mode (same library as the variants). HTML mode
// inserts the raw section HTML; the free canvas drops it as one `html` component.
function BlockCard({ block, onPick, theme }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { from: 'palette', html: block.html, w: 1000, h: 380, label: block.label },
  })
  const inner = (
    <>
      <BlockThumb block={block} theme={theme} />
      <div className="mt-1.5 text-sm font-medium text-[#374151]">{block.label}</div>
      <div className="truncate text-[11px] text-[#9ca3af]">{block.desc}</div>
    </>
  )
  if (onPick) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, 'section')
          e.dataTransfer.setData('text/plain', block.label)
          e.dataTransfer.effectAllowed = 'copy'
          window.setTimeout(() => onPick('section', block.html), 0)
        }}
        onClick={() => onPick('section', block.html)}
        title={`Click to place, or drag onto the page — ${block.label} section`}
        className="cursor-pointer rounded-lg border border-[#e5e7eb] bg-white p-2.5 transition select-none hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing"
      >
        {inner}
      </div>
    )
  }
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`Drag onto the canvas — ${block.label} section`}
      className={`cursor-grab rounded-lg border border-[#e5e7eb] bg-white p-2.5 transition hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      {inner}
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

const TABS = [
  ['files', 'Files', FolderIcon],
  ['components', 'Components', LayersIcon],
]


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
            {/* ONE library for both modes — the same Sections + Components. */}
            <div className="mb-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Sections
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {HTML_BLOCKS.map((b) => (
                  <BlockCard key={b.id} block={b} onPick={onPickComponent} theme={theme} />
                ))}
              </div>
            </div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Components
            </h2>
            <div className="space-y-2">
              {paletteItems.map((item) => (
                <PaletteCategory
                  key={item.type}
                  item={item}
                  onPick={onPickComponent}
                  open={openType === item.type}
                  onToggle={() => setOpenType((t) => (t === item.type ? null : item.type))}
                />
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[#6b7280]">
              Click a component to see its styles, then {onPickComponent ? 'click in the page (or drag) to place it' : 'drag one onto the canvas'}.
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
