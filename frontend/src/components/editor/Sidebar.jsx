import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { paletteItems } from '../registry.jsx'
import { DRAG_MIME } from '../../utils/htmlPlacement.js'
import { htmlVariantsFor, HTML_BLOCKS } from '../../utils/htmlVariants.js'
import { htmlSnippetSize } from '../../utils/htmlSnippetSizing.js'
import { componentToHtml } from '../../utils/componentToHtml.js'
import { useEditorStore } from '../../store/editorStore.js'
import { CodeIcon, FolderIcon, LayersIcon, PlusIcon, SaveIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

// Variants for a type, with a synthesized "Default" snippet for the types that
// have no curated variants yet (so every component is still placeable).
function variantsForType(type) {
  const vs = htmlVariantsFor(type)
  return vs.length ? vs : [{ id: 'default', label: 'Default', html: componentToHtml(type) }]
}

// ONE visual library powers both editor modes. Most palette variants still drop
// as editable HTML embeds on the free canvas, but structural widgets that need
// editor-owned children stay native there.
const NATIVE_CANVAS_TYPES = new Set(['tabs', 'navbar', 'region'])
// Region creation is intentionally hidden until the Wix-like section model is
// redesigned. Keeping the registry type preserves existing saved projects.
const ADDABLE_PALETTE_ITEMS = paletteItems.filter((item) => item.type !== 'region')

// Types whose snippets are wide (full-width-ish) — previewed scaled-down from the
// top-left; the rest are inline and shown a bit larger, centered.
const WIDE_HTML = new Set(['navbar', 'section', 'region', 'card', 'image', 'list', 'input', 'select', 'alert', 'accordion', 'tabs', 'container', 'html', 'spacer'])

function htmlSize(type, variant) {
  const id = typeof variant === 'string' ? variant : variant?.id
  const size = htmlSnippetSize(type, id)
  return [size.w, size.h]
}

// Natural size per section block, so the dropped frame matches the content's real
// height (no dead space below) — keyed by block id, all ~full-width.
const BLOCK_SIZE = {
  hero: [1000, 420], 'hero-split': [1000, 460], features: [1000, 280], stats: [1000, 170],
  pricing: [1000, 380], logos: [1000, 140], testimonial: [1000, 220], faq: [1000, 360],
  contact: [1000, 460], cta: [1000, 220], footer: [1000, 150],
}
function blockSize(id) {
  return BLOCK_SIZE[id] || [1000, 360]
}

const CUSTOM_BLOCKS_KEY = 'pwb_custom_blocks'
const DEFAULT_CUSTOM_HTML = `<section style="padding:64px 32px;background:#f8fafc;font-family:inherit;"><div style="max-width:860px;margin:0 auto;text-align:center;"><p style="margin:0 0 10px;color:#2563eb;font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Custom block</p><h2 style="margin:0 0 12px;color:#0f172a;font-size:36px;line-height:1.1;">Build your own section</h2><p style="margin:0 auto;max-width:560px;color:#64748b;font-size:18px;line-height:1.6;">Paste HTML, inline CSS, or a small embed here and save it as a reusable block.</p></div></section>`

function readCustomBlocks() {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_BLOCKS_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((block) => block && typeof block.html === 'string' && block.html.trim())
      .map((block, index) => ({
        id: typeof block.id === 'string' ? block.id : `custom-${index}`,
        label: typeof block.label === 'string' && block.label.trim() ? block.label.trim() : 'Custom block',
        desc: typeof block.desc === 'string' && block.desc.trim() ? block.desc.trim() : 'Saved custom HTML',
        html: block.html,
      }))
  } catch {
    return []
  }
}

function writeCustomBlocks(blocks) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CUSTOM_BLOCKS_KEY, JSON.stringify(blocks.slice(0, 24)))
  } catch {
    // Ignore storage quota/private-mode errors; placing the block should still work.
  }
}

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

