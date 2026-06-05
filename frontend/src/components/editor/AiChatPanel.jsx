import { useEffect, useRef, useState } from 'react'
import {
  AI_PROVIDERS,
  getApiKey,
  getModel,
  getModelsFor,
  getProvider,
  runAiPrompt,
} from '../../utils/aiAssistant.js'

// Per-tab chat history persistence. Kept in localStorage so a refresh while
// iterating with the assistant doesn't lose the back-and-forth — handy when
// the user explores multiple variations of the same design.
const HISTORY_KEY = 'pwb_ai_chat_history'
const HISTORY_LIMIT = 60 // hard cap to avoid storage bloat

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(-HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

function writeHistory(messages) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-HISTORY_LIMIT)))
  } catch {
    /* localStorage full or disabled */
  }
}

// Floating chat window for the AI assistant. Toggled from the toolbar via
// AiBar; positioned fixed in the top-right of the viewport, ~480px wide,
// resizable in height up to the viewport. Holds its own conversation state
// in memory so the user can iterate over multiple turns without re-typing
// context.
//
// Each turn is rendered as either a user bubble (right-aligned), an assistant
// reply (left-aligned), or a tool-calls strip (rendered between the user turn
// and the assistant reply). The store still records every tool call, so
// Ctrl+Z walks the canvas back exactly like a manual edit would.
export default function AiChatPanel({ open, onClose }) {
  const [messages, setMessages] = useState(() => readHistory())
  const lastSendAt = useRef(0)
  const THROTTLE_MS = 2500
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scrollerRef = useRef(null)
  const textareaRef = useRef(null)

  // The header rebuilds whenever a storage event fires so that if the toolbar
  // (AiBar) auto-corrected the model on boot, the badge here updates too.
  const [, setRefreshTick] = useState(0)
  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1)
    window.addEventListener('storage', bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener('storage', bump)
      window.removeEventListener('focus', bump)
    }
  }, [])
  const provider = getProvider()
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const hasKey =
    providerInfo?.needsKey === false ? true : !!getApiKey(provider)
  const modelLabel =
    getModelsFor(provider)
      .find((m) => m.id === getModel(provider))
      ?.label.replace(' (recommended)', '') ||
    getModel(provider) ||
    providerInfo?.label ||
    'AI'

  // Auto-scroll to bottom on new message.
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  // Persist every change so reloading the editor keeps the conversation.
  useEffect(() => {
    writeHistory(messages)
  }, [messages])

  // Auto-grow the textarea up to 8 rows.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const max = parseInt(getComputedStyle(ta).lineHeight, 10) * 8 + 16
    ta.style.height = `${Math.min(ta.scrollHeight, max)}px`
  }, [draft])

  // Focus the textarea each time the panel opens.
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 30)
    }
  }, [open])

  async function send() {
    const trimmed = draft.trim()
    if (!trimmed || busy) return
    // Soft throttle: rapid back-to-back sends burn through the Gemini
    // per-minute quota fast. Hold the user back a couple of seconds and
    // surface a hint instead of silently failing.
    const sinceLast = Date.now() - lastSendAt.current
    if (sinceLast < THROTTLE_MS) {
      const waitSec = Math.ceil((THROTTLE_MS - sinceLast) / 1000)
      setError(`Slow down — wait ${waitSec}s between AI prompts to stay under the free quota.`)
      return
    }
    lastSendAt.current = Date.now()
    setError('')
    const userMsg = { id: rand(), role: 'user', text: trimmed }
    setMessages((m) => [...m, userMsg])
    setDraft('')
    setBusy(true)
    try {
      // Pass prior text-only turns so the model has conversation context.
      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text || '' }))
        // Drop the just-added user turn since runAiPrompt re-adds it with the
        // schema snapshot.
        .slice(0, -1)
      const { text, toolCallCount, calls } = await runAiPrompt(trimmed, { history })
      if ((calls || []).length > 0) {
        setMessages((m) => [
          ...m,
          { id: rand(), role: 'tools', calls },
          { id: rand(), role: 'assistant', text },
        ])
      } else {
        setMessages((m) => [
          ...m,
          { id: rand(), role: 'assistant', text: text || 'Done.', toolCallCount },
        ])
      }
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function clearChat() {
    setMessages([])
    setError('')
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
  }

  if (!open) return null

  return (
    <div
      className="fixed right-4 top-20 z-[120] flex h-[min(70vh,640px)] w-[min(92vw,460px)] flex-col overflow-hidden rounded-[6px] border border-[#c8c6c4] bg-white shadow-2xl"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#e1dfdd] bg-gradient-to-r from-[#4f46e5] to-[#2563eb] px-3 py-2 text-white">
        <span className="text-xs font-bold uppercase tracking-wide opacity-90">AI Assistant</span>
        <span
          className="ml-1 truncate rounded-full bg-white/20 px-2 py-0.5 text-[10px]"
          title={`Active model: ${modelLabel}`}
        >
          {modelLabel}
        </span>
        <button
          type="button"
          onClick={clearChat}
          disabled={messages.length === 0}
          title="Clear chat history"
          className="ml-auto rounded px-2 py-0.5 text-[11px] hover:bg-white/15 disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close AI panel"
          className="rounded px-2 py-0.5 text-base hover:bg-white/15"
        >
          ×
        </button>
      </div>

      {/* Empty state / no API key */}
      {!hasKey && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Paste a free key for {providerInfo?.label || 'this provider'} (or any other provider) in the right panel — Properties → AI Assistant. Set up more than one and the chat auto-switches when one hits its quota.
        </div>
      )}

      {/* Message list */}
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto bg-[#faf9f8] p-3">
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed border-[#c8c6c4] bg-white p-3 text-xs leading-relaxed text-[#605e5c]">
            <p className="mb-1 font-semibold text-[#323130]">Try one of these:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Add a navbar at top with Home, About, Contact links.</li>
              <li>Create a hero section with a heading and a blue CTA button.</li>
              <li>Make the site theme primary color blue.</li>
              <li>Add Custom JS that logs &quot;hello&quot; on load.</li>
            </ul>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} />
          ) : m.role === 'tools' ? (
            <ToolsStrip key={m.id} calls={m.calls} />
          ) : (
            <AssistantBubble key={m.id} text={m.text} toolCallCount={m.toolCallCount} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-[#605e5c]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2563eb]" />
            <span>Thinking…</span>
          </div>
        )}
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#e1dfdd] bg-white p-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          name="builder-ai-message"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          enterKeyHint="send"
          rows={2}
          disabled={!hasKey || busy}
          placeholder={
            hasKey
              ? 'Tell AI what to build (Enter to send, Shift+Enter for newline)…'
              : 'Set an API key in the right panel first.'
          }
          className="block w-full resize-none rounded-[4px] border border-[#8a8886] bg-white px-2 py-1.5 text-sm text-[#201f1e] placeholder:text-[#a19f9d] focus:border-[#2b579a] focus:outline-none disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-[#605e5c]">
          <span>Press Ctrl+Z to undo any change the AI made.</span>
          <button
            type="button"
            onClick={send}
            disabled={!hasKey || busy || !draft.trim()}
            className="rounded-[4px] bg-[#2b579a] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1e4079] disabled:cursor-not-allowed disabled:bg-[#a19f9d]"
          >
            {busy ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-tr-[2px] bg-[#2563eb] px-3 py-2 text-sm leading-snug text-white shadow-sm">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ text, toolCallCount }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-tl-[2px] border border-[#e1dfdd] bg-white px-3 py-2 text-sm leading-snug text-[#201f1e] shadow-sm">
        {text || 'Done.'}
      </div>
      {toolCallCount === 0 && (
        <span className="text-[10px] italic text-[#a4262c]">
          No tools called — the canvas was not changed.
        </span>
      )}
    </div>
  )
}

function ToolsStrip({ calls }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex max-w-full flex-wrap gap-1">
        {(calls || []).map((c, i) => {
          // Tool calls that returned ok:false (stale IDs, validation errors,
          // etc.) get painted red with a strike so the user can tell at a
          // glance that the AI's claim of "done" didn't fully land. Tooltip
          // surfaces the error reason on hover.
          const failed = c.result && c.result.ok === false
          const tooltip = failed
            ? `Failed: ${c.result?.error || 'unknown'}\n\nArgs:\n${JSON.stringify(c.args, null, 2)}`
            : JSON.stringify(c.args, null, 2)
          const cls = failed
            ? 'rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 line-through decoration-red-400'
            : 'rounded-full border border-[#c5d4ef] bg-[#eff3fb] px-2 py-0.5 text-[10px] font-medium text-[#2b579a]'
          return (
            <span key={i} title={tooltip} className={cls}>
              {c.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function rand() {
  return Math.random().toString(36).slice(2, 10)
}
