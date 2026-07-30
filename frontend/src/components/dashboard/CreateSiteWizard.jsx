import { useEffect, useRef, useState } from 'react'
import { createSite } from '../../api/sites.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { TEMPLATE_LIBRARY, TEMPLATE_SITE_CATEGORY_MAP } from '../../utils/templateLibrary.js'
import { localizeTemplateHtml } from '../../utils/templateLocalization.js'
import { DEFAULT_THEME } from '../../utils/theme.js'
import { apiError } from '../../utils/errors.js'
import { CheckIcon, FileCodeIcon, LayersIcon, SparklesIcon } from '../icons.jsx'

const LEGACY_CATEGORY_MAP = {
  other: 'other',
  // Keep the former wizard identifiers valid for any persisted draft.
  resume: 'personal', restaurant: 'business', photography: 'portfolio', bio: 'personal',
}

// Catch-all type for sites that fit none of the template categories — it has
// no template variants, so the start choices there are blank canvas / import.
const OTHER_CATEGORY = {
  id: 'other',
  icon: '✨',
  name: 'Other / custom',
  desc: 'Anything else — start from a blank canvas or bring your own HTML.',
  variants: [],
}

// Every type also offers these alternative starting points besides the
// recommended templates: an empty drag-and-drop canvas, or the user's own
// HTML (uploaded file or pasted code).
const START_MODES = [
  { id: 'template', icon: SparklesIcon, name: 'Ready template', desc: 'Pick a designed starting point and edit it.' },
  { id: 'blank', icon: LayersIcon, name: 'Blank canvas', desc: 'Start empty and drag components onto the canvas yourself.' },
  { id: 'import', icon: FileCodeIcon, name: 'Your own HTML', desc: 'Upload an .html file or paste code.' },
]

