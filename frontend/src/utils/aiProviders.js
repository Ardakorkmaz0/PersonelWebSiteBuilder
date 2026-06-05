// Provider catalogue + per-provider key / model / endpoint persistence.
//
// Split out of aiAssistant.js so the larger module can focus on tool
// dispatch + the prompt loop. The public surface (AI_PROVIDERS,
// getProvider/setProvider, getApiKey, getModel, fetchLocalStatus, …) is
// re-exported from aiAssistant.js so existing import sites stay valid.
//
// Bring-your-own-key model: the user pastes a key into the editor Settings
// panel; it's persisted in localStorage and sent straight to the provider.
// The Django backend only handles the Local AI proxy (no key needed there).

// Providers are kept side by side so the user picks whichever has free quota
// left. OpenRouter is the default because its free tier rotates through the
// strongest open-weight models (Qwen3 80B today, others tomorrow) — auto
// failover takes care of the rotation.
export const AI_PROVIDERS = [
  {
    id: 'openrouter',
    label: 'OpenRouter · Qwen3 80B (recommended)',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint:
      'One key, many free models (Qwen3 80B, Hermes 3 405B, Llama 3.3 70B). Separate quota pool from Groq/Gemini — use when those run out. The free lineup changes — paste any current id from openrouter.ai/models if the dropdown picks one that has been retired.',
    customModel: true,
  },
  {
    id: 'groq',
    label: 'Groq · Llama',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'Free tier: ~14 400 requests/day, 30/min. Sign up at console.groq.com.',
  },
  {
    id: 'local',
    label: 'Local AI (Ollama / LM Studio)',
    keyUrl: 'https://ollama.com',
    keyHint:
      'Run llama3.1 / qwen2.5 / mistral on your own machine. No key, no quota, no internet. Routed through this app’s backend — no CORS setup needed.',
    needsKey: false,
    configurableEndpoint: true,
    customModel: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'Free tier: 1 000-1 500 requests/day. Sign up at aistudio.google.com.',
  },
]

const PROVIDER_MODELS = {
  openrouter: [
    {
      id: 'qwen/qwen3-next-80b-a3b-instruct:free',
      label: 'Qwen3 Next 80B (recommended)',
      note: 'Top free tool-calling model in 2026. Smarter than Llama 70B for editor work.',
    },
    {
      id: 'nousresearch/hermes-3-llama-3.1-405b:free',
      label: 'Hermes 3 · Llama 3.1 405B',
      note: 'Fine-tuned for function calling. Heavier, very reliable on tools.',
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      label: 'Llama 3.3 70B',
      note: 'Reliable workhorse, similar to Groq but a separate quota pool.',
    },
    {
      id: 'openai/gpt-oss-120b:free',
      label: 'GPT-OSS 120B',
      note: 'OpenAI’s open-source release. Strong overall quality.',
    },
    {
      id: 'moonshotai/kimi-k2.6:free',
      label: 'Kimi K2.6',
      note: 'Moonshot’s long-context reasoning model.',
    },
    {
      id: 'qwen/qwen3-coder:free',
      label: 'Qwen3 Coder',
      note: 'Coding-focused; great when you also want Custom JS / CSS edits.',
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B (recommended)',
      note: '~14 400 req/day free, 30/min. Best balance for tool calling.',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B Instant',
      note: 'Fastest, even larger quota. Slightly less accurate on tool args.',
    },
  ],
  local: [
    {
      id: 'llama3.1',
      label: 'llama3.1 (default Ollama)',
      note: 'Run: `ollama run llama3.1`. Solid tool calling, ~7 GB RAM.',
    },
    {
      id: 'qwen2.5',
      label: 'qwen2.5',
      note: 'Strong on tool calling. Run: `ollama run qwen2.5`.',
    },
    {
      id: 'llama3.2',
      label: 'llama3.2',
      note: 'Smaller, faster. Tool calling OK.',
    },
    {
      id: 'mistral-nemo',
      label: 'mistral-nemo',
      note: 'Mistral 12B with tool calling.',
    },
  ],
  gemini: [
    {
      id: 'gemini-2.0-flash-lite',
      label: 'Gemini 2.0 Flash Lite',
      note: '1 500 req/day, 30/min — Gemini’s largest free quota.',
    },
    {
      id: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash Lite',
      note: '1 000 req/day, 15/min. A bit smarter than 2.0.',
    },
    {
      id: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash (low quota)',
      note: 'Highest quality, but only 250 req/day free.',
    },
  ],
}

