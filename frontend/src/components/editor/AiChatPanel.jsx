import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AI_PROVIDERS,
  SUGGESTION_CHIPS,
  coerceToHtmlDocument,
  contentPreservationRatio,
  detectHtmlIntent,
  executeTool,
  getApiKey,
  getModel,
  getModelsFor,
  getProvider,
  recoverIntentFromPrompt,
  repairDroppedSections,
  runAiHtmlPrompt,
  runAiPrompt,
  setProvider,
} from '../../utils/aiAssistant.js'
import { THEME_SWATCHES, applyPaletteToHtml } from '../../utils/htmlTheme.js'

// Quick-action option lists (HTML mode). Fonts go through the AI with a
// strict "typography only" instruction; sections use the ADD contract.
const QUICK_FONTS = [
  'Inter', 'Poppins', 'Playfair Display', 'Space Grotesk',
  'DM Sans', 'Montserrat', 'Lora', 'JetBrains Mono',
]
const QUICK_SECTIONS = [
  ['Pricing', 'Add a 3-tier pricing section (middle tier highlighted as "Most popular") that matches the current design.'],
  ['FAQ', 'Add an FAQ section with 4 relevant questions using details/summary elements, matching the current design.'],
  ['Gallery', 'Add a responsive gallery section with gradient placeholder tiles, matching the current design.'],
  ['Testimonials', 'Add a testimonials section with 3 quote cards, matching the current design.'],
  ['Stats', 'Add a row of 4 key statistics relevant to this site, matching the current design.'],
  ['Team', 'Add a team section with 4 member cards using initial avatars, matching the current design.'],
  ['Newsletter', 'Add a newsletter signup section with an email call-to-action, matching the current design.'],
  ['Contact', 'Add a contact section with an email call-to-action card, matching the current design.'],
]
import { useEditorStore } from '../../store/editorStore.js'
import { buildAiSuggestions, readSuggestionContext } from '../../utils/aiSuggestions.js'
import AiSettings from './AiSettings.jsx'
import { LayersIcon, FileCodeIcon, PaletteIcon, PlusIcon, CogIcon, LightbulbIcon, SparklesIcon } from '../icons.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'

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

