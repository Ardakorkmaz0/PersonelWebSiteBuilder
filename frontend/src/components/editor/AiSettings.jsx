// AI provider settings — provider, API key, model, endpoint.
//
// ONE component, two homes: the AI chat panel (behind its Settings button,
// where the user actually notices the key is missing) and the Properties → AI
// tab. Extracted from PropertiesPanel so the two can never drift apart, the
// same single-source discipline the export writers follow.
//
// The key is stored in localStorage and sent from the browser straight to the
// provider — the Django backend never sees it. Saved per browser, not per site.
import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'
import {
  AI_PROVIDERS,
  fetchLocalStatus,
  getApiKey,
  getEndpoint,
  getModel,
  getModelsFor,
  getProvider,
  pickBestLocalModel,
  setApiKey,
  setEndpoint,
  setModel,
  setProvider,
} from '../../utils/aiAssistant.js'

const FIELD =
  'w-full rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] px-2 py-1 text-sm text-[var(--studio-text)] focus:border-[var(--studio-accent)] focus:outline-none'
const FIELD_MONO =
  'w-full rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] px-2 py-1 font-mono text-xs text-[var(--studio-text)] focus:border-[var(--studio-accent)] focus:outline-none'
const FIELD_LABEL = 'mb-1 block text-xs font-semibold text-[var(--studio-text-muted)]'
const HINT = 'mt-1 block text-[11px] text-[var(--studio-text-muted)]'

// Compact connection-status pill for the local provider: green when Ollama
// is reachable and reports installed models, amber while we ping, red when
// it can't be reached. Doubles as a refresh button.
function LocalStatusRow({ status, refreshing, onRefresh }) {
  const { t } = useLanguage()
  let tone = 'warning'
  let label = t('Checking…')
  let detail = ''
  if (!refreshing && status) {
    if (status.ok) {
      tone = 'success'
      const count = (status.models || []).length
      label = count
        ? t(count === 1 ? '{count} model ready' : '{count} models ready', { count })
        : t('Reachable but no models installed')
      detail = count
        ? t('Runtime: {runtime}', { runtime: status.runtime || 'ollama' })
        : t('Pull one with `ollama pull qwen2.5`.')
    } else {
      tone = 'danger'
      label = t('Cannot reach the local runtime')
      detail = status.reason
        ? t('Make sure Ollama is running. ({reason})', { reason: status.reason })
        : t('Make sure Ollama (or LM Studio) is running.')
    }
  }
  return (
    <div
      className="flex items-start justify-between gap-2 rounded-lg border p-2 text-[11px]"
      style={{
        borderColor: `color-mix(in srgb, var(--studio-${tone}) 40%, transparent)`,
        background: `color-mix(in srgb, var(--studio-${tone}) 10%, var(--studio-panel))`,
        color: `var(--studio-${tone})`,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        {detail && <p className="mt-0.5 leading-relaxed opacity-80">{detail}</p>}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded-lg border border-current bg-[var(--studio-panel)] px-2 py-0.5 text-[10px] font-semibold opacity-90 hover:opacity-100 disabled:cursor-wait"
      >
        {refreshing ? '…' : t('Refresh')}
      </button>
    </div>
  )
}

// One glanceable line answering "can I use the AI right now?" — the question
// the old settings block made the user work out from three separate fields.
function ReadyBanner({ ready, provider, model }) {
  const { t } = useLanguage()
  const tone = ready ? 'success' : 'warning'
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px]"
      style={{
        borderColor: `color-mix(in srgb, var(--studio-${tone}) 40%, transparent)`,
        background: `color-mix(in srgb, var(--studio-${tone}) 10%, var(--studio-panel))`,
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: `var(--studio-${tone})` }}
      />
      <div className="min-w-0">
        <p className="font-semibold" style={{ color: `var(--studio-${tone})` }}>
          {ready ? t('Ready to use') : t('Setup needed — add a key below')}
        </p>
        <p className="truncate text-[var(--studio-text-muted)]">
          {t('{provider} · {model}', { provider, model })}
        </p>
      </div>
    </div>
  )
}

