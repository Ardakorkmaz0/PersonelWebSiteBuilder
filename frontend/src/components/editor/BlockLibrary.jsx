import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { HTML_BLOCKS } from '../../utils/htmlVariants.js'
import { LayersIcon, SearchIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import {
  ADDABLE_PALETTE_ITEMS,
  NATIVE_CANVAS_TYPES,
  WIDE_HTML,
  blockSize,
  htmlSize,
  previewSrcDoc,
  variantsForType,
} from './paletteData.js'

// Webflow-style block library: a full overlay with a category rail, search and
// large live previews. It is a DISCOVERY surface — picking a block closes the
// overlay and hands off to the existing placement flows (tap-to-place on the
// free canvas via onArm, direct insert in HTML mode via onPick). The compact
// sidebar palette keeps drag-and-drop for users who know what they want.

// Larger sibling of the sidebar's HtmlPreview — same trusted template HTML,
// scaled to a roomier card.
function BigPreview({ html, wide }) {
  return (
    <div className="flex h-[104px] w-full items-center justify-center overflow-hidden rounded-lg bg-[#f8fafc]">
      <div
        style={
          wide
            ? { width: 560, transform: 'scale(0.34)', transformOrigin: 'center', flexShrink: 0, pointerEvents: 'none' }
            : { transform: 'scale(0.9)', transformOrigin: 'center', pointerEvents: 'none' }
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

// Section previews render in a sandboxed iframe (their markup is bigger and
// uses full-page layout, which would leak styles into the modal as raw HTML).
function SectionPreview({ html }) {
  const { t } = useLanguage()
  return (
    <iframe
      title={t('Palette preview')}
      sandbox=""
      loading="lazy"
      srcDoc={previewSrcDoc(html, true)}
      className="pointer-events-none h-[104px] w-full rounded-lg bg-white"
    />
  )
}

function LibraryCard({ entry, onUse }) {
  const { t } = useLanguage()
  const label = t(entry.label)
  return (
    <button
      type="button"
      onClick={() => onUse(entry)}
      title={`${label} — ${t('Click a block, then click on the canvas to place it.')}`}
      className="group flex flex-col rounded-xl border border-[var(--studio-border,#e5e7eb)] bg-[var(--studio-panel-raised,#ffffff)] p-2 text-left transition hover:border-[var(--studio-accent,#4f46e5)] hover:shadow-md"
    >
      {entry.kind === 'section'
        ? <SectionPreview html={entry.html} />
        : <BigPreview html={entry.html} wide={entry.wide} />}
      <span className="mt-2 truncate text-xs font-semibold text-[var(--studio-text,#374151)]">{label}</span>
      <span className="truncate text-[11px] text-[var(--studio-text-faint,#9ca3af)]">
        {t(entry.categoryLabel)}
      </span>
    </button>
  )
}

// Flatten the whole palette into searchable entries once per open.
function buildEntries() {
  const entries = []
  for (const block of HTML_BLOCKS) {
    const [w, h] = blockSize(block.id)
    entries.push({
      kind: 'section',
      key: `section-${block.id}`,
      categoryId: 'sections',
      categoryLabel: 'Sections',
      label: block.label,
      desc: block.desc || '',
      html: block.html,
      wide: true,
      use: { type: 'section', preset: block.id, html: block.html, w, h, label: block.label },
    })
  }
  for (const item of ADDABLE_PALETTE_ITEMS) {
    for (const variant of variantsForType(item.type)) {
      const [w, h] = htmlSize(item.type, variant)
      const native = NATIVE_CANVAS_TYPES.has(item.type)
      entries.push({
        kind: 'variant',
        key: `${item.type}-${variant.id}`,
        categoryId: item.type,
        categoryLabel: item.label,
        label: variant.label === 'Default' ? item.label : variant.label,
        desc: item.label,
        html: variant.html,
        wide: WIDE_HTML.has(item.type),
        use: native
          ? { type: item.type, preset: variant.id === 'default' ? null : variant.id, w, h, label: variant.label }
          : { type: item.type, preset: variant.id === 'default' ? null : variant.id, html: variant.html, w, h, label: variant.label },
      })
    }
  }
  return entries
}

export default function BlockLibrary({ open, onClose, onPickComponent, onArmPlacement }) {
  const { t } = useLanguage()
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const entries = useMemo(() => buildEntries(), [])
  const categories = useMemo(
    () => [
      { id: 'all', label: 'All blocks', count: entries.length },
      { id: 'sections', label: 'Sections', count: HTML_BLOCKS.length },
      ...ADDABLE_PALETTE_ITEMS.map((item) => ({
        id: item.type,
        label: item.label,
        count: entries.filter((e) => e.categoryId === item.type).length,
      })),
    ],
    [entries],
  )

  if (!open) return null

  const q = query.trim().toLocaleLowerCase('tr')
  const visible = entries.filter((entry) => {
    if (!q && category !== 'all' && entry.categoryId !== category) return false
    if (!q) return true
    // Search spans EVERYTHING (ignores the active category) and matches both
    // the raw English label and its Turkish translation.
    const haystack = [entry.label, t(entry.label), entry.categoryLabel, t(entry.categoryLabel)]
      .join(' ')
      .toLocaleLowerCase('tr')
    return haystack.includes(q)
  })

  const use = (entry) => {
    if (onPickComponent) {
      onPickComponent(entry.use.type, entry.use.html ?? entry.html)
    } else {
      onArmPlacement?.(entry.use)
    }
    onClose()
  }

  return createPortal(
    <div
      className="studio-theme-surface fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3 sm:p-6"
      onClick={onClose}
      data-block-library=""
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(760px,94vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[var(--studio-panel,#ffffff)] shadow-2xl"
      >
        {/* Header: title + search + close */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--studio-border,#e5e7eb)] px-4 py-3 sm:px-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#2563eb] text-white">
            <LayersIcon size={15} />
          </span>
          <h2 className="text-sm font-bold text-[var(--studio-text,#111827)]">{t('Block library')}</h2>
          <label className="relative ml-auto min-w-0 flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--studio-text-faint,#9ca3af)]">
              <SearchIcon size={14} />
            </span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search blocks')}
              className="w-full rounded-lg border border-[var(--studio-border,#d1d5db)] bg-[var(--studio-control,#f9fafb)] py-1.5 pl-8 pr-3 text-sm text-[var(--studio-text,#111827)] outline-none focus:border-[var(--studio-accent,#4f46e5)]"
            />
          </label>
          <button
            type="button"
            onClick={onClose}
            title={t('Close')}
            className="rounded-lg px-2 py-1 text-sm text-[var(--studio-text-faint,#9ca3af)] hover:bg-[var(--studio-control-hover,#f3f4f6)] hover:text-[var(--studio-text,#374151)]"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Category rail (desktop) */}
          <nav className="hidden w-48 shrink-0 overflow-y-auto border-r border-[var(--studio-border,#e5e7eb)] p-2 sm:block">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id)
                  setQuery('')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ${
                  category === cat.id && !q
                    ? 'bg-[var(--studio-control,#eef2ff)] font-semibold text-[var(--studio-accent,#4f46e5)]'
                    : 'text-[var(--studio-text-muted,#6b7280)] hover:bg-[var(--studio-control-hover,#f3f4f6)] hover:text-[var(--studio-text,#374151)]'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{t(cat.label)}</span>
                <span className="text-[10px] text-[var(--studio-text-faint,#9ca3af)]">{cat.count}</span>
              </button>
            ))}
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Category chips (mobile) */}
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[var(--studio-border,#f1f1f4)] p-2 sm:hidden">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id)
                    setQuery('')
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${
                    category === cat.id && !q
                      ? 'border-[var(--studio-accent,#4f46e5)] bg-[var(--studio-control,#eef2ff)] text-[var(--studio-accent,#4f46e5)]'
                      : 'border-[var(--studio-border,#e5e7eb)] text-[var(--studio-text-muted,#6b7280)]'
                  }`}
                >
                  {t(cat.label)}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {visible.length === 0 ? (
                <p className="mt-10 text-center text-sm text-[var(--studio-text-muted,#6b7280)]">
                  {t('No blocks match your search')}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {visible.map((entry) => (
                    <LibraryCard key={entry.key} entry={entry} onUse={use} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--studio-border,#e5e7eb)] px-4 py-2 text-[11px] text-[var(--studio-text-muted,#6b7280)] sm:px-5">
          {onPickComponent
            ? t('Click a block to insert it into the page.')
            : t('Click a block, then click on the canvas to place it.')}
          {' '}
          {t('Bootstrap variants use Bootstrap class markup and include dependency-free fallback styles.')}
        </div>
      </div>
    </div>,
    document.body,
  )
}
