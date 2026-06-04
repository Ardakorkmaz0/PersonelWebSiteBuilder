import { useEffect, useState } from 'react'
import { getApiKey } from '../../utils/aiAssistant.js'
import AiChatPanel from './AiChatPanel.jsx'

// Compact toolbar button that opens the AI chat panel.
// Replaces the earlier single-line prompt input — the chat panel itself
// holds the input, history, and per-turn tool calls.
export default function AiBar() {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hasKey ? 'Open AI assistant' : 'Set a Gemini API key first'}
        className={`flex h-9 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-semibold shadow-sm transition ${
          open
            ? 'bg-[#1e4079] text-white'
            : 'bg-gradient-to-br from-[#4f46e5] to-[#2563eb] text-white hover:from-[#4338ca] hover:to-[#1e4079]'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
        <span>AI</span>
        {!hasKey && <span className="ml-0.5 rounded bg-white/20 px-1 text-[9px]">setup</span>}
      </button>
      <AiChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