function previewSrcDoc(html, wide) {
  const body = wide
    ? `<div class="stage stage-wide">${html}</div>`
    : `<div class="stage stage-inline">${html}</div>`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827;overflow:hidden}body{padding:12px}.stage-wide{width:920px;transform:scale(.2);transform-origin:top left}.stage-inline{min-height:108px;display:grid;place-items:center}img,video,svg,canvas{max-width:100%;height:auto}</style></head><body>${body}</body></html>`
}

function DetailPreview({ html, wide }) {
  const { t } = useLanguage()
  return (
    <iframe
      title={t('Palette preview')}
      sandbox=""
      srcDoc={previewSrcDoc(html, wide)}
      className="h-[132px] w-full rounded-md bg-white"
    />
  )
}

function PalettePreviewPanel({ preview, onClose }) {
  const { t } = useLanguage()
  if (!preview) return null
  return (
    <div className="shrink-0 border-t border-[#e5e7eb] bg-white p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#4f46e5]">{t('Preview')}</div>
          <div className="truncate text-sm font-semibold text-[#111827]">{t(preview.label)}</div>
          {preview.desc && <div className="truncate text-[11px] text-[#6b7280]">{t(preview.desc)}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t('Close preview')}
          className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
        >
          x
        </button>
      </div>
      <div className="overflow-hidden rounded-md bg-[#f8fafc]">
        <DetailPreview html={preview.html} wide={preview.wide} />
      </div>
    </div>
  )
}

// One variant swatch, dual-mode:
//  - HTML-upload mode (`onPick` set): native drag + click → onPick(type, html)
//    (click arms placement, drag drops the raw HTML into the page iframe).
//  - Free canvas (no `onPick`): most variants carry HTML + size and become an
//    editable HtmlEmbed; structural widgets can carry native component data.
function VariantSwatch({ type, variant, onPick, onArm, onInspect, wide }) {
  const { t } = useLanguage()
  const [w, h] = htmlSize(type, variant)
  const nativeCanvas = !onPick && NATIVE_CANVAS_TYPES.has(type)
  const preset = variant.id === 'default' ? null : variant.id
  const variantLabel = t(variant.label)
  const inspect = () => onInspect?.({
    type,
    label: variantLabel,
    html: variant.html,
    wide,
    size: `${w} x ${h}`,
  })
  // Hook is always called (rules of hooks); listeners used only on the canvas.
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `palette-${type}-${variant.id}`,
    data: nativeCanvas
      ? { from: 'palette', type, preset, w, h, label: variantLabel }
      : { from: 'palette', type, preset, html: variant.html, w, h, label: variantLabel },
  })
  const preview = (
    <>
      <HtmlPreview html={variant.html} wide={wide} />
      <div className="mt-1 min-h-6 break-words text-center text-[10px] leading-3 text-[#6b7280]">{variantLabel}</div>
      {variant.recommended && (
        <div
          title={t('Recommended component')}
          className="mx-auto mt-1 flex w-fit items-center gap-1 rounded-full bg-[#dcfce7] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#15803d]"
        >
          <span aria-hidden="true">✓</span> {t('Recommended')}
        </div>
      )}
    </>
  )
  if (onPick) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          inspect()
          e.dataTransfer.setData(DRAG_MIME, type)
          e.dataTransfer.setData('text/plain', variantLabel)
          e.dataTransfer.effectAllowed = 'copy'
          window.setTimeout(() => onPick(type, variant.html), 0)
        }}
        onMouseEnter={inspect}
        onClick={() => {
          inspect()
          onPick(type, variant.html)
        }}
        title={`Click to place, or drag onto the page — ${variantLabel}`}
        className={`cursor-pointer rounded-lg border p-1.5 transition select-none hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${variant.recommended ? 'border-[#86efac] bg-[#f7fff9]' : 'border-[#e5e7eb] bg-white'}`}
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
      onMouseEnter={inspect}
      onClick={() => {
        inspect()
        // Tap-to-place fallback (touch devices can't reliably start a drag):
        // arm the placement, then a tap on the canvas drops the component.
        onArm?.(
          nativeCanvas
            ? { type, preset, w, h, label: variantLabel }
            : { type, preset, html: variant.html, w, h, label: variantLabel },
        )
      }}
      title={`Click to place, or drag onto the canvas — ${variantLabel}`}
      style={{ touchAction: 'manipulation' }}
      className={`cursor-grab rounded-lg border p-1.5 transition hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${variant.recommended ? 'border-[#86efac] bg-[#f7fff9]' : 'border-[#e5e7eb] bg-white'} ${isDragging ? 'opacity-40' : ''}`}
    >
      {preview}
    </div>
  )
}

// A component category: click the row to reveal its variants. Same in both modes.
function PaletteCategory({ item, onPick, onArm, onInspect, open, onToggle }) {
  const { t } = useLanguage()
  const variants = variantsForType(item.type)
  const wide = WIDE_HTML.has(item.type)
  const firstVariant = variants[0]
  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <button
        type="button"
        onClick={() => {
          onToggle()
          if (firstVariant) {
            const [w, h] = htmlSize(item.type, firstVariant)
            onInspect?.({
              type: item.label,
              label: firstVariant.label,
              desc: item.label,
              html: firstVariant.html,
              wide,
              size: `${w} x ${h}`,
            })
          }
        }}
        className={`flex w-full items-center gap-3 px-3 py-2 text-sm select-none hover:bg-[#eef2ff] ${open ? 'bg-[#f5f5ff]' : ''}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-base text-[#374151]">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left font-medium text-[#374151]">{t(item.label)}</span>
        {variants.length > 0 && <span className="text-[11px] text-[#9ca3af]">{variants.length}</span>}
        {variants.length > 0 && <span className="w-3 text-[10px] text-[#9ca3af]">{open ? '▾' : '▸'}</span>}
      </button>
      {open && variants.length > 0 && (
        <div className="grid grid-cols-2 gap-2 border-t border-[#f1f1f4] bg-[#fafafa] p-2">
          {variants.map((v) => (
            <VariantSwatch key={v.id} type={item.type} variant={v} onPick={onPick} onArm={onArm} onInspect={onInspect} wide={wide} />
          ))}
        </div>
      )}
    </div>
  )
}