export default function AiSettings({ showHeading = true }) {
  const { t } = useLanguage()
  const [provider, setProviderState] = useState(() => getProvider())
  const [value, setValue] = useState(() => getApiKey(provider))
  const [reveal, setReveal] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [model, setModelState] = useState(() => getModel(provider))
  const [endpoint, setEndpointState] = useState(() => getEndpoint(provider))
  const [localStatus, setLocalStatus] = useState(null) // { ok, runtime, models, reason }
  const [localRefreshing, setLocalRefreshing] = useState(false)
  const knownModels = getModelsFor(provider)
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const needsKey = providerInfo?.needsKey !== false
  // For the local provider we merge the auto-discovered model list (whatever
  // the user has actually pulled with `ollama pull`) with our suggestions.
  // For other providers `models` stays the curated dropdown.
  const discoveredModels = (provider === 'local' && localStatus?.ok && Array.isArray(localStatus.models))
    ? localStatus.models.map((id) => ({ id, label: id, note: '' }))
    : []
  const models = provider === 'local' && discoveredModels.length
    ? discoveredModels
    : knownModels

  // Ping the backend proxy each time the user opens the panel on the local
  // provider — that's how we know which models they have pulled AND whether
  // Ollama is actually running. All state updates happen in the response
  // callback (never synchronously in the effect body); "no status yet" is
  // treated as refreshing by the row below.
  useEffect(() => {
    if (provider !== 'local') return undefined
    let cancelled = false
    fetchLocalStatus(endpoint || undefined).then((s) => {
      if (cancelled) return
      setLocalStatus(s)
      setLocalRefreshing(false)
      // Auto-pick: if the saved model isn't installed, or even if it is but
      // is a weak-tool-calling model (e.g. gemma) when a stronger one is
      // available (llama3.1 / qwen2.5 / mistral-nemo), switch automatically.
      if (s?.ok && Array.isArray(s.models) && s.models.length) {
        const best = pickBestLocalModel(s.models, model)
        if (best && best !== model) setModelState(best)
      }
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, endpoint])

  function refreshLocalStatus() {
    setLocalRefreshing(true)
    fetchLocalStatus(endpoint || undefined).then((s) => {
      setLocalStatus(s)
      setLocalRefreshing(false)
      if (s?.ok && Array.isArray(s.models) && s.models.length) {
        const best = pickBestLocalModel(s.models, model)
        if (best && best !== model) setModelState(best)
      }
    })
  }
  // When the user picks a different provider, persist it and load the saved
  // key + model + endpoint for that provider so they don't bleed across each
  // other. Lives in the select's event handler (not an effect) so no state
  // cascades through extra renders.
  function pickProvider(next) {
    setProviderState(next)
    setProvider(next)
    setValue(getApiKey(next))
    setModelState(getModel(next))
    setEndpointState(getEndpoint(next))
    // The local-status row refetches via the effect above; clearing here
    // makes it show "checking…" instead of a stale snapshot.
    setLocalStatus(null)
  }
  // Persist the key as the user types; flash "Saved ✓" briefly.
  function changeApiKey(next) {
    setValue(next)
    setApiKey(next || '', provider)
    setSavedFlash(!!next)
  }
  useEffect(() => {
    if (!savedFlash) return undefined
    const timer = setTimeout(() => setSavedFlash(false), 1200)
    return () => clearTimeout(timer)
  }, [savedFlash])
  useEffect(() => {
    setModel(model, provider)
  }, [model, provider])
  useEffect(() => {
    if (providerInfo?.configurableEndpoint) setEndpoint(endpoint, provider)
  }, [endpoint, provider, providerInfo?.configurableEndpoint])
  const modelLabel = models.find((m) => m.id === model)?.label.replace(' (recommended)', '') || model
  return (
    <section className="space-y-3">
      {showHeading && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--studio-text-muted)]">
          {t('AI Assistant')}
        </h3>
      )}
      <ReadyBanner
        ready={needsKey ? !!value : localStatus?.ok !== false}
        provider={t(providerInfo?.label || 'AI')}
        model={modelLabel || '—'}
      />
      <label className="block">
        <span className={FIELD_LABEL}>{t('Provider')}</span>
        <select value={provider} onChange={(e) => pickProvider(e.target.value)} className={FIELD}>
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(p.label)}
            </option>
          ))}
        </select>
        <span className={HINT}>{t(providerInfo?.keyHint)}</span>
      </label>
      {needsKey ? (
        <>
          <p className="text-xs leading-relaxed text-[var(--studio-text-muted)]">
            {t('Paste a free API key from')}{' '}
            <a
              href={providerInfo?.keyUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--studio-accent-hover)] underline"
            >
              {(providerInfo?.keyUrl || '').replace(/^https?:\/\//, '').replace(/\/.*/, '')}
            </a>
            . {t('The key stays in your browser and is sent directly to the provider — never to our server.')}
          </p>
          <label className="block">
            <span className={FIELD_LABEL}>
              {t('{provider} key', { provider: t(providerInfo?.label || 'API') })}
            </span>
            <div className="flex gap-2">
              <input
                type={reveal ? 'text' : 'password'}
                value={value}
                onChange={(e) => changeApiKey(e.target.value.trim())}
                placeholder="AIza... / gsk_... / sk-..."
                className={FIELD_MONO}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="rounded-lg border border-[var(--studio-border-strong)] px-2 text-xs text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]"
              >
                {reveal ? t('Hide') : t('Show')}
              </button>
            </div>
          </label>
        </>
      ) : (
        <div className="space-y-2">
          <p className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-control)] p-2 text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
            {t('No API key needed — this provider runs on your computer. All you need is Ollama installed and at least one model pulled (e.g.')}{' '}
            <code className="mx-1 rounded bg-[var(--studio-panel)] px-1 py-0.5 text-[10px]">ollama pull qwen2.5</code>
            {' '}{t('). Requests are routed through this app backend, so you do not have to deal with CORS or OLLAMA_ORIGINS.')}
          </p>
          <LocalStatusRow
            status={localStatus}
            refreshing={localRefreshing || !localStatus}
            onRefresh={refreshLocalStatus}
          />
        </div>
      )}
      {providerInfo?.configurableEndpoint && (
        <label className="block">
          <span className={FIELD_LABEL}>{t('Base URL (advanced)')}</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpointState(e.target.value)}
            placeholder="http://localhost:11434/v1"
            className={FIELD_MONO}
            autoComplete="off"
            spellCheck={false}
          />
          <span className={HINT}>
            {t('Ollama: http://localhost:11434/v1 — LM Studio: http://localhost:1234/v1. Leave as-is unless you changed Ollama default port.')}
          </span>
        </label>
      )}
      {needsKey && (
        <p className="text-xs text-[var(--studio-text-muted)]">
          {value
            ? savedFlash
              ? t('Saved ✓')
              : t('Key saved. The AI button in the toolbar opens the chat panel.')
            : t('No key set — the AI button in the toolbar is in setup mode.')}
        </p>
      )}
      <label className="block">
        <span className={FIELD_LABEL}>{t('Model')}</span>
        {providerInfo?.customModel ? (
          <>
            <input
              type="text"
              list="ai-model-suggestions"
              value={model}
              onChange={(e) => setModelState(e.target.value)}
              placeholder="llama3.1 / qwen2.5 / your-pulled-model"
              className={FIELD_MONO}
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id="ai-model-suggestions">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.label)}
                </option>
              ))}
            </datalist>
            <span className={HINT}>
              {t(models.find((m) => m.id === model)?.note ||
                'Type any model you have pulled with Ollama or loaded in LM Studio.')}
            </span>
          </>
        ) : (
          <>
            <select
              value={model}
              onChange={(e) => setModelState(e.target.value)}
              className={FIELD}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.label)}
                </option>
              ))}
            </select>
            <span className={HINT}>{t(models.find((m) => m.id === model)?.note)}</span>
          </>
        )}
      </label>
    </section>
  )
}
