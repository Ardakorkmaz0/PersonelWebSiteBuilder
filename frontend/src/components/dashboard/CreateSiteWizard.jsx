import { useRef, useState } from 'react'
import { createSite } from '../../api/sites.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { TEMPLATE_LIBRARY } from '../../utils/templateLibrary.js'
import { localizeTemplateHtml } from '../../utils/templateLocalization.js'
import { DEFAULT_THEME } from '../../utils/theme.js'
import { apiError } from '../../utils/errors.js'

const CATEGORY_MAP = {
  resume: 'personal', portfolio: 'portfolio', landing: 'landing', business: 'business',
  restaurant: 'business', photography: 'portfolio', blog: 'blog', event: 'personal',
  shop: 'shop', bio: 'personal', other: 'other',
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
  { id: 'template', icon: '🧩', name: 'Ready template', desc: 'Pick a designed starting point and edit it.' },
  { id: 'blank', icon: '⬜', name: 'Blank canvas', desc: 'Start empty and drag components onto the canvas yourself.' },
  { id: 'import', icon: '📄', name: 'Your own HTML', desc: 'Upload an .html file or paste code.' },
]

function MiniPreview({ html, title }) {
  return (
    <div className="aspect-[4/3] overflow-hidden border-b border-[#e5e7eb] bg-white">
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        className="h-[800px] w-[1067px] origin-top-left scale-[0.24] border-0 pointer-events-none"
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
        category: CATEGORY_MAP[category.id] || 'other',
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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-site-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[#e5e7eb] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="create-site-title" className="font-bold text-[#111827]">{t('Create a new site')}</h2>
            <p className="text-xs text-[#6b7280]">{t('Step {current} of 3', { current: step + 1 })}</p>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 w-8 rounded-full ${index <= step ? 'bg-[#4f46e5]' : 'bg-[#e5e7eb]'}`} />)}
          </div>
          <button type="button" aria-label={t('Close')} onClick={close} className="rounded-lg px-2 py-1 text-[#6b7280] hover:bg-[#f3f4f6]">✕</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#374151]">{t('Site title')}</span>
                <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('e.g. My Portfolio')} className="ms-input w-full" />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-[#374151]">{t('What kind of site is this?')}</legend>
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
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left ${categoryId === item.id ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e5e7eb] hover:bg-[#f9fafb]'}`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="min-w-0"><strong className="block text-sm text-[#111827]">{t(item.name)}</strong><span className="line-clamp-2 text-xs text-[#6b7280]">{t(item.desc)}</span></span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-[#374151]">{t('How do you want to start?')}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {availableModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setStartMode(mode.id)}
                      aria-pressed={effectiveMode === mode.id}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left ${effectiveMode === mode.id ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e5e7eb] hover:bg-[#f9fafb]'}`}
                    >
                      <span className="text-lg" aria-hidden>{mode.icon}</span>
                      <span className="min-w-0"><strong className="block text-sm text-[#111827]">{t(mode.name)}</strong><span className="text-xs text-[#6b7280]">{t(mode.desc)}</span></span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {effectiveMode === 'template' && (
                <>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-[#374151]">{t('Content language')}</legend>
                    <div className="flex gap-2">
                      {[['tr', 'Türkçe'], ['en', 'English']].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setContentLanguage(value)} aria-pressed={contentLanguage === value} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${contentLanguage === value ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]' : 'border-[#d1d5db] text-[#374151]'}`}>{label}</button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-[#374151]">{t('Choose a template')}</legend>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {recommended.map((item) => {
                        const selected = item.id === selectedTemplate.id
                        const sample = localizeTemplateHtml(item.build(previewTitle), contentLanguage)
                        return (
                          <button key={item.id} type="button" onClick={() => setTemplateId(item.id)} aria-pressed={selected} className={`overflow-hidden rounded-xl border text-left ${selected ? 'border-[#4f46e5] ring-2 ring-[#c7d2fe]' : 'border-[#e5e7eb] hover:border-[#a5b4fc]'}`}>
                            <MiniPreview html={sample} title={t('{name} preview', { name: t(item.name) })} />
                            <span className="block p-2.5 text-sm font-semibold text-[#111827]">{t(item.name)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                </>
              )}

              {effectiveMode === 'blank' && (
                <div className="rounded-xl border border-dashed border-[#d1d5db] bg-[#f9fafb] p-5 text-sm text-[#6b7280]">
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
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="ms-btn px-4 py-2">
                      📄 {t('Upload HTML file…')}
                    </button>
                    {importName && (
                      <span className="rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-xs font-semibold text-[#4f46e5]">
                        {t('Loaded file: {name}', { name: importName })}
                      </span>
                    )}
                    <span className="text-xs text-[#9ca3af]">{t('or paste your code below')}</span>
                  </div>
                  <textarea
                    value={importHtml}
                    onChange={(event) => { setImportHtml(event.target.value); setImportName('') }}
                    spellCheck={false}
                    rows={10}
                    placeholder={t('Paste your HTML code here…')}
                    className="w-full resize-y rounded-xl border border-[#d1d5db] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#374151] outline-none focus:border-[#4f46e5]"
                  />
                  {importHtml.trim() && (
                    <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
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
                <h3 className="text-lg font-bold text-[#111827]">{t('Ready to create')}</h3>
                <dl className="divide-y divide-[#e5e7eb] rounded-xl border border-[#e5e7eb] text-sm">
                  <div className="flex justify-between gap-3 p-3"><dt className="text-[#6b7280]">{t('Site title')}</dt><dd className="font-semibold text-[#111827]">{title.trim()}</dd></div>
                  <div className="flex justify-between gap-3 p-3"><dt className="text-[#6b7280]">{t('Type')}</dt><dd className="font-semibold text-[#111827]">{t(category.name)}</dd></div>
                  <div className="flex justify-between gap-3 p-3"><dt className="text-[#6b7280]">{t('Starting point')}</dt><dd className="max-w-[200px] truncate font-semibold text-[#111827]">{startLabel}</dd></div>
                  {effectiveMode === 'template' && (
                    <div className="flex justify-between gap-3 p-3"><dt className="text-[#6b7280]">{t('Content language')}</dt><dd className="font-semibold text-[#111827]">{contentLanguage === 'tr' ? 'Türkçe' : 'English'}</dd></div>
                  )}
                </dl>
                <label className="flex items-start gap-2 rounded-xl border border-[#e5e7eb] p-3 text-sm text-[#374151]">
                  <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} className="mt-0.5" />
                  <span><strong className="block">{t('Publish immediately')}</strong><span className="text-xs text-[#6b7280]">{t('Leave this off to review the site in the editor first.')}</span></span>
                </label>
              </div>
              {effectiveMode === 'blank' ? (
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] p-6 text-center text-sm text-[#9ca3af]">
                  {t('Empty canvas — you will design this page from scratch in the editor.')}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f3f4f6]">
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
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-4">
          <button type="button" onClick={step === 0 ? close : () => setStep((value) => value - 1)} disabled={creating} className="ms-btn px-4 py-2">{step === 0 ? t('Cancel') : t('Back')}</button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((value) => value + 1)}
              disabled={(step === 0 && !title.trim()) || (step === 1 && !canLeaveStartStep)}
              className="ms-btn ms-btn-primary px-5 py-2"
            >
              {t('Next →')}
            </button>
          ) : (
            <button type="button" onClick={create} disabled={creating || !canLeaveStartStep} className="ms-btn ms-btn-primary px-5 py-2">{creating ? t('Creating…') : t('Create and open editor')}</button>
          )}
        </footer>
      </section>
    </div>
  )
}