// Throttle gate for sends. Returns 0 when allowed (and stamps the ref), or
// the number of seconds left to wait. Module-level helper so the clock read
// stays out of the component body (event handlers only).
function throttleGate(lastSentRef, ms) {
  const now = Date.now()
  const since = now - lastSentRef.current
  if (since < ms) return Math.ceil((ms - since) / 1000)
  lastSentRef.current = now
  return 0
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function captureEditorPreviewState() {
  const state = useEditorStore.getState()
  return {
    schema: cloneJson(state.schema),
    currentPageId: state.currentPageId,
    selectedId: state.selectedId,
    selectedIds: [...state.selectedIds],
    dirty: state.dirty,
    past: state.past,
    future: state.future,
    linkMode: state.linkMode,
    linkSourceId: state.linkSourceId,
  }
}

function restoreEditorPreviewState(snapshot) {
  useEditorStore.setState({
    schema: snapshot.schema,
    currentPageId: snapshot.currentPageId,
    selectedId: snapshot.selectedId,
    selectedIds: snapshot.selectedIds,
    dirty: snapshot.dirty,
    past: snapshot.past,
    future: snapshot.future,
    linkMode: snapshot.linkMode,
    linkSourceId: snapshot.linkSourceId,
  })
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
export default function AiChatPanel({
  open,
  onClose,
  currentHtml = '',
  onApplyHtml,
  presentation = 'compact',
  onPresentationChange,
}) {
  const { t } = useLanguage()
  const [messages, setMessages] = useState(() => readHistory())
  const lastSendAt = useRef(0)
  const THROTTLE_MS = 2500
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scrollerRef = useRef(null)
  const textareaRef = useRef(null)
  // Provider/key/model live behind this toggle instead of in another panel:
  // the moment you notice the key is missing is the moment you are looking
  // at the chat, so that is where the fix belongs.
  const [showSettings, setShowSettings] = useState(false)
  // Suggestion ids the user already acted on. Re-offering "add a navbar" to
  // someone who just asked for a navbar is what makes suggestions feel canned.
  const [usedSuggestions, setUsedSuggestions] = useState([])
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
  // An HTML site doesn't render the canvas schema at all, so Components mode
  // would "succeed" while changing nothing the user can see — the #1 cause of
  // "the AI did nothing". Force the HTML path whenever the site is HTML.
  const isHtmlSite = !!(currentHtml && currentHtml.trim())
  const effectiveAiMode = isHtmlSite ? 'html' : aiMode
  // Quick actions: structured pickers (color swatches, fonts, sections) so
  // common asks don't require typing — and colors apply deterministically.
  const [quickPanel, setQuickPanel] = useState(null) // 'colors' | 'font' | 'section'
  const [pickedColors, setPickedColors] = useState([])
  const [pendingChange, setPendingChange] = useState(null)

  function applyQuickColors() {
    if (!pickedColors.length || busy) return
    const picked = [...pickedColors]
    const label = picked.join(' + ')
    setPickedColors([])
    setQuickPanel(null)
    const logApplied = (how) =>
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: t('Theme colors → {colors}', { colors: label }) },
        { id: rand(), role: 'assistant', text: how },
      ])
    // Component sites: colors live in the schema theme — set it directly.
    if (!isHtmlSite) {
      executeTool('updateTheme', { patch: { primaryColor: picked[0] } })
      logApplied(t('Updated the design theme primary color — instant, no AI call. Undo (Ctrl+Z) brings the old color back.'))
      return
    }
    // HTML sites, deterministic path: swap CSS color variables, or recolor
    // the dominant brand colors when the page has no variables. AI is only
    // the last resort.
    const det = currentHtml ? applyPaletteToHtml(currentHtml, picked) : null
    if (det && onApplyHtml) {
      onApplyHtml(det)
      logApplied(t('Recolored the theme by updating the page colors directly — instant, no AI call, and nothing else was touched. Undo brings the old colors back.'))
      return
    }
    send(`Restyle the site to use this color palette: primary ${picked[0]}${picked[1] ? `, secondary ${picked[1]}` : ''}. Keep every piece of content exactly as it is; change only the CSS.`)
  }

  function applyQuickFont(f) {
    setQuickPanel(null)
    if (!isHtmlSite) {
      executeTool('updateTheme', { patch: { fontFamily: `'${f}', sans-serif` } })
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: t('Font → {font}', { font: f }) },
        { id: rand(), role: 'assistant', text: t('Set the design theme font to {font} — applied instantly, no AI call.', { font: f }) },
      ])
      return
    }
    send(`Use the Google Font "${f}" across the site for headings and body text. Keep all content and layout exactly the same; change only the typography.`)
  }

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

  // Cheap signature of the things the suggestion rules key off. Subscribing to
  // it (rather than reading the store imperatively during render) is what makes
  // the cards follow the canvas: drop a navbar with the panel open and the
  // "add a navbar" card goes away on the spot. Deliberately a few scalars and
  // no component scan, so this does not re-render the panel on every keystroke.
  const suggestionSignal = useEditorStore((state) => {
    const page = state.schema.pages.find((pg) => pg.id === state.currentPageId)
    return `${page?.id}|${page?.components?.length}|${state.selectedId}|${state.schema.pages.length}`
  })
  const lastMessage = messages[messages.length - 1]
  const followUpsVisible =
    !busy && !pendingChange && !showSettings && lastMessage?.role === 'assistant' && !lastMessage.allFailed
  const suggestions = useMemo(
    () => (open
      ? buildAiSuggestions(readSuggestionContext(), {
          limit: messages.length === 0 ? 4 : 3,
          exclude: usedSuggestions,
        })
      : []),
    // suggestionSignal is the subscription that makes this recompute; the
    // linter can't see through it, hence the explicit dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, suggestionSignal, messages.length, usedSuggestions],
  )

  function sendSuggestion(s) {
    // Only burn the suggestion once the request is actually going out. send()
    // refuses while it is busy or a change is awaiting review, and a card that
    // vanished on a refused click would never come back.
    if (busy || pendingChange) {
      send(s.prompt)
      return
    }
    setUsedSuggestions((ids) => (ids.includes(s.id) ? ids : [...ids, s.id]))
    send(s.prompt)
  }

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
          t('Slash commands:') + '\n'
          + `/fresh — ${t('start a new conversation (keeps scrollback, resets AI memory)')}\n`
          + `/clear — ${t('wipe this chat')}\n`
          + `/undo — ${t('undo the last canvas change')}\n`
          + `/redo — ${t('redo the last undo')}\n`
          + `/provider <openrouter|groq|local|gemini> — ${t('switch AI provider')}\n`
          + `/template <github|dark|apple|minimal-landing|portfolio|blog|dashboard|marketing> — ${t('apply preset')}\n`
          + `/help — ${t('show this list')}`,
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
        { id: rand(), role: 'assistant', text: t('Undone — the previous canvas state is back.') },
      ])
      return true
    }
    if (cmd === 'redo') {
      try { useEditorStore.getState().redo() } catch { /* no-op */ }
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: trimmed },
        { id: rand(), role: 'assistant', text: t('Redone.') },
      ])
      return true
    }
    if (cmd === 'provider') {
      const next = arg.toLowerCase()
      const valid = AI_PROVIDERS.some((p) => p.id === next)
      if (!valid) {
        setError(t('Unknown provider "{provider}". Use one of: {list}', { provider: arg, list: AI_PROVIDERS.map((p) => p.id).join(', ') }))
        return true
      }
      setProvider(next)
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
      setMessages((m) => [
        ...m,
        { id: rand(), role: 'user', text: trimmed },
        { id: rand(), role: 'assistant', text: t('Active provider switched to {provider}.', { provider: next }) },
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
        { id: rand(), role: 'assistant', text: t('Drafted: {prompt}\nTap Send to run it (or edit it first).', { prompt }) },
      ])
      return true
    }
    setError(t('Unknown command /{command}. Try /help.', { command: cmd }))
    return true
  }

  // Insert a "Fresh chat" divider — the user keeps their visible scrollback
  // but every prompt after this line builds history only from the divider
  // forward. The big win is on weaker models (gemma4, Llama 3.1 8B) that get
  // confused when an older topic ("github site") and a newer one ("dark
  // mode blog") blur together in the same context window.
  function freshChat() {
    setMessages((m) => [...m, { id: rand(), role: 'divider', label: t('New conversation starting here') }])
    setError('')
  }

  async function send(textOverride) {
    const raw = (textOverride ?? draft).trim()
    if (!raw || busy) return
    if (pendingChange) {
      setError(t('Accept or reject the current AI preview before sending another request.'))
      return
    }
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
    const waitSec = throttleGate(lastSendAt, THROTTLE_MS)
    if (waitSec > 0) {
      setError(t('Slow down — wait {seconds}s between AI prompts to stay under the free quota.', { seconds: waitSec }))
      return
    }
    setError('')
    const userMsg = { id: rand(), role: 'user', text: trimmed }
    setMessages((m) => [...m, userMsg])
    setDraft('')
    setBusy(true)
    try {
      // ----- HTML mode: ask the model for a full HTML document --------------
      if (effectiveAiMode === 'html') {
        if (!onApplyHtml) {
          setError(t('HTML mode is not wired into this editor session.'))
          return
        }
        const lastDivider = messages.findLastIndex((m) => m.role === 'divider')
        const since = lastDivider >= 0 ? messages.slice(lastDivider + 1) : messages
        const history = [...since, userMsg]
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text || '' }))
          .slice(0, -1)
        const { html: generated } = await runAiHtmlPrompt(trimmed, { history, currentHtml })
        // Weak models sometimes return a bare fragment instead of the full
        // document. coerce: graft fragments onto the current page (the apply
        // step places them at the user's viewport) or wrap them standalone.
        const doc = coerceToHtmlDocument(generated, { currentHtml })
        if (!doc) {
          setMessages((m) => [
            ...m,
            { id: rand(), role: 'assistant', text:
              t('The model did not return usable HTML. Try rephrasing — being specific about sections and style helps a lot.'),
              allFailed: true,
            },
          ])
          return
        }
        // Intent guards for edits of an existing document:
        //  - ADD: if the model dropped existing sections while "adding",
        //    salvage the new sections and graft them onto the original.
        //  - STYLE: if a "restyle" rewrote most of the copy, block it — a
        //    theme change must never cost the user their content.
        const intent = currentHtml && currentHtml.trim() ? detectHtmlIntent(trimmed) : 'general'
        let finalHtml = doc.html
        let repaired = false
        if (intent === 'add' && !doc.grafted) {
          const fix = repairDroppedSections(currentHtml, finalHtml)
          finalHtml = fix.html
          repaired = fix.repaired
        } else if (intent === 'style') {
          const kept = contentPreservationRatio(currentHtml, finalHtml)
          if (kept < 0.6) {
            setMessages((m) => [
              ...m,
              { id: rand(), role: 'assistant', text:
                t('I blocked this change: the model rewrote most of your page content (only {percent}% survived) while it was asked to restyle. Your site is untouched — try again, or use the Theme colors button below for a safe, instant recolor.', { percent: Math.round(kept * 100) }),
                allFailed: true,
              },
            ])
            return
          }
        }
        const summary = repaired
          ? t('The model tried to rewrite your page while adding — I kept your original content and grafted only the new section onto it (highlighted in the preview).')
          : doc.grafted
            ? t('The model sent back just the new part, so I added it to your current page — it should be highlighted in the preview.')
            : t('Generated ~{size} KB of HTML and prepared a preview.', { size: Math.round(finalHtml.length / 1024) })
        setPendingChange({ kind: 'html', html: finalHtml, summary })
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
      const previewBase = captureEditorPreviewState()
      let aiResult
      try {
        aiResult = await runAiPrompt(trimmed, { history })
      } catch (requestError) {
        restoreEditorPreviewState(previewBase)
        throw requestError
      }
      const { text, toolCallCount, calls } = aiResult
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
      const previewResult = captureEditorPreviewState()
      const schemaChanged = JSON.stringify(previewBase.schema) !== JSON.stringify(previewResult.schema)
      restoreEditorPreviewState(previewBase)
      if (schemaChanged) {
        const previewCalls = rescued ? [rescued.call] : callsArr
        const summary = rescued
          ? `${t(rescued.reason)} ${t('I prepared the recovered action for your review.')}`
          : text || t('Prepared {count} AI actions for review.', { count: previewCalls.length })
        setPendingChange({
          kind: 'schema',
          editor: previewResult,
          calls: previewCalls,
          summary,
        })
        return
      }
      if (callsArr.length > 0 && !rescued) {
        const summary = allFailed ? buildFailureSummary(callsArr, t) : text
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
            `${t(rescued.reason)} ${t('Your model did not emit a usable tool call, so I read your prompt and ran the action directly.')} `
            + (getProvider() === 'local'
              ? t('Tip: switch to a tool-tuned model (qwen2.5 or llama3.1) for better results — Settings → Model.')
              : ''),
          },
        ])
      } else {
        setMessages((m) => [
          ...m,
          { id: rand(), role: 'assistant', text: text || t('Done.'), toolCallCount },
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
    setPendingChange(null)
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
  }

  function acceptPendingChange() {
    if (!pendingChange) return
    if (pendingChange.kind === 'html') onApplyHtml?.(pendingChange.html)
    if (pendingChange.kind === 'schema') {
      const store = useEditorStore.getState()
      store.record('ai-preview')
      const pageId = pendingChange.editor.schema.pages.some((page) => page.id === pendingChange.editor.currentPageId)
        ? pendingChange.editor.currentPageId
        : pendingChange.editor.schema.pages[0]?.id
      useEditorStore.setState({
        schema: cloneJson(pendingChange.editor.schema),
        currentPageId: pageId,
        selectedId: null,
        selectedIds: [],
        dirty: true,
        future: [],
      })
    }
    setMessages((items) => [
      ...items,
      ...(pendingChange.calls?.length ? [{ id: rand(), role: 'tools', calls: pendingChange.calls }] : []),
      { id: rand(), role: 'assistant', text: `${pendingChange.summary} ${t('Accepted and applied.')}` },
    ])
    setPendingChange(null)
    setError('')
  }

  function rejectPendingChange() {
    if (!pendingChange) return
    setMessages((items) => [
      ...items,
      { id: rand(), role: 'assistant', text: t('Change rejected — your site was left untouched.') },
    ])
    setPendingChange(null)
    setError('')
  }

  if (!open) return null

  const workspacePresentation = presentation === 'workspace'

  return (
    <div
      role={workspacePresentation ? 'complementary' : 'dialog'}
      aria-modal={workspacePresentation ? undefined : 'true'}
      aria-label={t('AI Assistant')}
      className={workspacePresentation
        ? 'studio-theme-surface relative z-20 flex h-full w-[clamp(380px,32vw,520px)] shrink-0 flex-col overflow-hidden border-l border-[var(--studio-border)] bg-[var(--studio-panel)]'
        : 'studio-theme-surface fixed right-2 top-[60px] z-[120] flex h-[calc(100vh-68px)] max-h-[720px] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] sm:right-4 sm:top-[68px] sm:h-[calc(100vh-84px)] sm:w-[440px]'}
      style={workspacePresentation ? undefined : { boxShadow: 'var(--studio-shadow-menu)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex min-h-[60px] items-center gap-2.5 border-b border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-2.5 text-[var(--studio-text)]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-control)] text-[var(--studio-text-muted)]">
          <SparklesIcon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{t('AI design assistant')}</span>
          <span className="block truncate text-[10px] font-medium text-[var(--studio-text-muted)]">
            {modelLabel} · {effectiveAiMode === 'html' ? 'HTML' : t('Components')}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onPresentationChange?.(workspacePresentation ? 'compact' : 'workspace')}
          title={workspacePresentation ? t('Use the small floating AI window') : t('Dock AI beside the canvas')}
          className="studio-btn studio-btn-secondary h-7 shrink-0 px-2 text-[10px]"
        >
          {workspacePresentation ? t('Small window') : t('Dock')}
        </button>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          title={t('AI settings — provider, key and model')}
          aria-label={t('AI settings')}
          aria-pressed={showSettings}
          className={`studio-icon-btn h-7 w-7 shrink-0 ${showSettings ? 'bg-[var(--studio-control-hover)] text-[var(--studio-text)]' : ''}`}
        >
          <CogIcon size={13} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title={t('Close')}
          aria-label={t('Close AI panel')}
          className="studio-icon-btn h-7 w-7 shrink-0 text-base"
        >
          ×
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2">
          <div className="studio-segment min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setAiMode('components')}
              disabled={isHtmlSite}
              className={effectiveAiMode === 'components' ? 'studio-segment-btn studio-segment-btn-active flex-1' : 'studio-segment-btn flex-1'}
            >
              <LayersIcon size={11} /> {t('Components')}
            </button>
            <button
              type="button"
              onClick={() => setAiMode('html')}
              className={effectiveAiMode === 'html' ? 'studio-segment-btn studio-segment-btn-active flex-1' : 'studio-segment-btn flex-1'}
            >
              <FileCodeIcon size={11} /> HTML
            </button>
          </div>
          <button
            type="button"
            onClick={freshChat}
            disabled={messages.length === 0 || messages[messages.length - 1]?.role === 'divider'}
            className="studio-btn studio-btn-secondary h-7 px-2 text-[10px] disabled:opacity-40"
          >
            {t('New')}
          </button>
          <button
            type="button"
            onClick={clearChat}
            disabled={messages.length === 0}
            className="studio-btn h-7 px-2 text-[10px] disabled:opacity-40"
          >
            {t('Clear')}
          </button>
      </div>

      {/* Settings sheet — same component the Properties → AI tab renders. */}
      {showSettings && (
        <div className="flex-1 overflow-y-auto bg-[var(--studio-control)] p-3">
          <div className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
            <AiSettings showHeading={false} />
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="mt-3 w-full rounded-lg bg-[var(--studio-text)] px-3 py-1.5 text-xs font-semibold text-[var(--studio-panel)] hover:opacity-90"
          >
            {t('Back to chat')}
          </button>
        </div>
      )}

      {/* No API key — one tap away from fixing it, right here. */}
      {!showSettings && !hasKey && (
        <div className="flex items-start gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-warning-soft)] px-3 py-2 text-xs text-[var(--studio-warning)]">
          <span className="flex-1">
            {t('No key for {provider} yet. Add one in Settings — it stays in your browser.', { provider: t(providerInfo?.label || 'this provider') })}
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-lg bg-[var(--studio-warning)] px-2 py-0.5 text-[11px] font-semibold text-white"
          >
            {t('Open settings')}
          </button>
        </div>
      )}
      {/* Weak-model heads-up: gemma / phi base models weren't tuned for
          tool calling and routinely invent fake function names. Save the
          user a confused round-trip by suggesting a stronger swap up front. */}
      {!showSettings && hasKey && /\b(?:gemma|phi)\b/i.test(modelLabel) && (
        <div className="border-b border-[var(--studio-border)] bg-[var(--studio-warning-soft)] px-3 py-2 text-xs text-[var(--studio-warning)]">
          <span className="font-semibold">{t('Heads-up:')}</span> {t('{model} was not trained for tool calling. Switch to qwen2.5 or llama3.1 via Settings → Model.', { model: modelLabel })}
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollerRef}
        className={`${showSettings ? 'hidden' : 'flex-1'} space-y-3 overflow-y-auto bg-[var(--studio-control)] p-3`}
      >
        {messages.length === 0 && (
          <div className="space-y-2">
            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="px-0.5 text-xs font-semibold text-[var(--studio-text)]">
                  {t('Suggested for this page')}
                </p>
                {suggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    disabled={!hasKey || busy}
                    onPick={sendSuggestion}
                  />
                ))}
              </div>
            )}
            <div className="rounded-md border border-dashed border-[var(--studio-border)] bg-[var(--studio-panel)] p-3 text-xs leading-relaxed text-[var(--studio-text-muted)]">
              <p className="mb-2 font-semibold text-[var(--studio-text)]">{t('Or start from a look:')}</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => send(chip.prompt)}
                    disabled={!hasKey || busy}
                    title={t(chip.label)}
                    className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-2.5 py-1 text-[11px] font-medium text-[var(--studio-text-muted)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)] disabled:opacity-50"
                  >
                    {t(chip.label)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[var(--studio-text-faint)]">
                {t('Or type a free-form request. Type')} <code className="rounded bg-[var(--studio-control)] px-1">/help</code> {t('for slash commands.')}
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
        {pendingChange && (
          <div className="overflow-hidden rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] shadow-sm" role="status">
            <div className="border-b border-[var(--studio-border)] bg-[var(--studio-control)] px-2.5 py-2">
              <p className="text-xs font-bold text-[var(--studio-text)]">{t('Review AI change')}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--studio-text-muted)]">{pendingChange.summary}</p>
            </div>
            {pendingChange.kind === 'html' ? (
              <iframe title={t('AI change preview')} srcDoc={pendingChange.html} sandbox="" className="h-44 w-full border-0 bg-[var(--studio-panel)]" />
            ) : (
              <div className="space-y-2 p-2.5">
                <p className="text-[11px] text-[var(--studio-text-muted)]">{t('{count} canvas actions are ready to apply.', { count: pendingChange.calls?.length || 1 })}</p>
                <ToolsStrip calls={pendingChange.calls || []} />
              </div>
            )}
            <div className="flex gap-2 border-t border-[var(--studio-border)] p-2">
              <button type="button" onClick={rejectPendingChange} className="flex-1 rounded-lg border border-[var(--studio-border)] px-3 py-1.5 text-xs font-semibold text-[var(--studio-text)] hover:bg-[var(--studio-control)]">{t('Reject')}</button>
              <button type="button" onClick={acceptPendingChange} className="flex-1 rounded-lg bg-[var(--studio-success)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">{t('Accept')}</button>
            </div>
          </div>
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-[var(--studio-text-muted)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--studio-text-muted)]" />
            <span>
              {messages[messages.length - 1]?.role === 'user'
                ? t('Thinking with {model}…', { model: modelLabel })
                : t('Applying changes to the canvas…')}
            </span>
          </div>
        )}
        {/* Follow-ups — "what next?" answered from the page as it stands after
            the change that just landed, so the list moves on with the work. */}
        {followUpsVisible && messages.length > 0 && suggestions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="flex items-center gap-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--studio-text-faint)]">
              <LightbulbIcon size={11} /> {t('What next?')}
            </p>
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} disabled={!hasKey || busy} onPick={sendSuggestion} />
            ))}
          </div>
        )}
        {error && (
          <div
            className="rounded border p-2 text-xs text-[var(--studio-danger)]"
            style={{
              borderColor: 'color-mix(in srgb, var(--studio-danger) 40%, transparent)',
              background: 'color-mix(in srgb, var(--studio-danger) 10%, var(--studio-panel))',
            }}
          >
            {t(error)}
          </div>
        )}
      </div>

      {/* Quick actions — structured pickers, no typing needed. Colors and
          fonts work in BOTH modes (theme store for component sites, direct
          CSS swap for HTML sites); sections only exist on HTML pages. */}
      {(
        <div className={`${showSettings ? 'hidden' : ''} border-t border-[var(--studio-border)] bg-[var(--studio-control)] px-2 pb-1.5 pt-1.5`}>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['colors', 'Theme colors', PaletteIcon],
              ['font', 'Font', null],
              ...(isHtmlSite ? [['section', 'Add section', PlusIcon]] : []),
            ].map(([id, label, QuickIcon]) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => setQuickPanel(quickPanel === id ? null : id)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                  quickPanel === id
                    ? 'border-[var(--studio-border-strong)] bg-[var(--studio-panel-raised)] text-[var(--studio-text)] shadow-sm'
                    : 'border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text-muted)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
                }`}
              >
                {QuickIcon && <QuickIcon size={12} />} {t(label)}
              </button>
            ))}
          </div>
          {quickPanel === 'colors' && (
            <div className="mt-1.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2">
              <div className="mb-1.5 text-[11px] text-[var(--studio-text-muted)]">
                {t('Pick 1–2 colors — first becomes the primary, second the secondary. Applies instantly, no typing.')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {THEME_SWATCHES.map(([hex, name]) => {
                  const idx = pickedColors.indexOf(hex)
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={name}
                      onClick={() =>
                        setPickedColors((cur) =>
                          cur.includes(hex)
                            ? cur.filter((c) => c !== hex)
                            : cur.length >= 2
                              ? [cur[0], hex]
                              : [...cur, hex],
                        )
                      }
                      className="relative h-7 w-7 rounded-full border border-black/10"
                      style={{
                        background: hex,
                        outline: idx >= 0 ? '2px solid var(--studio-text)' : 'none',
                        outlineOffset: '1px',
                      }}
                    >
                      {idx >= 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--studio-text)] text-[9px] font-bold text-[var(--studio-panel)]">
                          {idx + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setPickedColors([]); setQuickPanel(null) }}
                  className="rounded-lg px-2.5 py-1 text-[11px] text-[var(--studio-text-muted)] hover:bg-[var(--studio-control)]"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  disabled={!pickedColors.length || busy}
                  onClick={applyQuickColors}
                  className="rounded-lg bg-[var(--studio-text)] px-3 py-1 text-[11px] font-semibold text-[var(--studio-panel)] hover:opacity-90 disabled:bg-[var(--studio-text-faint)]"
                >
                  {t('Apply colors')}
                </button>
              </div>
            </div>
          )}
          {quickPanel === 'font' && (
            <div className="mt-1.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2">
              <div className="mb-1.5 text-[11px] text-[var(--studio-text-muted)]">{t('Pick a font — typography changes, content stays.')}</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FONTS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={busy}
                    onClick={() => applyQuickFont(f)}
                    className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] px-2.5 py-1 text-[12px] text-[var(--studio-text)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)] disabled:opacity-40"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
          {quickPanel === 'section' && (
            <div className="mt-1.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2">
              <div className="mb-1.5 text-[11px] text-[var(--studio-text-muted)]">{t('Add a ready-made section — your existing content is preserved.')}</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SECTIONS.map(([label, prompt]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setQuickPanel(null)
                      send(prompt)
                    }}
                    className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] px-2.5 py-1 text-[12px] text-[var(--studio-text)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)] disabled:opacity-40"
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <div className={`${showSettings ? 'hidden' : ''} border-t border-[var(--studio-border)] bg-[var(--studio-panel)] p-2`}>
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
              ? t('Tell AI what to build (Enter to send, Shift+Enter for newline)…')
              : t('Set an API key first — the gear button above.')
          }
          className="block w-full resize-none rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] px-2 py-1.5 text-sm text-[var(--studio-text)] placeholder:text-[var(--studio-text-faint)] focus:border-[var(--studio-border-strong)] focus:bg-[var(--studio-control)] focus:outline-none disabled:bg-[var(--studio-control)] disabled:text-[var(--studio-text-faint)]"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--studio-text-muted)]">
          <span>{t('Press Ctrl+Z to undo any change the AI made.')}</span>
          <button
            type="button"
            onClick={send}
            disabled={!hasKey || busy || !draft.trim()}
            className="rounded-lg bg-[var(--studio-text)] px-3 py-1 text-xs font-semibold text-[var(--studio-panel)] hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--studio-text-faint)]"
          >
            {busy ? '…' : t('Send')}
          </button>
        </div>
      </div>
    </div>
  )
}

// One tap-to-send suggestion. The second line is the reason it is being
// offered ("this page has no navbar") — without it a suggestion reads as a
// generic list, and the user has no way to tell it looked at their page.
function SuggestionCard({ suggestion, disabled, onPick }) {
  const { t } = useLanguage()
  const vars = suggestion.vars
    ? Object.fromEntries(Object.entries(suggestion.vars).map(([k, v]) => [k, t(v)]))
    : undefined
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(suggestion)}
      title={`${t(suggestion.label, vars)} — ${t(suggestion.why, vars)}`}
      className="flex w-full items-start gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] p-2 text-left transition hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-control-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="mt-0.5 shrink-0 text-[var(--studio-text-muted)]">
        <SparklesIcon size={12} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--studio-text)]">
          {t(suggestion.label, vars)}
        </span>
        <span className="block text-[10px] leading-snug text-[var(--studio-text-muted)]">
          {t(suggestion.why, vars)}
        </span>
      </span>
    </button>
  )
}

// Subtle horizontal rule with a centred label. Marks where the AI's memory
// is intentionally reset — everything above is reference scrollback the
// model will NOT see in the next prompt.
function DividerRow({ label }) {
  const { t } = useLanguage()
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--studio-text-faint)]">
      <span className="h-px flex-1 bg-[var(--studio-control-hover)]" />
      <span>{label || t('New conversation')}</span>
      <span className="h-px flex-1 bg-[var(--studio-control-hover)]" />
    </div>
  )
}

// Dedupe + cap the per-call error reasons into a one-paragraph message the
// user can act on. Beats showing the model's hallucinated "Updated the X"
// reply when none of the changes actually landed.
function buildFailureSummary(calls, translate) {
  const reasons = new Set()
  for (const c of calls || []) {
    const e = c?.result?.error
    if (e) reasons.add(`${c.name}: ${e}`)
  }
  const list = Array.from(reasons).slice(0, 4).join('\n• ')
  return (
    translate('I tried {count} actions but none of them landed.', { count: calls.length }) + ' '
    + translate('Common causes: the canvas was empty before I started, or I used component IDs that do not exist yet.') + '\n\n'
    + translate('Errors:') + `\n• ${list}\n\n` + translate('Try rephrasing the request, or use /undo if anything did slip through.')
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-tr-[2px] bg-[var(--studio-text)] px-3 py-2 text-sm leading-snug text-[var(--studio-panel)] shadow-sm">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({ text, toolCallCount, allFailed }) {
  const { t } = useLanguage()
  // Failure-aware tinting: red border + light pink background so a wall of
  // ✗ pills above this bubble can't be mistaken for a successful change.
  const base =
    'max-w-[85%] whitespace-pre-wrap break-words rounded-[12px] rounded-tl-[2px] border px-3 py-2 text-sm leading-snug shadow-sm'
  const bubbleCls = allFailed
    ? `${base} text-[var(--studio-danger)]`
    : `${base} border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)]`
  const failedStyle = allFailed
    ? {
        borderColor: 'color-mix(in srgb, var(--studio-danger) 40%, transparent)',
        background: 'color-mix(in srgb, var(--studio-danger) 10%, var(--studio-panel))',
      }
    : undefined
  return (
    <div className="flex flex-col items-start gap-1">
      <div className={bubbleCls} style={failedStyle}>
        {text || t('Done.')}
      </div>
      {toolCallCount === 0 && (
        <span className="text-[10px] italic text-[var(--studio-danger)]">
          {t('No tools called — the canvas was not changed.')}
        </span>
      )}
    </div>
  )
}

function ToolsStrip({ calls }) {
  const { t } = useLanguage()
  const schema = useEditorStore((state) => state.schema)
  return (
    <div className="w-full space-y-1.5">
        {(calls || []).map((c, i) => {
          // Tool calls that returned ok:false (stale IDs, validation errors,
          // etc.) get painted red with a strike so the user can tell at a
          // glance that the AI's claim of "done" didn't fully land. Tooltip
          // surfaces the error reason on hover.
          const failed = c.result && c.result.ok === false
          const change = describeToolChange(c, schema, t)
          const cls = failed
            ? 'border-[color-mix(in_srgb,var(--studio-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--studio-danger)_8%,var(--studio-panel))]'
            : 'border-[var(--studio-border)] bg-[var(--studio-panel)]'
          const style = failed
            ? {
                borderColor: 'color-mix(in srgb, var(--studio-danger) 40%, transparent)',
                background: 'color-mix(in srgb, var(--studio-danger) 10%, var(--studio-panel))',
              }
            : undefined
          return (
            <details key={`${c.name}-${i}`} className={`group rounded-lg border px-2.5 py-2 ${cls}`} style={style}>
              <summary className="flex cursor-pointer list-none items-start gap-2">
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${failed ? 'bg-[var(--studio-danger)]' : 'bg-[var(--studio-success)]'}`}>
                  {failed ? '×' : '✓'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[11px] font-semibold ${failed ? 'text-[var(--studio-danger)]' : 'text-[var(--studio-text)]'}`}>
                    {failed ? t('Change failed') : change.title}
                  </span>
                  <span className="mt-0.5 block break-words text-[10px] leading-relaxed text-[var(--studio-text-muted)]">
                    {failed ? c.result?.error || t('Unknown error') : change.detail}
                  </span>
                </span>
                <span className="text-[10px] text-[var(--studio-text-faint)] transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-2 border-t border-[var(--studio-border)] pt-2">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--studio-text-faint)]">{t('Technical details')}</div>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--studio-control)] p-2 text-[9px] leading-relaxed text-[var(--studio-text-muted)]">{JSON.stringify({ action: c.name, arguments: c.args, result: c.result }, null, 2)}</pre>
              </div>
            </details>
          )
        })}
    </div>
  )
}

function describeToolChange(call, schema, translate) {
  const args = call?.args || {}
  const component = findSchemaComponent(schema, args.id)
  const target = componentLabel(component, translate)
  const patch = args.patch || {}
  const entries = Object.entries(patch)
  const detail = entries.length
    ? entries.slice(0, 4).map(([key, value]) => `${friendlyField(key, translate)}: ${shortValue(value)}`).join(' · ')
    : ''

  switch (call?.name) {
    case 'addComponent':
      return { title: translate('{type} added', { type: translate(componentTypeLabel(args.type)) }), detail: translate('A new component was placed on the current page.') }
    case 'addSection':
      return { title: translate('Section added'), detail: args.background ? `${translate('Background')}: ${args.background}` : translate('A new full-width section was created.') }
    case 'removeComponent':
      return { title: translate('{target} deleted', { target }), detail: translate('The component was removed from the current page.') }
    case 'duplicateComponent':
      return { title: translate('{target} duplicated', { target }), detail: translate('A copy was created beside the original component.') }
    case 'replaceComponentText':
      return { title: translate('{target} text changed', { target }), detail: shortValue(args.text) }
    case 'updateProps': {
      const textKey = ['text', 'label', 'title', 'heading', 'brand'].find((key) => Object.hasOwn(patch, key))
      if (textKey) return { title: translate('{target} text changed', { target }), detail: shortValue(patch[textKey]) }
      return { title: translate('{target} settings updated', { target }), detail: detail || translate('Component settings were updated.') }
    }
    case 'updateStyles':
      return { title: translate('{target} appearance updated', { target }), detail: detail || translate('Colors and visual styles were updated.') }
    case 'setLayout':
      return { title: translate('{target} layout updated', { target }), detail: detail || translate('Position or size was changed.') }
    case 'centerHorizontally':
      return { title: translate('{target} centered', { target }), detail: translate('The component was centered horizontally.') }
    case 'moveToEnd':
      return { title: translate('{target} moved forward', { target }), detail: translate('Its stacking/order position was updated.') }
    case 'moveToStart':
      return { title: translate('{target} moved backward', { target }), detail: translate('Its stacking/order position was updated.') }
    case 'updateTheme':
      return { title: translate('Site theme updated'), detail: detail || translate('Theme colors and typography were applied to the design.') }
    case 'setMotion':
      return { title: translate('{target} animation updated', { target }), detail: Object.entries(args).filter(([key]) => key !== 'id').map(([key, value]) => `${friendlyField(key, translate)}: ${shortValue(value)}`).join(' · ') }
    case 'setNavbarLayout':
      return { title: translate('Navbar layout updated'), detail: Object.entries(args).filter(([key]) => key !== 'id').map(([key, value]) => `${friendlyField(key, translate)}: ${shortValue(value)}`).join(' · ') }
    case 'setLinks':
      return { title: translate('Navbar links updated'), detail: translate('{count} links were configured.', { count: Array.isArray(args.links) ? args.links.length : 0 }) }
    case 'setPageMeta':
      return { title: translate('Page SEO updated'), detail: Object.entries(args).filter(([key]) => key !== 'pageId').map(([key, value]) => `${friendlyField(key, translate)}: ${shortValue(value)}`).join(' · ') }
    case 'addPage':
      return { title: translate('Page added'), detail: args.name || translate('A new page was created.') }
    case 'selectPage':
      return { title: translate('Active page changed'), detail: translate('AI continued working on another page.') }
    case 'applyTemplate':
      return { title: translate('Template applied'), detail: args.name || translate('The current page design was replaced.') }
    default:
      return { title: humanizeAction(call?.name, translate), detail: detail || translate('The requested change was applied.') }
  }
}

function findSchemaComponent(schema, id) {
  if (!id) return null
  const visit = (items) => {
    for (const item of items || []) {
      if (item.id === id) return item
      const nested = visit(item.children)
      if (nested) return nested
    }
    return null
  }
  for (const page of schema?.pages || []) {
    const found = visit(page.components)
    if (found) return found
  }
  return null
}

function componentLabel(component, translate) {
  if (!component) return translate('Component')
  return translate(componentTypeLabel(component.type))
}

function componentTypeLabel(type) {
  const labels = {
    button: 'Button', navbar: 'Navbar', text: 'Text', heading: 'Heading',
    image: 'Image', region: 'Section', html: 'HTML block', form: 'Form',
    card: 'Card', divider: 'Divider', footer: 'Footer',
  }
  return labels[type] || String(type || 'Component').replace(/[-_]/g, ' ')
}

function friendlyField(key, translate) {
  const labels = {
    text: 'Text', label: 'Label', title: 'Title', backgroundColor: 'Background',
    color: 'Text color', fontSize: 'Font size', fontFamily: 'Font', widthMode: 'Width',
    mobileNavMode: 'Mobile menu', navLayout: 'Layout', scrollBehavior: 'Scroll behavior',
    x: 'Horizontal position', y: 'Vertical position', w: 'Width', h: 'Height',
    animIn: 'Entrance', animHover: 'Hover effect', animSpeed: 'Animation speed', animDelay: 'Delay',
    seoTitle: 'SEO title', seoDescription: 'SEO description', seoImage: 'Share image',
  }
  return translate(labels[key] || String(key).replace(/([a-z])([A-Z])/g, '$1 $2'))
}

function shortValue(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'object') {
    const rendered = JSON.stringify(value)
    return rendered.length > 90 ? `${rendered.slice(0, 87)}…` : rendered
  }
  const rendered = String(value)
  return rendered.length > 110 ? `${rendered.slice(0, 107)}…` : rendered
}

function humanizeAction(value, translate) {
  const label = String(value || 'Change')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
  return translate(label)
}

function rand() {
  return Math.random().toString(36).slice(2, 10)
}