function MiniPreview({ html, title }) {
  const boxRef = useRef(null)
  const [scale, setScale] = useState(0.24)

  useEffect(() => {
    const element = boxRef.current
    if (!element) return undefined
    const update = () => {
      if (element.clientWidth > 0) setScale(element.clientWidth / 1067)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={boxRef} className="aspect-[4/3] overflow-hidden border-b border-[var(--studio-border)] bg-white" data-theme-inverted>
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        className="pointer-events-none border-0"
        style={{ width: 1067, height: 800, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

export default function CreateSiteWizard({ open, onClose, onCreated }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('portfolio')
  const [contentLanguage, setContentLanguage] = useState('tr')
  const [templateId, setTemplateId] = useState('')
  const [startMode, setStartMode] = useState('template') // template | blank | import
  const [importHtml, setImportHtml] = useState('')
  const [importName, setImportName] = useState('')
  const [publishNow, setPublishNow] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const category =
    categoryId === 'other'
      ? OTHER_CATEGORY
      : TEMPLATE_LIBRARY.find((item) => item.id === categoryId) || TEMPLATE_LIBRARY[0]
  const recommended = category.variants.slice(0, 4)
  const selectedTemplate = category.variants.find((item) => item.id === templateId) || recommended[0]
  const previewTitle = title.trim() || t('My Site')
  // The "Other" type has no templates — its start choices are blank / import.
  const availableModes = category.variants.length
    ? START_MODES
    : START_MODES.filter((mode) => mode.id !== 'template')
  const effectiveMode = availableModes.some((mode) => mode.id === startMode)
    ? startMode
    : availableModes[0].id
  const localizedPreview =
    effectiveMode === 'template' && selectedTemplate
      ? localizeTemplateHtml(selectedTemplate.build(previewTitle), contentLanguage)
      : ''
  const canLeaveStartStep =
    effectiveMode === 'blank' ||
    (effectiveMode === 'template' && !!selectedTemplate) ||
    (effectiveMode === 'import' && !!importHtml.trim())

  if (!open) return null

  function close() {
    if (creating) return
    setStep(0)
    setError('')
    onClose?.()
  }

  function loadHtmlFile(file) {
    if (!file) return
    file.text().then((text) => {
      setImportHtml(text)
      setImportName(file.name)
    }).catch(() => setError(t('Could not read that file — try pasting the code instead.')))
  }

  async function create() {
    const safeTitle = title.trim()
    if (!safeTitle || creating || !canLeaveStartStep) return
    setCreating(true)
    setError('')
    try {
      // Blank canvas → an empty drag-and-drop page; template / import carry a
      // full HTML document and open straight in the HTML workspace.
      const html =
        effectiveMode === 'template'
          ? localizeTemplateHtml(selectedTemplate.build(safeTitle), contentLanguage)
          : effectiveMode === 'import'
            ? importHtml.trim()
            : ''
      const schema = {
        theme: { ...DEFAULT_THEME },
        customCss: '',
        customJs: '',
        contentLanguage,
        pages: [{
          id: 'page_home',
          name: contentLanguage === 'tr' ? 'Ana Sayfa' : 'Home',
          mode: html ? 'html' : 'empty',
          html,
          components: [],
        }],
      }
      const site = await createSite(safeTitle, {
        html,
        schema,
        category: TEMPLATE_SITE_CATEGORY_MAP[category.id] || LEGACY_CATEGORY_MAP[category.id] || 'other',
        published: publishNow,
      })
      onCreated?.(site)
    } catch (e) {
      setError(apiError(e))
      setCreating(false)
    }
  }

  const startLabel =
    effectiveMode === 'template'
      ? t(selectedTemplate?.name || 'Ready template')
      : effectiveMode === 'blank'
        ? t('Blank canvas')
        : importName || t('Pasted code')
  const stepLabels = [t('Site title'), t('Starting point'), t('Ready to create')]

  return (
    <div className="studio-theme-surface studio-overlay fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-site-title"
        className="flex h-[min(46rem,calc(100dvh-1rem))] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--studio-radius-2xl)] border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] text-[var(--studio-text)] shadow-[var(--studio-shadow-lg)] sm:h-[min(46rem,calc(100dvh-2rem))]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-[var(--studio-border)] px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
              <SparklesIcon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="create-site-title" className="truncate font-bold text-[var(--studio-text)]">{t('Create a new site')}</h2>
              <p className="text-xs text-[var(--studio-text-muted)]">{t('Step {current} of 3', { current: step + 1 })} · {stepLabels[step]}</p>
            </div>
            <button type="button" aria-label={t('Close')} onClick={close} className="studio-icon-btn shrink-0 border border-[var(--studio-border)] bg-[var(--studio-control)]">×</button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
            {stepLabels.map((label, index) => (
              <div key={label} className="min-w-0">
                <span className={`block h-1 rounded-full ${index <= step ? 'bg-[var(--studio-accent)]' : 'bg-[var(--studio-border)]'}`} />
                <span className={`mt-1.5 hidden truncate text-[10px] font-semibold sm:block ${index === step ? 'text-[var(--studio-text)]' : 'text-[var(--studio-text-faint)]'}`}>{label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {step === 0 && (
            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--studio-text)]">{t('Site title')}</span>
                <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('e.g. My Portfolio')} className="studio-input min-h-11 w-full px-3.5 text-sm" />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-[var(--studio-text)]">{t('What kind of site is this?')}</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...TEMPLATE_LIBRARY, OTHER_CATEGORY].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(item.id)
                        setTemplateId(item.variants[0]?.id || '')
                        if (!item.variants.length && startMode === 'template') setStartMode('blank')
                      }}
                      aria-pressed={categoryId === item.id}
                      className={`relative flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition ${categoryId === item.id ? 'border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] shadow-sm' : 'border-[var(--studio-border)] bg-[var(--studio-panel-muted)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)]'}`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--studio-panel-raised)] text-xl shadow-sm">{item.icon}</span>
                      <span className="min-w-0 pr-5"><strong className="block text-sm text-[var(--studio-text)]">{t(item.name)}</strong><span className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--studio-text-muted)]">{t(item.desc)}</span></span>
                      {categoryId === item.id && <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--studio-accent)] text-white"><CheckIcon size={12} /></span>}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-[var(--studio-text)]">{t('How do you want to start?')}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {availableModes.map((mode) => {
                    const ModeIcon = mode.icon
                    const selected = effectiveMode === mode.id
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setStartMode(mode.id)}
                        aria-pressed={selected}
                        className={`relative flex min-h-28 flex-col gap-3 rounded-xl border p-3.5 text-left transition ${selected ? 'border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] shadow-sm' : 'border-[var(--studio-border)] bg-[var(--studio-panel-muted)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)]'}`}
                      >
                        <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? 'bg-[var(--studio-accent)] text-white' : 'bg-[var(--studio-control)] text-[var(--studio-text-muted)]'}`} aria-hidden><ModeIcon size={17} /></span>
                        <span className="min-w-0"><strong className="block text-sm text-[var(--studio-text)]">{t(mode.name)}</strong><span className="mt-1 block text-xs leading-4 text-[var(--studio-text-muted)]">{t(mode.desc)}</span></span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {effectiveMode === 'template' && (
                <>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-[var(--studio-text)]">{t('Content language')}</legend>
                    <div className="flex gap-2">
                      {[['tr', 'Türkçe'], ['en', 'English']].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setContentLanguage(value)} aria-pressed={contentLanguage === value} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${contentLanguage === value ? 'border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]' : 'border-[var(--studio-border-strong)] text-[var(--studio-text)]'}`}>{label}</button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-[var(--studio-text)]">{t('Choose a template')}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {recommended.map((item) => {
                        const selected = item.id === selectedTemplate.id
                        const sample = localizeTemplateHtml(item.build(previewTitle), contentLanguage)
                        return (
                          <button key={item.id} type="button" onClick={() => setTemplateId(item.id)} aria-pressed={selected} className={`overflow-hidden rounded-xl border bg-[var(--studio-panel-muted)] text-left transition ${selected ? 'border-[var(--studio-accent)] ring-2 ring-[var(--studio-focus-ring)]' : 'border-[var(--studio-border)] hover:border-[var(--studio-border-strong)]'}`}>
                            <MiniPreview html={sample} title={t('{name} preview', { name: t(item.name) })} />
                            <span className="flex items-center justify-between gap-2 p-3 text-sm font-semibold text-[var(--studio-text)]">{t(item.name)}{selected && <CheckIcon size={14} className="text-[var(--studio-accent-hover)]" />}</span>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                </>
              )}

              {effectiveMode === 'blank' && (
                <div className="rounded-xl border border-dashed border-[var(--studio-border-strong)] bg-[var(--studio-panel-muted)] p-5 text-sm leading-6 text-[var(--studio-text-muted)]">
                  {t('You start with an empty canvas and drag components onto it yourself — nothing is pre-made.')}
                </div>
              )}

              {effectiveMode === 'import' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm"
                      className="hidden"
                      onChange={(event) => {
                        loadHtmlFile(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="studio-btn studio-btn-secondary min-h-10 px-4">
                      <FileCodeIcon size={15} /> {t('Upload HTML file…')}
                    </button>
                    {importName && (
                      <span className="rounded-full bg-[var(--studio-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--studio-accent-hover)]">
                        {t('Loaded file: {name}', { name: importName })}
                      </span>
                    )}
                    <span className="text-xs text-[var(--studio-text-faint)]">{t('or paste your code below')}</span>
                  </div>
                  <textarea
                    value={importHtml}
                    onChange={(event) => { setImportHtml(event.target.value); setImportName('') }}
                    spellCheck={false}
                    rows={10}
                    placeholder={t('Paste your HTML code here…')}
                    className="studio-input w-full resize-y px-3 py-2.5 font-mono text-xs leading-relaxed"
                  />
                  {importHtml.trim() && (
                    <div className="overflow-hidden rounded-xl border border-[var(--studio-border)]">
                      <iframe title={t('Imported HTML preview')} srcDoc={importHtml} sandbox="" className="h-[240px] w-full border-0 bg-white" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-[var(--studio-text)]">{t('Ready to create')}</h3>
                <dl className="divide-y divide-[var(--studio-border)] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-muted)] text-sm">
                  <div className="flex justify-between gap-3 p-3"><dt className="text-[var(--studio-text-muted)]">{t('Site title')}</dt><dd className="font-semibold text-[var(--studio-text)]">{title.trim()}</dd></div>
                  <div className="flex justify-between gap-3 p-3"><dt className="text-[var(--studio-text-muted)]">{t('Type')}</dt><dd className="font-semibold text-[var(--studio-text)]">{t(category.name)}</dd></div>
                  <div className="flex justify-between gap-3 p-3"><dt className="text-[var(--studio-text-muted)]">{t('Starting point')}</dt><dd className="max-w-[200px] truncate font-semibold text-[var(--studio-text)]">{startLabel}</dd></div>
                  {effectiveMode === 'template' && (
                    <div className="flex justify-between gap-3 p-3"><dt className="text-[var(--studio-text-muted)]">{t('Content language')}</dt><dd className="font-semibold text-[var(--studio-text)]">{contentLanguage === 'tr' ? 'Türkçe' : 'English'}</dd></div>
                  )}
                </dl>
                <label className="flex items-start gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-muted)] p-3 text-sm text-[var(--studio-text)]">
                  <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} className="mt-0.5" />
                  <span><strong className="block">{t('Publish immediately')}</strong><span className="text-xs text-[var(--studio-text-muted)]">{t('Leave this off to review the site in the editor first.')}</span></span>
                </label>
              </div>
              {effectiveMode === 'blank' ? (
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--studio-border-strong)] bg-[var(--studio-panel-muted)] p-6 text-center text-sm text-[var(--studio-text-faint)]">
                  {t('Empty canvas — you will design this page from scratch in the editor.')}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-control)]">
                  <iframe
                    title={t('Selected template preview')}
                    srcDoc={effectiveMode === 'template' ? localizedPreview : importHtml}
                    sandbox=""
                    className="h-[420px] w-full border-0 bg-white"
                  />
                </div>
              )}
            </div>
          )}
          {error && <p role="alert" className="studio-status-danger mt-4 rounded-lg border px-3 py-2 text-sm">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--studio-border)] bg-[var(--studio-panel-muted)] px-4 py-3.5 sm:px-6">
          <button type="button" onClick={step === 0 ? close : () => setStep((value) => value - 1)} disabled={creating} className="studio-btn studio-btn-secondary min-h-10 px-4">{step === 0 ? t('Cancel') : t('Back')}</button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((value) => value + 1)}
              disabled={(step === 0 && !title.trim()) || (step === 1 && !canLeaveStartStep)}
              className="studio-btn studio-btn-primary min-h-10 px-5"
            >
              {t('Next →')}
            </button>
          ) : (
            <button type="button" onClick={create} disabled={creating || !canLeaveStartStep} className="studio-btn studio-btn-primary min-h-10 px-5">{creating ? t('Creating…') : t('Create and open editor')}</button>
          )}
        </footer>
      </section>
    </div>
  )
}
