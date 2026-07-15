import { useState } from 'react'
import { aiEditComponent } from '../../utils/aiAssistant.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// ✨ Ask-AI affordance for the SELECTED component. Type a prompt ("make it a
// rounded red CTA", "rewrite this punchier") and the AI returns a patch that's
// applied to THIS element only — styles + props — via onApply. Reuses the
// editor's configured AI provider (BYOK), so it needs a key set on the AI
// button. Undoable like any edit (onApply goes through the store).
const SUGGESTIONS = ['Make it pop', 'Rewrite punchier', 'Rounded & bold', 'Softer / minimal']

function Sparkle({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2z" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

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

  return (
    <div className="mb-3 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#4f46e5]">
        <Sparkle /> {t('Ask AI to edit this')}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
          disabled={busy}
          placeholder={t('e.g. make it a rounded red CTA')}
          className="min-w-0 flex-1 rounded-lg border border-[#c7d2fe] bg-white px-2.5 py-1.5 text-xs text-[#111827] outline-none focus:border-[#4f46e5] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={busy || !prompt.trim()}
          className="shrink-0 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4338ca] disabled:opacity-50"
        >
          {busy ? '…' : t('Go')}
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => ask(s)}
            className="rounded-full border border-[#c7d2fe] bg-white px-2 py-0.5 text-[10px] font-medium text-[#4f46e5] hover:bg-[#f5f5ff] disabled:opacity-50"
          >
            {t(s)}
          </button>
        ))}
      </div>
      {pending && (
        <div className="mt-2 rounded-lg border border-[#a5b4fc] bg-white p-2" role="status">
          <p className="text-[11px] font-semibold text-[#3730a3]">{t('Review AI change')}</p>
          <p className="mt-0.5 text-[10px] text-[#6b7280]">
            {t('{count} fields are ready to apply.', {
              count: Object.keys(pending.styles).length + Object.keys(pending.props).length,
            })}
          </p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => setPending(null)} className="flex-1 rounded-lg border border-[#d1d5db] px-2 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f3f4f6]">
              {t('Reject')}
            </button>
            <button type="button" onClick={accept} className="flex-1 rounded-lg bg-[#4f46e5] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#4338ca]">
              {t('Accept')}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
      {done && <p className="mt-1.5 text-[11px] font-medium text-[#15803d]">{t('Applied ✓ (Ctrl+Z to undo)')}</p>}
    </div>
  )
}
