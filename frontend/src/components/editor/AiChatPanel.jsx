import { useEffect, useRef, useState } from 'react'
import {
  AI_PROVIDERS,
  SUGGESTION_CHIPS,
  executeTool,
  getApiKey,
  getModel,
  getModelsFor,
  getProvider,
  recoverIntentFromPrompt,
  runAiHtmlPrompt,
  runAiPrompt,
  setProvider,
} from '../../utils/aiAssistant.js'
import { useEditorStore } from '../../store/editorStore.js'

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
export default function AiChatPanel({ open, onClose, currentHtml = '', onApplyHtml }) {
  const [messages, setMessages] = useState(() => readHistory())
  const lastSendAt = useRef(0)
  const THROTTLE_MS = 2500
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scrollerRef = useRef(null)
  const textareaRef = useRef(null)
  // 'components' uses the schema tool calls; 'html' asks the model for a full
  // HTML document and ships it to site.html. The HTML path is what the user
  // actually wants for "make me a youtube site" with weak local models —
  // those write HTML reliably even though they can't tool-call.
  const [aiMode, setAiMode] = useState(() => {
    try { return localStorage.getItem('pwb_ai_mode') === 'html' ? 'html' : 'components' }
    catch { return 'components' }
  })
  useEffect(() => {
    try { localStorage.setItem('pwb_ai_mode', aiMode) } catch { /* ignore */ }
  }, [aiMode])

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

  // Local slash-command dispatcher — handled before runAiPrompt so power
  // users can clear chat, undo the last AI change, or hop providers
  // without burning a model call. Returns true when a command was handled.
  function handleSlashCommand(raw) {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('/')) return false
    const [head, ...rest] = trimmed.slice(1).split(/\s+/)
    const cmd = head.toLowerCase()
    const arg = rest.join(' ').trim()
    if (cmd === 'help' || cmd === '?') {
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: trimmed },
        { id: rand(), role: 'assistant', text:
          'Slash commands:\n'
          + '/fresh — start a new conversation (keeps scrollback, resets AI memory)\n'
          + '/clear — wipe this chat\n'
          + '/undo — undo the last canvas change\n'
          + '/redo — redo the last undo\n'
          + '/provider <openrouter|groq|local|gemini> — switch AI provider\n'
          + '/template <github|dark|apple|minimal-landing|portfolio|blog|dashboard|marketing> — apply preset\n'
          + '/help — show this list',
        },
      ])
      return true
    }
    if (cmd === 'clear') {
      clearChat()
      return true
    }
    if (cmd === 'fresh' || cmd === 'new') {
      freshChat()
      return true
    }
    if (cmd === 'undo') {
      try { useEditorStore.getState().undo() } catch { /* no-op if nothing to undo */ }
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: trimmed },
        { id: rand(), role: 'assistant', text: 'Undone — the previous canvas state is back.' },
      ])
      return true
    }
    if (cmd === 'redo') {
      try { useEditorStore.getState().redo() } catch { /* no-op */ }
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: trimmed },
        { id: rand(), role: 'assistant', text: 'Redone.' },
      ])
      return true
    }
    if (cmd === 'provider') {
      const next = arg.toLowerCase()
      const valid = AI_PROVIDERS.some((p) => p.id === next)
      if (!valid) {
        setError(`Unknown provider "${arg}". Use one of: ${AI_PROVIDERS.map((p) => p.id).join(', ')}`)
        return true
      }
      setProvider(next)
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: trimmed },
        { id: rand(), role: 'assistant', text: `Active provider switched to ${next}.` },
      ])
      return true
    }
    if (cmd === 'template') {
      // Tee up an applyTemplate prompt for the model — it still goes through
      // the standard runAiPrompt path so the post-template customisation +
      // failover all still kick in. We just shape the request.
      const wanted = arg || 'portfolio'
      const prompt = `Apply the "${wanted}" template, then customise every default placeholder so the result reflects a generic example for that style.`
      setDraft(prompt)
      // Don't auto-send — give the user a chance to edit the topic in first.
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'assistant', text: `Drafted: ${prompt}\nTap Send to run it (or edit it first).` },
      ])
      return true
    }
    setError(`Unknown command /${cmd}. Try /help.`)
    return true
  }

  // Insert a "Fresh chat" divider — the user keeps their visible scrollback
  // but every prompt after this line builds history only from the divider
  // forward. The big win is on weaker models (gemma4, Llama 3.1 8B) that get
  // confused when an older topic ("github site") and a newer one ("dark
  // mode blog") blur together in the same context window.
  function freshChat() {
    setMessages((m) => [...m, { id: rand(), role: 'divider', label: 'New conversation starting here' }])
    setError('')
  }

  async function send(textOverride) {
    const raw = (textOverride ?? draft).trim()
    if (!raw || busy) return
    if (handleSlashCommand(raw)) {
      // For commands that already wrote to the chat, just clear the composer.
      // /template fills draft for the user, so don't wipe it in that case.
      if (!raw.startsWith('/template')) setDraft('')
      return
    }
    const trimmed = raw
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
      // ----- HTML mode: ask the model for a full HTML document --------------
      if (aiMode === 'html') {
        if (!onApplyHtml) {
          setError('HTML mode is not wired into this editor session.')
          return
        }
        const lastDivider = messages.findLastIndex((m) => m.role === 'divider')
        const since = lastDivider >= 0 ? messages.slice(lastDivider + 1) : messages
        const history = [...since, userMsg]
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text || '' }))
          .slice(0, -1)
        const { html: generated } = await runAiHtmlPrompt(trimmed, { history, currentHtml })
        if (!generated || !/<html[\s>]/i.test(generated)) {
          setMessages((m) => [
            ...m,
            { id: rand(), role: 'assistant', text:
              "The model didn't return a usable HTML document. Try rephrasing (e.g. \"build me a single-page personal portfolio site\") or switch to Components mode.",
              allFailed: true,
            },
          ])
          return
        }
        onApplyHtml(generated)
        setMessages((m) => [
          ...m,
          { id: rand(), role: 'assistant', text:
            `Generated ~${Math.round(generated.length / 1024)} KB of HTML and loaded it into the editor. Iterate by saying things like "make the header sticky" or "use Inter font" — I'll rewrite the document.`,
          },
        ])
        return
      }
      // ----- Components mode (default tool-calling path) --------------------
      // Pass prior text-only turns so the model has conversation context —
      // but only AFTER the most recent "Fresh chat" divider so older topics
      // can't bleed into the current request.
      const lastDivider = messages.findLastIndex((m) => m.role === 'divider')
      const since = lastDivider >= 0 ? messages.slice(lastDivider + 1) : messages
      const history = [...since, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text || '' }))
        // Drop the just-added user turn since runAiPrompt re-adds it with the
        // schema snapshot.
        .slice(0, -1)
      const { text, toolCallCount, calls } = await runAiPrompt(trimmed, { history })
      const callsArr = calls || []
      const allFailed = callsArr.length > 0 && callsArr.every((c) => c?.result?.ok === false)
      // Last-ditch rescue: the model produced zero usable tool calls (gemma4
      // and other non-tool-tuned models invent fake names like
      // "google:search" or just print prose). Read the user's prompt and
      // apply the most plausible intent directly via the store — bypassing
      // the model entirely. Better than handing the user a wall of red
      // failures with no path forward.
      const needsRescue = callsArr.length === 0 || allFailed
      let rescued = null
      if (needsRescue) {
        const intent = recoverIntentFromPrompt(trimmed)
        if (intent) {
          let result
          try { result = executeTool(intent.name, intent.args) }
          catch (e) { result = { ok: false, error: String(e?.message || e) } }
          if (result?.ok) {
            rescued = {
              call: { name: intent.name, args: intent.args, result },
              reason: intent.reason,
            }
          }
        }
      }
      if (callsArr.length > 0 && !rescued) {
        const summary = allFailed ? buildFailureSummary(callsArr) : text
        setMessages((m) => [
          ...m,
          { id: rand(), role: 'tools', calls: callsArr },
          { id: rand(), role: 'assistant', text: summary, allFailed },
        ])
      } else if (rescued) {
        // Rescue won — show the recovered call + a friendly note explaining
        // the bypass so the user understands why their model didn't drive it.
        const original = callsArr.length > 0 ? callsArr : []
        setMessages((m) => [
          ...m,
          ...(original.length ? [{ id: rand(), role: 'tools', calls: original }] : []),
          { id: rand(), role: 'tools', calls: [rescued.call] },
          { id: rand(), role: 'assistant', text:
            `${rescued.reason} Your model didn't emit a usable tool call, so I read your prompt and ran the action directly. `
            + (getProvider() === 'local'
              ? 'Tip: switch to a tool-tuned model (qwen2.5 or llama3.1) for better results — Settings → Model.'
              : ''),
          },
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
        <span className="text-xs font-bold uppercase tracking-wide opacity-90">AI</span>
        <span
          className="truncate rounded-full bg-white/20 px-2 py-0.5 text-[10px]"
          title={`Active model: ${modelLabel}`}
        >
          {modelLabel}
        </span>
        {/* Mode toggle — Components uses the schema tool calls; HTML asks the
            model for a full document and ships it to site.html (the strong
            path on weak local models that can't tool-call). */}
        <div className="ml-1 flex overflow-hidden rounded-full bg-white/15 text-[10px] font-medium">
          <button
            type="button"
            onClick={() => setAiMode('components')}
            title="Use the schema tools — best on Qwen3 / Gemini / Groq Llama 70B"
            className={`px-2 py-0.5 transition ${aiMode === 'components' ? 'bg-white text-[#2563eb]' : 'hover:bg-white/10'}`}
          >
            🧱 Components
          </button>
          <button
            type="button"
            onClick={() => setAiMode('html')}
            title="Ask the model for a full HTML document — best on Llama 3.1 8B / gemma / phi"
            className={`px-2 py-0.5 transition ${aiMode === 'html' ? 'bg-white text-[#2563eb]' : 'hover:bg-white/10'}`}
          >
            📄 HTML
          </button>
        </div>
        <button
          type="button"
          onClick={freshChat}
          disabled={messages.length === 0 || messages[messages.length - 1]?.role === 'divider'}
          title="Start a new conversation — AI forgets older topics, your scrollback stays"
          className="ml-auto rounded px-2 py-0.5 text-[11px] hover:bg-white/15 disabled:opacity-40"
        >
          New
        </button>
        <button
          type="button"
          onClick={clearChat}
          disabled={messages.length === 0}
          title="Clear chat history entirely"
          className="rounded px-2 py-0.5 text-[11px] hover:bg-white/15 disabled:opacity-40"
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
      {/* Weak-model heads-up: gemma / phi base models weren't tuned for
          tool calling and routinely invent fake function names. Save the
          user a confused round-trip by suggesting a stronger swap up front. */}
      {hasKey && /\b(?:gemma|phi)\b/i.test(modelLabel) && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Heads-up:</span> {modelLabel} wasn't trained for tool calling and often invents fake tool names. For the editor's chat, switch to <code className="rounded bg-amber-100 px-1">qwen2.5</code> or <code className="rounded bg-amber-100 px-1">llama3.1</code> via Settings → Model. I'll try to rescue intent from your prompt either way.
        </div>
      )}

      {/* Message list */}
      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto bg-[#faf9f8] p-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="rounded-md border border-dashed border-[#c8c6c4] bg-white p-3 text-xs leading-relaxed text-[#605e5c]">
              <p className="mb-2 font-semibold text-[#323130]">Try a starter:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => send(chip.prompt)}
                    disabled={!hasKey || busy}
                    title={chip.prompt}
                    className="rounded-full border border-[#c5d4ef] bg-[#eff3fb] px-2.5 py-1 text-[11px] font-medium text-[#2b579a] hover:bg-[#dde7f7] disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[#a19f9d]">
                Or type a free-form request. Type <code className="rounded bg-[#f3f2f1] px-1">/help</code> for slash commands.
              </p>
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} />
          ) : m.role === 'tools' ? (
            <ToolsStrip key={m.id} calls={m.calls} />
          ) : m.role === 'divider' ? (
            <DividerRow key={m.id} label={m.label} />
          ) : (
            <AssistantBubble
              key={m.id}
              text={m.text}
              toolCallCount={m.toolCallCount}
              allFailed={m.allFailed}
            />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-[#605e5c]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#2563eb]" />
            <span>
              {messages[messages.length - 1]?.role === 'user'
                ? `Thinking with ${modelLabel}…`
                : 'Applying changes to the canvas…'}
            </span>
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

// Subtle horizontal rule with a centred label. Marks where the AI's memory
// is intentionally reset — everything above is reference scrollback the
// model will NOT see in the next prompt.
function DividerRow({ label }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-[#a19f9d]">
      <span className="h-px flex-1 bg-[#e1dfdd]" />
      <span>{label || 'New conversation'}</span>
      <span className="h-px flex-1 bg-[#e1dfdd]" />
    </div>
  )
}

// Dedupe + cap the per-call error reasons into a one-paragraph message the
// user can act on. Beats showing the model's hallucinated "Updated the X"
// reply when none of the changes actually landed.
function buildFailureSummary(calls) {
  const reasons = new Set()
  for (const c of calls || []) {
    const e = c?.result?.error
    if (e) reasons.add(`${c.name}: ${e}`)
  }
  const list = Array.from(reasons).slice(0, 4).join('\n• ')
  return (
    `I tried ${calls.length} action${calls.length === 1 ? '' : 's'} but none of them landed. `
    + `Common causes: the canvas was empty before I started, or I used component IDs that don’t exist yet.\n\n`
    + `Errors:\n• ${list}\n\nTry rephrasing the request, or hit /undo if anything DID slip through.`
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

function AssistantBubble({ text, toolCallCount, allFailed }) {
  // Failure-aware tinting: red border + light pink background so a wall of
  // ✗ pills above this bubble can't be mistaken for a successful change.
  const bubbleCls = allFailed
    ? 'max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-tl-[2px] border border-red-200 bg-red-50 px-3 py-2 text-sm leading-snug text-red-900 shadow-sm'
    : 'max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-tl-[2px] border border-[#e1dfdd] bg-white px-3 py-2 text-sm leading-snug text-[#201f1e] shadow-sm'
  return (
    <div className="flex flex-col items-start gap-1">
      <div className={bubbleCls}>
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