const DEFAULT_PROVIDER = AI_PROVIDERS[0].id
const PROVIDER_STORAGE = 'pwb_ai_provider'
const KEY_STORAGE_BY_PROVIDER = {
  gemini: 'pwb_gemini_key',
  groq: 'pwb_groq_key',
  local: 'pwb_local_key', // optional — some local proxies still want one
  openrouter: 'pwb_openrouter_key',
}
const MODEL_STORAGE_BY_PROVIDER = {
  gemini: 'pwb_gemini_model',
  groq: 'pwb_groq_model',
  local: 'pwb_local_model',
  openrouter: 'pwb_openrouter_model',
}
const ENDPOINT_STORAGE_BY_PROVIDER = {
  local: 'pwb_local_endpoint',
}
const DEFAULT_ENDPOINT_BY_PROVIDER = {
  // Ollama default. LM Studio users override to http://localhost:1234/v1.
  local: 'http://localhost:11434/v1',
}

// Django proxy path — the frontend hits this same-origin instead of talking
// to Ollama directly, so CORS / OLLAMA_ORIGINS pain goes away.
export const LOCAL_PROXY_PATH = '/api/ai/local'

export function resolveBackendBase() {
  const envBase = import.meta.env?.VITE_API_URL
  if (envBase) return envBase.replace(/\/api\/?$/, '')
  return 'http://127.0.0.1:8000'
}

// Score how well-suited a model name is to function-calling. Higher is
// better. Used to auto-pick from whatever the user has installed: a llama3.1
// or qwen2.5 beats a gemma every time. Falls back to anything if nothing
// scores positive.
const TOOL_FRIENDLY_PREFIXES = [
  { match: /(?:^|[/-])(?:qwen2\.5|qwen3)/i, score: 110 },
  { match: /(?:^|[/-])llama-?3\.[123]/i, score: 100 },
  { match: /(?:^|[/-])mistral-?nemo/i, score: 95 },
  { match: /(?:^|[/-])hermes-?3/i, score: 90 },
  { match: /(?:^|[/-])firefunction/i, score: 85 },
  { match: /(?:^|[/-])mistral-?large/i, score: 80 },
  { match: /(?:^|[/-])command-?r/i, score: 75 },
  { match: /(?:^|[/-])llama/i, score: 60 },
  { match: /(?:^|[/-])qwen/i, score: 55 },
  { match: /(?:^|[/-])mistral/i, score: 50 },
]

function scoreModel(id) {
  let best = 0
  for (const { match, score } of TOOL_FRIENDLY_PREFIXES) {
    if (match.test(id) && score > best) best = score
  }
  return best
}

export function pickBestLocalModel(models, preferred) {
  if (!Array.isArray(models) || !models.length) return preferred || ''
  const scored = models
    .map((id) => ({ id, score: scoreModel(id) }))
    .sort((a, b) => b.score - a.score)
  const top = scored[0]
  // If the saved choice isn't even on the user's machine, switch to whatever
  // is on top.
  if (!preferred || !models.includes(preferred)) return top.id
  // If the saved choice IS installed but is unknown/weak for tool calling
  // (score 0 — e.g. gemma, phi) AND a tool-friendly alternative exists,
  // upgrade. Otherwise honour the user's pick.
  const prefScore = scoreModel(preferred)
  if (prefScore === 0 && top.score > 0) return top.id
  return preferred
}

const LOCAL_MODELS_CACHE_KEY = 'pwb_local_models_cache'

// Fetch the list of locally-installed models from the Django proxy. Returns
// { ok, runtime, models, base } or { ok: false, reason }. Successful results
// are cached in localStorage so the chat call path can self-heal even when
// the Settings panel has never been opened in this session.
export async function fetchLocalStatus(baseOverride) {
  const url = new URL(`${resolveBackendBase()}${LOCAL_PROXY_PATH}/status/`)
  const base = baseOverride || getEndpoint('local')
  if (base) url.searchParams.set('base', base)
  try {
    const res = await fetch(url.toString(), { method: 'GET' })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const data = await res.json()
    if (data?.ok && Array.isArray(data.models)) {
      try {
        localStorage.setItem(
          LOCAL_MODELS_CACHE_KEY,
          JSON.stringify({ at: Date.now(), models: data.models }),
        )
      } catch { /* storage unavailable */ }
    }
    return data
  } catch (e) {
    return { ok: false, reason: e?.message || 'fetch failed' }
  }
}

export function readCachedLocalModels() {
  try {
    const raw = localStorage.getItem(LOCAL_MODELS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.models) ? parsed.models : []
  } catch { return [] }
}

export function getProvider() {
  try {
    const saved = localStorage.getItem(PROVIDER_STORAGE)
    if (saved && AI_PROVIDERS.some((p) => p.id === saved)) return saved
  } catch { /* ignore */ }
  return DEFAULT_PROVIDER
}

export function setProvider(providerId) {
  try {
    if (providerId && AI_PROVIDERS.some((p) => p.id === providerId)) {
      localStorage.setItem(PROVIDER_STORAGE, providerId)
    }
  } catch { /* ignore */ }
}

