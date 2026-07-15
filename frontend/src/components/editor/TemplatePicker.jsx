import { useEffect, useRef, useState } from 'react'
import { TEMPLATE_COUNT, TEMPLATE_LIBRARY } from '../../utils/templateLibrary.js'
import { localizeTemplateHtml } from '../../utils/templateLocalization.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { EyeIcon, SearchIcon, StarIcon } from '../icons.jsx'

const DESIGN_W = 1200
const DESIGN_H = 860
const FAVORITES_KEY = 'pwb_template_favorites'
const RECENTS_KEY = 'pwb_template_recents'
const ALL_TEMPLATES = TEMPLATE_LIBRARY.flatMap((category) => (
  category.variants.map((template) => ({ category, template }))
))

function readIds(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch { return [] }
}

function writeIds(key, ids) {
  try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* ignore */ }
}

function Thumb({ html }) {
  const { t } = useLanguage()
  const boxRef = useRef(null)
  const [scale, setScale] = useState(0.3)
  useEffect(() => {
    const element = boxRef.current
    if (!element) return undefined
    const update = () => {
      const width = element.clientWidth
      if (width > 0) setScale(width / DESIGN_W)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={boxRef} className="relative w-full overflow-hidden border-b border-[#e5e7eb] bg-white" style={{ aspectRatio: `${DESIGN_W} / ${DESIGN_H}` }}>
      <iframe
        title={t('template preview')}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        scrolling="no"
        style={{ width: DESIGN_W, height: DESIGN_H, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}
      />
    </div>
  )
}

export default function TemplatePicker({ open, title, onPick, onClose }) {
  const { language, t } = useLanguage()
  const [activeId, setActiveId] = useState(TEMPLATE_LIBRARY[0].id)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('category') // category | favorites | recent
  const [favorites, setFavorites] = useState(() => readIds(FAVORITES_KEY))
  const [recents, setRecents] = useState(() => readIds(RECENTS_KEY))
  const [preview, setPreview] = useState(null)
  const [contentLanguage, setContentLanguage] = useState(language)
  if (!open) return null

  const active = TEMPLATE_LIBRARY.find((category) => category.id === activeId) || TEMPLATE_LIBRARY[0]
  const siteTitle = title || t('My Site')
  const normalizedQuery = query.trim().toLocaleLowerCase(language === 'tr' ? 'tr-TR' : 'en-US')
  const order = view === 'recent' ? recents : null
  let entries = view === 'category' && !normalizedQuery
    ? active.variants.map((template) => ({ category: active, template }))
    : ALL_TEMPLATES.filter(({ category, template }) => {
        if (view === 'favorites' && !favorites.includes(template.id)) return false
        if (view === 'recent' && !recents.includes(template.id)) return false
        if (!normalizedQuery) return true
        return [t(category.name), t(template.name), t(template.desc)]
          .join(' ')
          .toLocaleLowerCase(language === 'tr' ? 'tr-TR' : 'en-US')
          .includes(normalizedQuery)
      })
  if (order) entries = [...entries].sort((a, b) => order.indexOf(a.template.id) - order.indexOf(b.template.id))

  function toggleFavorite(templateId) {
    setFavorites((current) => {
      const next = current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [templateId, ...current]
      writeIds(FAVORITES_KEY, next)
      return next
    })
  }

  function choose(template) {
    const nextRecents = [template.id, ...recents.filter((id) => id !== template.id)].slice(0, 10)
    setRecents(nextRecents)
    writeIds(RECENTS_KEY, nextRecents)
    onPick(template, contentLanguage)
  }

  function localizedHtml(template) {
    return localizeTemplateHtml(template.build(siteTitle), contentLanguage)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-2 sm:p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-title"
        className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-2xl sm:h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[#e5e7eb]">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 id="template-gallery-title" className="text-base font-semibold text-[#111827]">
                {t('Template gallery')}
                <span className="ml-2 rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs font-semibold text-[#4f46e5]">{t('{count} templates', { count: TEMPLATE_COUNT })}</span>
              </h2>
              <p className="hidden text-xs text-[#6b7280] sm:block">{t('Search, preview and save favorites before applying a template.')}</p>
            </div>
            <button type="button" aria-label={t('Close')} onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-[#6b7280] hover:bg-[#f3f4f6]">✕</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-5">
            <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5">
              <SearchIcon size={14} className="text-[#9ca3af]" />
              <span className="sr-only">{t('Search templates')}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search templates…')} className="min-w-0 flex-1 text-sm outline-none" />
            </label>
            <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-semibold">
              {[
                ['category', 'All templates'],
                ['favorites', 'Favorites'],
                ['recent', 'Recent'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={view === id ? 'rounded-md bg-[#4f46e5] px-2.5 py-1 text-white' : 'rounded-md px-2.5 py-1 text-[#374151] hover:bg-[#f3f4f6]'}>{t(label)}</button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
              <span>{t('Content')}</span>
              <select value={contentLanguage} onChange={(event) => setContentLanguage(event.target.value)} aria-label={t('Content language')} className="rounded-lg border border-[#d1d5db] bg-white px-2 py-1.5">
                <option value="tr">TR</option>
                <option value="en">EN</option>
              </select>
            </label>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside aria-label={t('Template categories')} className="flex w-full shrink-0 gap-1 overflow-x-auto border-b border-[#e5e7eb] bg-[#f9fafb] p-2 md:block md:w-56 md:overflow-y-auto md:border-b-0 md:border-r">
            {TEMPLATE_LIBRARY.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => { setActiveId(category.id); setView('category'); setQuery('') }}
                aria-pressed={view === 'category' && category.id === activeId}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition md:mb-1 md:w-full ${view === 'category' && category.id === activeId ? 'bg-[#4f46e5] text-white shadow-sm' : 'text-[#374151] hover:bg-[#f3f4f6]'}`}
              >
                <span className="text-base">{category.icon}</span>
                <span className="min-w-0 flex-1 whitespace-nowrap font-medium md:truncate">{t(category.name)}</span>
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold">{category.variants.length}</span>
              </button>
            ))}
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#111827]">
                {view === 'favorites' ? `★ ${t('Favorites')}` : view === 'recent' ? `↺ ${t('Recent')}` : `${active.icon} ${t(active.name)}`}
                <span className="ml-2 text-xs font-normal text-[#6b7280]">{t('{count} results', { count: entries.length })}</span>
              </h3>
            </div>
            {entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d1d5db] py-16 text-center text-sm text-[#6b7280]">{t('No templates match this view.')}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map(({ category, template }) => {
                  const favorite = favorites.includes(template.id)
                  return (
                    <article key={template.id} className="group flex flex-col overflow-hidden rounded-lg border border-[#e5e7eb] transition hover:border-[#4f46e5] hover:shadow-lg">
                      <div className="relative">
                        <Thumb html={localizedHtml(template)} />
                        <button type="button" onClick={() => toggleFavorite(template.id)} aria-label={t(favorite ? 'Remove from favorites' : 'Add to favorites')} aria-pressed={favorite} className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow ${favorite ? 'text-[#f59e0b]' : 'text-[#6b7280]'}`}><StarIcon size={16} filled={favorite} /></button>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        {(view !== 'category' || normalizedQuery) && <span className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#4f46e5]">{t(category.name)}</span>}
                        <div className="text-sm font-semibold text-[#111827]">{t(template.name)}</div>
                        <p className="mt-0.5 flex-1 text-xs leading-relaxed text-[#6b7280]">{t(template.desc)}</p>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => setPreview({ category, template })} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#d1d5db] px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#f3f4f6]"><EyeIcon size={13} /> {t('Preview')}</button>
                          <button type="button" onClick={() => choose(template)} className="flex-1 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4338ca]">{t('Use this template')}</button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {preview && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#111827]/95 p-2 sm:p-5" onClick={() => setPreview(null)}>
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 rounded-t-xl bg-white px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#111827]">{t(preview.template.name)}</strong><span className="text-xs text-[#6b7280]">{t(preview.category.name)} · {contentLanguage.toUpperCase()}</span></div>
            <button type="button" onClick={() => choose(preview.template)} className="rounded-lg bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white">{t('Use this template')}</button>
            <button type="button" aria-label={t('Close preview')} onClick={() => setPreview(null)} className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#374151]">✕</button>
          </div>
          <iframe title={t('Full-screen template preview')} srcDoc={localizedHtml(preview.template)} sandbox="" className="mx-auto min-h-0 w-full max-w-7xl flex-1 rounded-b-xl border-0 bg-white" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