// A ready-made section block, dual-mode (same library as the variants). HTML mode
// inserts the raw section HTML; the free canvas drops it as one `html` component.
function BlockCard({ block, onPick, onArm, onInspect, theme }) {
  const [w, h] = blockSize(block.id)
  const inspect = () => onInspect?.({
    type: 'Section',
    label: block.label,
    desc: block.desc,
    html: block.html,
    wide: true,
    size: `${w} x ${h}`,
  })
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { from: 'palette', type: 'section', preset: block.id, html: block.html, w, h, label: block.label },
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
          inspect()
          e.dataTransfer.setData(DRAG_MIME, 'section')
          e.dataTransfer.setData('text/plain', block.label)
          e.dataTransfer.effectAllowed = 'copy'
          window.setTimeout(() => onPick('section', block.html), 0)
        }}
        onMouseEnter={inspect}
        onClick={() => {
          inspect()
          onPick('section', block.html)
        }}
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
      onMouseEnter={inspect}
      onClick={() => {
        inspect()
        onArm?.({ type: 'section', preset: block.id, html: block.html, w, h, label: block.label })
      }}
      title={`Click to place, or drag onto the canvas — ${block.label} section`}
      style={{ touchAction: 'manipulation' }}
      className={`cursor-grab rounded-lg border border-[#e5e7eb] bg-white p-2.5 transition hover:border-[#4f46e5] hover:bg-[#fafaff] active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      {inner}
    </div>
  )
}

function CustomBlockPanel({ onPick, onArm, onInspect, theme }) {
  const { t } = useLanguage()
  const addBlock = useEditorStore((s) => s.addBlock)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('Custom block')
  const [html, setHtml] = useState(DEFAULT_CUSTOM_HTML)
  const [saved, setSaved] = useState(() => readCustomBlocks())
  const [deleted, setDeleted] = useState(null)
  const hasHtml = html.trim().length > 0

  const placeCustom = (customHtml = html) => {
    const cleanHtml = customHtml.trim()
    if (!cleanHtml) return
    if (onPick) {
      onPick('section', cleanHtml)
      return
    }
    addBlock([{ type: 'html', x: 24, y: 0, w: 1000, h: 360, props: { code: cleanHtml } }], 24)
  }

  const saveCustom = () => {
    const cleanHtml = html.trim()
    if (!cleanHtml) return
    const nextBlock = {
      id: `custom-${Date.now()}`,
      label: label.trim() || t('Custom block'),
      desc: t('Saved custom HTML'),
      html: cleanHtml,
    }
    const next = [nextBlock, ...saved].slice(0, 24)
    setSaved(next)
    writeCustomBlocks(next)
    setDeleted(null)
  }

  const deleteCustom = (block) => {
    const index = saved.findIndex((item) => item.id === block.id)
    if (index < 0) return
    const next = saved.filter((item) => item.id !== block.id)
    setSaved(next)
    writeCustomBlocks(next)
    setDeleted({ block, index })
  }

  const undoDeleteCustom = () => {
    if (!deleted) return
    setSaved((current) => {
      if (current.some((item) => item.id === deleted.block.id)) return current
      const next = [...current]
      next.splice(Math.min(deleted.index, next.length), 0, deleted.block)
      writeCustomBlocks(next)
      return next
    })
    setDeleted(null)
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-3 px-3 py-2 text-sm select-none hover:bg-[#eef2ff] ${open ? 'bg-[#f5f5ff]' : ''}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#374151]">
          <CodeIcon size={15} />
        </span>
        <span className="flex-1 text-left font-medium text-[#374151]">{t('Custom HTML')}</span>
        {saved.length > 0 && <span className="text-[11px] text-[#9ca3af]">{saved.length}</span>}
        <span className="w-3 text-[10px] text-[#9ca3af]">{open ? '-' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[#f1f1f4] bg-[#fafafa] p-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('Block name')}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2 text-xs text-[#374151] outline-none focus:border-[#4f46e5]"
          />
          <textarea
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            spellCheck={false}
            rows={7}
            placeholder="<section>...</section>"
            className="w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[#374151] outline-none focus:border-[#4f46e5]"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => placeCustom()}
              disabled={!hasHtml}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#4f46e5] px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PlusIcon size={13} /> {t('Place')}
            </button>
            <button
              type="button"
              onClick={saveCustom}
              disabled={!hasHtml}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2 text-xs font-semibold text-[#374151] transition hover:border-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SaveIcon size={13} /> {t('Save')}
            </button>
          </div>
          {saved.length > 0 && (
            <div className="pt-1">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{t('Saved snippets')}</div>
              <div className="grid grid-cols-2 gap-2">
                {saved.map((block) => (
                  <div key={block.id} className="group relative">
                    <BlockCard block={block} onPick={onPick} onArm={onArm} onInspect={onInspect} theme={theme} />
                    {/* Delete a saved snippet — hover-revealed so the cards
                        stay clean, always visible on touch (no hover there). */}
                    <button
                      type="button"
                      title={t('Delete saved block')}
                      aria-label={`${t('Delete saved block')}: ${block.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCustom(block)
                      }}
                      className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-md bg-[#111827]/70 text-[10px] leading-none text-white opacity-0 transition hover:bg-[#a4262c] focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {deleted && (
            <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-2.5 py-2 text-xs text-[#1e40af]">
              <span className="min-w-0 flex-1 truncate">{t('Saved block deleted')}: {deleted.block.label}</span>
              <button type="button" onClick={undoDeleteCustom} className="shrink-0 font-semibold underline underline-offset-2">
                {t('Undo')}
              </button>
            </div>
          )}
        </div>
      )}
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
// → classic dnd-kit canvas palette, where `onArmPlacement(data)` is the
// click/tap-to-place fallback). `onCollapse` hides the whole rail.
export default function Sidebar({ onPickComponent, onArmPlacement, onCollapse, filesPanel }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState(filesPanel ? 'files' : 'components')
  const [openType, setOpenType] = useState(null)
  const [preview, setPreview] = useState(null)
  const theme = useEditorStore((s) => s.schema.theme)
  return (
    <aside className="studio-panel flex w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="studio-panel flex shrink-0 items-center border-b">
        {filesPanel ? (
          TABS.map(([id, label, TabIcon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold ${
                tab === id
                  ? 'border-b-2 border-[var(--studio-accent)] text-[var(--studio-accent-hover)]'
                  : 'text-[var(--studio-text-muted)] hover:text-[var(--studio-text)]'
              }`}
            >
              <TabIcon size={15} /> {t(label)}
            </button>
          ))
        ) : (
          <span className="flex-1 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            {t('Components')}
          </span>
        )}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title={t('Hide panel')}
            className="px-2 py-2 text-xs text-[var(--studio-text-faint)] hover:text-[var(--studio-text)]"
          >
            «
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filesPanel && tab === 'files' ? (
          filesPanel
        ) : (
          <>
            {/* ONE library for both modes — the same Sections + Components. */}
            <div className="mb-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                {t('Sections')}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {HTML_BLOCKS.map((b) => (
                  <BlockCard key={b.id} block={b} onPick={onPickComponent} onArm={onArmPlacement} onInspect={setPreview} theme={theme} />
                ))}
              </div>
              <CustomBlockPanel onPick={onPickComponent} onArm={onArmPlacement} onInspect={setPreview} theme={theme} />
            </div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              {t('Components')}
            </h2>
            <div className="mb-3 flex gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-2.5 text-[#166534]">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#22c55e] text-[11px] font-black text-white"
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold">{t('Bootstrap variants')}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-[#15803d]">
                  {t('Bootstrap variants use Bootstrap class markup and include dependency-free fallback styles.')}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {ADDABLE_PALETTE_ITEMS.map((item) => (
                <PaletteCategory
                  key={item.type}
                  item={item}
                  onPick={onPickComponent}
                  onArm={onArmPlacement}
                  onInspect={setPreview}
                  open={openType === item.type}
                  onToggle={() => setOpenType((t) => (t === item.type ? null : item.type))}
                />
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[#6b7280]">
              {onPickComponent
                ? t('Click in the page or drag to place.')
                : t('Click (or tap) to place, or drag onto the canvas.')}
            </p>
          </>
        )}
      </div>
      {!(filesPanel && tab === 'files') && (
        <PalettePreviewPanel preview={preview} onClose={() => setPreview(null)} />
      )}
    </aside>
  )
}
