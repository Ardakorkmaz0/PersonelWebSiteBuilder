import { useEffect, useRef, useState } from 'react'
import { runAiHtmlPrompt } from '../../utils/aiAssistant.js'
import {
  buildWizardPrompt,
  wizardMeta,
  DEFAULT_SECTIONS_BY_TYPE,
  WIZARD_ACCENTS,
  WIZARD_FONTS,
  WIZARD_MOODS,
  WIZARD_SECTIONS,
  WIZARD_SITE_TYPES,
} from '../../utils/aiWizard.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX, withViewportMeta } from '../../utils/htmlRuntime.js'
import { useLanguage } from '../../i18n/useLanguage.js'

const STEPS = ['Type', 'About', 'Style', 'Sections']

const GENERATING_LINES = [
  'Sketching the layout…',
  'Writing your copy…',
  'Choosing type and colors…',
  'Building the sections…',
  'Polishing the details…',
]

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
        active
          ? 'border-[#4f46e5] bg-[#eef2ff] font-semibold text-[#4f46e5]'
          : 'border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#374151]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#9ca3af]">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#111827] focus:border-[#4f46e5] focus:outline-none'

// Guided "describe it → get a full site" onboarding. Collects a handful of
// answers, builds ONE rich prompt (utils/aiWizard.js) and runs it through the
// same provider stack as the AI chat's HTML path — with an in-modal preview,
// a refine loop and a regenerate before anything touches the page.
export default function AiWizard({ open, onClose, onApply, onOpenTemplates, initialBrand = '' }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState('form') // form | generating | preview | error
  const [answers, setAnswers] = useState(() => ({
    type: 'portfolio',
    brand: initialBrand,
    tagline: '',
    description: '',
    email: '',
    socials: '',
    mood: 'minimal',
    accent: WIZARD_ACCENTS[0],
    font: 'modern',
    sections: DEFAULT_SECTIONS_BY_TYPE.portfolio,
    extra: '',
  }))
  const [html, setHtml] = useState('')
  const [providerUsed, setProviderUsed] = useState('')
  const [error, setError] = useState('')
  const [refineText, setRefineText] = useState('')
  const [refining, setRefining] = useState(false)
  const [statusLine, setStatusLine] = useState(GENERATING_LINES[0])
  const generationRef = useRef(0)

  // Rotate the status line while generating so the wait feels alive.
  useEffect(() => {
    if (phase !== 'generating') return undefined
    let i = 0
    const timer = setInterval(() => {
      i = (i + 1) % GENERATING_LINES.length
      setStatusLine(GENERATING_LINES[i])
    }, 2200)
    return () => clearInterval(timer)
  }, [phase])

  if (!open) return null

  const patch = (p) => setAnswers((a) => ({ ...a, ...p }))
  const pickType = (id) =>
    setAnswers((a) => ({ ...a, type: id, sections: DEFAULT_SECTIONS_BY_TYPE[id] || a.sections }))
  const toggleSection = (id) =>
    setAnswers((a) => ({
      ...a,
      sections: a.sections.includes(id)
        ? a.sections.filter((s) => s !== id)
        : [...a.sections, id],
    }))

  async function generate() {
    const run = ++generationRef.current
    setPhase('generating')
    setError('')
    setStatusLine(GENERATING_LINES[0])
    try {
      const result = await runAiHtmlPrompt(buildWizardPrompt(answers))
      if (run !== generationRef.current) return // superseded / closed
      setHtml(result.html)
      setProviderUsed(result.providerUsed)
      setPhase('preview')
    } catch (e) {
      if (run !== generationRef.current) return
      setError(e?.message || t('Generation failed.'))
      setPhase('error')
    }
  }

  async function refine() {
    const wish = refineText.trim()
    if (!wish || refining) return
    const run = ++generationRef.current
    setRefining(true)
    setError('')
    try {
      const result = await runAiHtmlPrompt(wish, { currentHtml: html })
      if (run !== generationRef.current) return
      setHtml(result.html)
      setProviderUsed(result.providerUsed)
      setRefineText('')
    } catch (e) {
      if (run !== generationRef.current) return
      setError(e?.message || t('Refine failed.'))
    } finally {
      if (run === generationRef.current) setRefining(false)
    }
  }

  function close() {
    generationRef.current += 1 // abandon any in-flight generation
    setPhase('form')
    onClose?.()
  }

  const noProvider = /No AI provider/i.test(error)
  const canNext =
    step !== 1 || answers.brand.trim() || answers.description.trim()

  return (
    <div className="studio-theme-surface fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[#e5e7eb] px-5 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#2563eb] text-white">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2z" fill="currentColor" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#111827]">{t('AI Site Wizard')}</h2>
            <p className="truncate text-xs text-[#6b7280]">
              {t('Answer a few questions — get a complete, responsive site.')}
            </p>
          </div>
          {phase === 'form' && (
            <div className="ml-auto flex items-center gap-1.5" aria-hidden>
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  title={s}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-[#4f46e5]' : i < step ? 'w-3 bg-[#a5b4fc]' : 'w-3 bg-[#e5e7eb]'
                  }`}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            title={t('Close')}
            className={`${phase === 'form' ? '' : 'ml-auto '}rounded-lg px-2 py-1 text-sm text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]`}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {phase === 'form' && step === 0 && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-[#111827]">{t('What kind of site is this?')}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {WIZARD_SITE_TYPES.map((type) => (
                  <Chip key={type.id} active={answers.type === type.id} onClick={() => pickType(type.id)}>
                    <span className="mr-1.5">{type.icon}</span>
                    {t(type.label)}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {phase === 'form' && step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#111827]">{t('Tell it about you')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Site / brand name')}>
                  <input
                    className={inputCls}
                    value={answers.brand}
                    onChange={(e) => patch({ brand: e.target.value })}
                    placeholder={t('e.g. Nova Studio, Arda Korkmaz')}
                  />
                </Field>
                <Field label={t('Tagline / role (optional)')}>
                  <input
                    className={inputCls}
                    value={answers.tagline}
                    onChange={(e) => patch({ tagline: e.target.value })}
                    placeholder={t('e.g. Freelance product designer')}
                  />
                </Field>
              </div>
              <Field
                label={t('What is it about?')}
                hint={t('The more specific you are, the better the copy — services, audience, what makes you different.')}
              >
                <textarea
                  className={`${inputCls} min-h-[96px] resize-y`}
                  value={answers.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder={t('e.g. I design mobile apps for early-stage startups. 6 years of experience, 40+ shipped projects…')}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Contact email (optional)')}>
                  <input
                    className={inputCls}
                    value={answers.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="hello@example.com"
                  />
                </Field>
                <Field label={t('Social links (optional)')}>
                  <input
                    className={inputCls}
                    value={answers.socials}
                    onChange={(e) => patch({ socials: e.target.value })}
                    placeholder="instagram.com/…, github.com/…"
                  />
                </Field>
              </div>
            </div>
          )}

          {phase === 'form' && step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#111827]">{t('Pick a vibe')}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WIZARD_MOODS.map((m) => (
                    <Chip key={m.id} active={answers.mood === m.id} onClick={() => patch({ mood: m.id })}>
                      {t(m.label)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#111827]">{t('Accent color')}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {WIZARD_ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ accent: c })}
                      title={c}
                      style={{ backgroundColor: c }}
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        answers.accent === c ? 'border-[#111827] scale-110' : 'border-white shadow'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={answers.accent}
                    onChange={(e) => patch({ accent: e.target.value })}
                    title={t('Custom accent color')}
                    className="h-8 w-8 cursor-pointer rounded-full border border-[#d1d5db] bg-white p-0.5"
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#111827]">{t('Typography')}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WIZARD_FONTS.map((f) => (
                    <Chip key={f.id} active={answers.font === f.id} onClick={() => patch({ font: f.id })}>
                      {t(f.label)}
                      <span className="block text-[11px] text-[#9ca3af]">{f.family}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {phase === 'form' && step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[#111827]">{t('Which sections?')}</h3>
                <p className="mb-3 text-xs text-[#6b7280]">
                  {t('Pre-picked for a {type} — toggle freely; order follows this list.', {
                    type: t(WIZARD_SITE_TYPES.find((siteType) => siteType.id === answers.type)?.label || '').toLocaleLowerCase(),
                  })}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WIZARD_SECTIONS.map((s) => (
                    <Chip key={s.id} active={answers.sections.includes(s.id)} onClick={() => toggleSection(s.id)}>
                      {t(s.label)}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field label={t('Anything else? (optional)')}>
                <input
                  className={inputCls}
                  value={answers.extra}
                  onChange={(e) => patch({ extra: e.target.value })}
                  placeholder={t('e.g. add a photo of Istanbul in the hero, mention weekend workshops…')}
                />
              </Field>
            </div>
          )}

          {phase === 'generating' && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#4f46e5]" aria-hidden />
              <p className="text-sm font-semibold text-[#111827]">{t(statusLine)}</p>
              <p className="max-w-sm text-xs text-[#6b7280]">
                {t('Building a complete responsive site from your answers — usually 15-40 seconds.')}
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-md text-sm font-medium text-[#b91c1c]">{t(error)}</p>
              {noProvider ? (
                <p className="max-w-md text-xs text-[#6b7280]">
                  {t('Open the AI chat (AI button in the header) → Settings, and paste any free key — or start from a ready-made template instead.')}
                </p>
              ) : (
                <p className="max-w-md text-xs text-[#6b7280]">
                  {t('This is usually a temporary quota hiccup — trying again often works.')}
                </p>
              )}
              <div className="flex gap-2">
                {!noProvider && (
                  <button type="button" onClick={generate} className="rounded-lg bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338ca]">
                    {t('Try again')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { close(); onOpenTemplates?.() }}
                  className="rounded-lg border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6]"
                >
                  {t('Browse templates')}
                </button>
                <button type="button" onClick={() => setPhase('form')} className="rounded-lg border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6]">
                  {t('Back')}
                </button>
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <div className="flex h-full min-h-[320px] flex-col gap-3">
              <iframe
                title={t('AI site preview')}
                srcDoc={withViewportMeta(html)}
                sandbox={PUBLIC_HTML_SANDBOX}
                allow={HTML_ALLOW}
                className="min-h-[320px] w-full flex-1 rounded-lg border border-[#e5e7eb] bg-white"
              />
              {error && <p className="text-xs font-medium text-[#b91c1c]">{t(error)}</p>}
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') refine() }}
                  placeholder={t('Refine it: “make the hero darker”, “add a pricing section”…')}
                  disabled={refining}
                />
                <button
                  type="button"
                  onClick={refine}
                  disabled={refining || !refineText.trim()}
                  className="shrink-0 rounded-lg border border-[#4f46e5] px-3 py-2 text-sm font-semibold text-[#4f46e5] hover:bg-[#eef2ff] disabled:opacity-50"
                >
                  {refining ? t('Refining…') : t('Refine')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'form' && (
          <div className="flex shrink-0 items-center justify-between border-t border-[#e5e7eb] px-5 py-3">
            <button
              type="button"
              onClick={() => (step === 0 ? close() : setStep(step - 1))}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
            >
              {step === 0 ? t('Cancel') : t('← Back')}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                title={canNext ? '' : t('Add a name or a short description first')}
                className="rounded-lg bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:opacity-50"
              >
                {t('Next →')}
              </button>
            ) : (
              <button
                type="button"
                onClick={generate}
                className="rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#2563eb] px-5 py-2 text-sm font-bold text-white hover:from-[#4338ca] hover:to-[#1e4079]"
              >
                {t('✨ Generate my site')}
              </button>
            )}
          </div>
        )}
        {phase === 'preview' && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#e5e7eb] px-5 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPhase('form')}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
              >
                {t('← Edit answers')}
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={refining}
                className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
              >
                {t('↻ Regenerate')}
              </button>
              {providerUsed && (
                <span className="text-[11px] text-[#9ca3af]">{t('via')} {providerUsed}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={close} disabled={refining} className="rounded-lg border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50">
                {t('Reject')}
              </button>
              <button
                type="button"
                onClick={() => onApply?.({ html, ...wizardMeta(answers) })}
                disabled={refining}
                className="rounded-lg bg-[#16a34a] px-5 py-2 text-sm font-bold text-white hover:bg-[#15803d] disabled:opacity-50"
              >
                {t('Accept and use this site')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
