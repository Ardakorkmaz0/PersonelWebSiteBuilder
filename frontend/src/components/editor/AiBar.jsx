import { useEffect, useState } from 'react'
import {
  fetchLocalStatus,
  getApiKey,
  getModel,
  getProvider,
  pickBestLocalModel,
  setModel,
} from '../../utils/aiAssistant.js'
import AiChatPanel from './AiChatPanel.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

// Compact toolbar button that opens the AI chat panel.
// Replaces the earlier single-line prompt input — the chat panel itself
// holds the input, history, and per-turn tool calls.
export default function AiBar({ currentHtml = '', onApplyHtml }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [hasKey, setHasKey] = useState(() => !!getApiKey())

  // Re-check the saved key whenever the window is focused — covers the user
  // pasting it in the Settings panel and coming back here.
  useEffect(() => {
    const refresh = () => setHasKey(!!getApiKey())
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  // On app boot, if the user is on the local provider, validate the saved
  // model against whatever Ollama actually has installed and upgrade if a
  // stronger tool-calling model is available. The Settings panel does the
  // same dance, but it only runs after the user opens that section — too late
  // to stop them from sending a chat with a stale default model.
  useEffect(() => {
    if (getProvider() !== 'local') return undefined
    let cancelled = false
    fetchLocalStatus().then((s) => {
      if (cancelled || !s?.ok || !Array.isArray(s.models) || !s.models.length) return
      const saved = getModel('local')
      const best = pickBestLocalModel(s.models, saved)
      if (best && best !== saved) {
        setModel(best, 'local')
        // Notify other listeners (the chat panel uses storage events to
        // refresh the header badge) that the model changed.
        try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
      }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hasKey ? t('Open AI assistant') : t('Set an AI provider key first')}
        className={`studio-btn h-8 shrink-0 ${
          open
            ? 'studio-btn-primary'
            : 'studio-btn-accent'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
        <span className="hidden lg:inline">AI</span>
        {!hasKey && <span className="ml-0.5 rounded bg-white/20 px-1 text-[9px]">{t('setup')}</span>}
      </button>
      <AiChatPanel
        open={open}
        onClose={() => setOpen(false)}
        currentHtml={currentHtml}
        onApplyHtml={onApplyHtml}
      />
    </>
  )
}
