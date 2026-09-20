import { useState } from 'react'
import { aiEditComponent } from '../../utils/aiAssistant.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { SparklesIcon } from '../icons.jsx'

// ✨ Ask-AI affordance for the SELECTED component. Type a prompt ("make it a
// rounded red CTA", "rewrite this punchier") and the AI returns a patch that's
// applied to THIS element only — styles + props — via onApply. Reuses the
// editor's configured AI provider (BYOK), so it needs a key set on the AI
// button. Undoable like any edit (onApply goes through the store).
//
// It is part of the properties panel, so it is built from the same tokens the
// rest of the panel uses: it used to be a pale lavender card with white fields
// hard-coded, which sat on the dark theme like a sticker.
const SUGGESTIONS = ['Make it pop', 'Rewrite punchier', 'Rounded & bold', 'Softer / minimal']

export default function AiComponentEdit({ component, onApply }) {
  const { t } = useLanguage()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(null)

  const ask = async (text) => {
    const instruction = (text ?? prompt).trim()
    if (!instruction || busy) return
    setBusy(true)
    setError('')
    setDone(false)
    try {
      const { styles, props } = await aiEditComponent(component, instruction)
      if (!Object.keys(styles).length && !Object.keys(props).length) {
        setError(t('The AI returned no change. Try rephrasing.'))
      } else {
        setPending({ styles, props })
      }
    } catch (e) {
      setError(e?.message ? t(e.message) : t('AI request failed.'))
    } finally {
      setBusy(false)
    }
  }

  const accept = () => {
    if (!pending) return
    onApply(pending.styles, pending.props)
    setPending(null)
    setDone(true)
    setPrompt('')
    setTimeout(() => setDone(false), 1500)
  }

  const changeCount = pending
    ? Object.keys(pending.styles).length + Object.keys(pending.props).length
    : 0

  return (
    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--studio-accent-soft)] text-[var(--studio-accent-text)]"
        >
          <SparklesIcon size={13} />
        </span>
        <span className="min-w-0 text-[11px] font-semibold text-[var(--studio-text)]">
          {t('Ask AI to edit this')}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
          disabled={busy}
          aria-label={t('Ask AI to edit this')}
          placeholder={t('e.g. make it a rounded red CTA')}
          className="studio-input min-w-0 flex-1 px-2.5 py-1.5 text-xs disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={busy || !prompt.trim()}
          className="studio-btn studio-btn-primary shrink-0 px-3 py-1.5 text-xs"
        >
          {busy ? t('Thinking…') : t('Go')}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => ask(s)}
            className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-control)] px-2 py-0.5 text-[10px] font-medium text-[var(--studio-text-muted)] transition hover:border-[color-mix(in_srgb,var(--studio-accent)_40%,var(--studio-border))] hover:text-[var(--studio-text)] disabled:opacity-50"
          >
            {t(s)}
          </button>
        ))}
      </div>

      {pending && (
        <div className="mt-2.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2" role="status">
          <p className="text-[11px] font-semibold text-[var(--studio-text)]">{t('Review AI change')}</p>
          <p className="mt-0.5 text-[10px] text-[var(--studio-text-muted)]">
            {t('{count} fields are ready to apply.', { count: changeCount })}
          </p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => setPending(null)} className="studio-btn studio-btn-secondary flex-1 px-2 py-1 text-[11px]">
              {t('Reject')}
            </button>
            <button type="button" onClick={accept} className="studio-btn studio-btn-primary flex-1 px-2 py-1 text-[11px]">
              {t('Accept')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="studio-status-danger mt-2 rounded-lg border px-2 py-1.5 text-[11px]">{error}</p>
      )}
      {done && (
        <p role="status" className="studio-status-success mt-2 rounded-lg border px-2 py-1.5 text-[11px] font-medium">
          {t('Applied ✓ (Ctrl+Z to undo)')}
        </p>
      )}
    </div>
  )
}