// Read the models exposed for a given provider. Defaults to the active
// provider when no argument is supplied.
export function getModelsFor(providerId = getProvider()) {
  return PROVIDER_MODELS[providerId] || []
}

// Back-compat: the original module exposed AI_MODELS as the Gemini list.
export const AI_MODELS = PROVIDER_MODELS.gemini

export function getApiKey(providerId = getProvider()) {
  try {
    const key = KEY_STORAGE_BY_PROVIDER[providerId]
    return (key && localStorage.getItem(key)) || ''
  } catch {
    return ''
  }
}

export function setApiKey(key, providerId = getProvider()) {
  try {
    const storageKey = KEY_STORAGE_BY_PROVIDER[providerId]
    if (!storageKey) return
    if (key) localStorage.setItem(storageKey, key)
    else localStorage.removeItem(storageKey)
  } catch {
    /* localStorage unavailable */
  }
}

// OpenRouter's free model lineup rotates often — when a model id we used to
// recommend gets retired, map saved values to a sensible replacement so the
// user doesn't see "No endpoints found" the moment they reload.
const RETIRED_MODEL_MIGRATIONS = {
  openrouter: {
    // DeepSeek dropped off the OpenRouter free tier in 2026 — bounce stuck
    // users onto Qwen3 80B which is currently the strongest free option.
    'deepseek/deepseek-chat-v3.1:free': 'qwen/qwen3-next-80b-a3b-instruct:free',
    'deepseek/deepseek-chat-v3-0324:free': 'qwen/qwen3-next-80b-a3b-instruct:free',
    'deepseek/deepseek-chat:free': 'qwen/qwen3-next-80b-a3b-instruct:free',
    'deepseek/deepseek-r1:free': 'nousresearch/hermes-3-llama-3.1-405b:free',
    'qwen/qwen-2.5-72b-instruct:free': 'qwen/qwen3-next-80b-a3b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free': 'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free': 'qwen/qwen3-next-80b-a3b-instruct:free',
  },
}

export function getModel(providerId = getProvider()) {
  try {
    const storageKey = MODEL_STORAGE_BY_PROVIDER[providerId]
    let saved = storageKey ? localStorage.getItem(storageKey) : ''
    const migration = RETIRED_MODEL_MIGRATIONS[providerId]
    if (saved && migration && migration[saved]) {
      const replacement = migration[saved]
      try { localStorage.setItem(storageKey, replacement) } catch { /* ignore */ }
      saved = replacement
    }
    if (saved) {
      const provider = AI_PROVIDERS.find((p) => p.id === providerId)
      // customModel providers (local, openrouter) accept any string — the
      // dropdown is suggestions, not validation.
      if (provider?.customModel) return saved
      if (getModelsFor(providerId).some((m) => m.id === saved)) return saved
    }
  } catch { /* ignore */ }
  return getModelsFor(providerId)[0]?.id || ''
}

export function setModel(modelId, providerId = getProvider()) {
  try {
    const storageKey = MODEL_STORAGE_BY_PROVIDER[providerId]
    if (!storageKey) return
    // For providers that allow a custom model (e.g. local Ollama with any
    // model the user has pulled), accept any non-empty string. Otherwise
    // validate against the known list.
    const provider = AI_PROVIDERS.find((p) => p.id === providerId)
    if (provider?.customModel && typeof modelId === 'string' && modelId.trim()) {
      localStorage.setItem(storageKey, modelId.trim())
      return
    }
    if (modelId && getModelsFor(providerId).some((m) => m.id === modelId)) {
      localStorage.setItem(storageKey, modelId)
    }
  } catch { /* ignore */ }
}

// Optional per-provider endpoint override (used by the local provider so the
// user can point it at Ollama, LM Studio, or any other OpenAI-compatible
// service that runs on a different port).
export function getEndpoint(providerId = getProvider()) {
  try {
    const storageKey = ENDPOINT_STORAGE_BY_PROVIDER[providerId]
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) return saved
    }
  } catch { /* ignore */ }
  return DEFAULT_ENDPOINT_BY_PROVIDER[providerId] || ''
}

export function setEndpoint(url, providerId = getProvider()) {
  try {
    const storageKey = ENDPOINT_STORAGE_BY_PROVIDER[providerId]
    if (!storageKey) return
    const cleaned = typeof url === 'string' ? url.trim().replace(/\/$/, '') : ''
    if (cleaned) localStorage.setItem(storageKey, cleaned)
    else localStorage.removeItem(storageKey)
  } catch { /* ignore */ }
}

// Endpoint builders used by the prompt loop to actually fire requests.
export function buildGeminiEndpoint(modelId) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`
}

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
