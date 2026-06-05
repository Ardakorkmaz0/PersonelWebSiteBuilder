// Browser-side Gemini integration.
//
// Bring-your-own-key model: the user pastes a Gemini API key into the editor
// Settings panel; it's persisted in localStorage and sent directly to
// generativelanguage.googleapis.com — the Django backend never sees it.
//
// Security: every tool call still flows through the store and through the
// existing client/server sanitizers (sanitize_styles, sanitize_url,
// sanitize_custom_js, ALLOWED_COMPONENT_TYPES). Worst-case the model proposes
// a javascript: href — sanitize_url drops it before save. Even if user JS were
// emitted, the public site runs it inside the same sandboxed iframe the
// hand-written Custom JS uses (allow-scripts, no allow-same-origin).

import { useEditorStore } from '../store/editorStore.js'
import { registry } from '../components/registry.jsx'

// Providers are kept side by side so the user picks whichever has free quota
// left. Groq is the default because its free tier (≈14 400 requests / day on
// Llama 3.3 70B) absorbs the editor's traffic without rate-limit pain that
// Gemini's free tier hits within minutes.
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
// to Ollama directly, so CORS / OLLAMA_ORIGINS pain goes away. The base URL
// the user wants to forward to is passed as an X-Local-Base-Url header.
const LOCAL_PROXY_PATH = '/api/ai/local'

function resolveBackendBase() {
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

function readCachedLocalModels() {
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

// Active-provider exports — back-compat for code paths that still call the
// single-provider functions from earlier iterations.
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

function buildGeminiEndpoint(modelId) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Compact snapshot of the schema the model can reason about without burning
// thousands of tokens on full style maps. Keeps ids stable so subsequent
// tool calls (update / remove) can address each component.
function schemaSnapshot() {
  const s = useEditorStore.getState()
  const briefProps = (c) => {
    const p = c.props || {}
    const keys = Object.keys(p).slice(0, 6)
    const out = {}
    for (const k of keys) {
      const v = p[k]
      if (typeof v === 'string') out[k] = v.length > 60 ? v.slice(0, 57) + '...' : v
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v
      else if (Array.isArray(v)) out[k] = `[${v.length}]`
      else out[k] = '[obj]'
    }
    return out
  }
  const briefLayout = (l) =>
    l
      ? {
          x: Math.round(l.x || 0),
          y: Math.round(l.y || 0),
          w: Math.round(l.w || 0),
          h: Math.round(l.h || 0),
        }
      : null
  const walk = (comps) =>
    (comps || []).map((c) => ({
      id: c.id,
      type: c.type,
      tabId: c.tabId,
      props: briefProps(c),
      layout: briefLayout(c.layout),
      hidden: c.hidden || undefined,
      hiddenMobile: c.hiddenMobile || undefined,
      children: Array.isArray(c.children) ? walk(c.children) : undefined,
    }))
  return {
    currentPageId: s.currentPageId,
    pages: s.schema.pages.map((p) => ({
      id: p.id,
      name: p.name,
      flowMode: p.flowMode,
      canvasWidth: p.canvasWidth,
      mobileWidth: p.mobileWidth,
      components: walk(p.components),
    })),
    theme: s.schema.theme,
    customCss: (s.schema.customCss || '').length > 0,
    customJs: (s.schema.customJs || '').length > 0,
  }
}

// Tool declarations passed to Gemini. Each maps 1:1 onto a store action.
// We expose enough surface for layout-level edits + content + styles +
// custom code, but stop short of destructive bulk ops the model might abuse.
function toolDeclarations() {
  const types = Object.keys(registry)
  return [
    {
      name: 'addComponent',
      description:
        'Add a new top-level or nested component. Returns the new component id. parentId is required when adding into a container or tabs widget.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: types, description: 'Component type from the registry.' },
          parentId: { type: 'string', description: 'Optional. id of an existing container/tabs to drop into.' },
          x: { type: 'number', description: 'Optional initial x in design pixels.' },
          y: { type: 'number', description: 'Optional initial y in design pixels.' },
        },
        required: ['type'],
      },
    },
    {
      name: 'updateProps',
      description: 'Update the props of a component. Only the keys in patch are changed.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          patch: { type: 'object', description: 'JSON object with the props to merge in.' },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'updateStyles',
      description: 'Update the inline styles of a component. CSS keys must be camelCase (backgroundColor, fontSize, ...).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          patch: { type: 'object', description: 'JSON object with the style keys/values to merge.' },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'setLayout',
      description: 'Move/resize a component. patch may contain x, y, w, h.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              w: { type: 'number' },
              h: { type: 'number' },
            },
          },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'removeComponent',
      description: 'Delete a component (and its children, if any).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'duplicateComponent',
      description: 'Duplicate a component (with a fresh id), pasted next to the original.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveToEnd',
      description:
        "Reorder a component so it renders LAST in its parent's list — i.e. at the BOTTOM of the page in flow mode. Use this for requests like 'move the navbar to the bottom'.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveToStart',
      description:
        "Reorder a component so it renders FIRST in its parent's list — i.e. at the TOP of the page in flow mode. Use this for requests like 'move the footer to the top'.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveForward',
      description:
        'Move a component one step later in document order (towards the bottom of the page in flow mode).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveBackward',
      description:
        'Move a component one step earlier in document order (towards the top of the page in flow mode).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'setActiveTab',
      description: 'For a tabs widget, switch which tab panel is shown / receives new drops.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Tabs widget id.' },
          tabId: { type: 'string', description: 'Tab id (e.g. t1, t2) from props.tabs.' },
        },
        required: ['id', 'tabId'],
      },
    },
    {
      name: 'setCustomCss',
      description: 'Replace the site-wide Custom CSS (NOT merged).',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
    {
      name: 'setCustomJs',
      description:
        'Replace the site-wide Custom JS. Runs inside a sandboxed iframe on the public site. NOT merged.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
    {
      name: 'addPage',
      description: 'Add a new page to the site. Returns its new id.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
    {
      name: 'selectPage',
      description: 'Switch the currently-edited page.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'updateTheme',
      description:
        'Patch the site theme (primaryColor, textColor, backgroundColor, fontFamily, radius, etc.). Subsequent applyTheme writes the change into already-placed components.',
      parameters: {
        type: 'object',
        properties: { patch: { type: 'object' } },
        required: ['patch'],
      },
    },
    {
      name: 'centerHorizontally',
      description:
        "Centre a component horizontally inside the page artboard (sets layout.x so that x + w/2 == canvasWidth/2). Use this for requests like 'center the heading'.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'setLinks',
      description:
        "Replace the navbar's links array. Each link is { label, href }. Hrefs starting with javascript: will be stripped on save.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Navbar component id.' },
          links: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                href: { type: 'string' },
              },
              required: ['label', 'href'],
            },
          },
        },
        required: ['id', 'links'],
      },
    },
    {
      name: 'setSelectOptions',
      description:
        "Replace the options of a select / dropdown component. `options` is an array of strings; the editor joins them with newlines internally.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          placeholder: { type: 'string', description: 'Optional placeholder text.' },
        },
        required: ['id', 'options'],
      },
    },
    {
      name: 'setTabs',
      description:
        "Replace the tabs array on a tabs widget. Each tab is { id, label }; ids must match the tabId on existing children to keep them attached. Pass new ids to create fresh tabs (children with the old ids will be orphaned).",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tabs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
              },
              required: ['id', 'label'],
            },
          },
          activeId: { type: 'string', description: 'Optional id of the tab to focus.' },
        },
        required: ['id', 'tabs'],
      },
    },
    {
      name: 'replaceComponentText',
      description:
        "Replace the visible text on a single component: works on heading/text props.text, button/linkbutton props.text, card props.title or props.text, badge/alert/list props.text.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          field: {
            type: 'string',
            enum: ['auto', 'text', 'title', 'label'],
            description: "Which prop to write to. 'auto' picks the most sensible field for the component type.",
          },
        },
        required: ['id', 'text'],
      },
    },
    {
      name: 'setHidden',
      description:
        "Show or hide a component on PC, on Mobile, or both. The component stays in the schema; only its visibility flag changes.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          hidden: { type: 'boolean', description: 'Hide on PC.' },
          hiddenMobile: { type: 'boolean', description: 'Hide on Mobile.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'clearPage',
      description:
        "Remove every component on the current page in one shot. Use this when the user says 'reset', 'clear the page', 'start over' — instead of issuing many removeComponent calls.",
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'alignComponent',
      description:
        "Snap a component's edge to one side of its parent box (artboard for top-level non-flow components, parent.layout for nested children). Mode is one of left | centerH | right | top | middleV | bottom. Use this for 'center the heading', 'right-align the button', 'put the card at the top of the container'.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          mode: {
            type: 'string',
            enum: ['left', 'centerH', 'right', 'top', 'middleV', 'bottom'],
          },
        },
        required: ['id', 'mode'],
      },
    },
    {
      name: 'distributeSiblings',
      description:
        "Even out the gaps between three or more siblings on the X or Y axis. parentId is the container/tabs id, or null for top-level. axis = 'x' (horizontal gaps) or 'y' (vertical gaps).",
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Container id, or omit for top-level.' },
          axis: { type: 'string', enum: ['x', 'y'] },
        },
        required: ['axis'],
      },
    },
    {
      name: 'applyTemplate',
      description:
        "Wipe the current page and replace it with a polished prebuilt design. Use this whenever the user asks for a named look ('GitHub style', 'dark', 'Apple-like', 'minimal landing', 'portfolio'). Internally clears the page, sets a matching theme + Custom CSS, and drops a coherent set of components (navbar, hero section, content sections, footer). Always prefer this over hand-crafting a many-step plan when the user names a style.",
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['github', 'dark', 'apple', 'minimal-landing', 'portfolio', 'blog', 'dashboard', 'marketing'],
            description: 'Which preset to apply.',
          },
        },
        required: ['name'],
      },
    },
  ]
}

// Dispatch a single tool call to the store. Each branch returns the value
// fed back to Gemini in the next round (used so the model can chain "add → set
// styles on the new id" without us having to teach it the new id beforehand).
function executeTool(rawName, args) {
  const store = useEditorStore.getState()
  const a = args || {}
  // Gemini occasionally hallucinates snake_case (add_component) or PascalCase
  // tool names. Normalise to camelCase, then sanity-check against our known
  // list; fall back to a helpful error if still unknown.
  const name = normaliseToolName(rawName)
  switch (name) {
    case 'addComponent': {
      const before = collectIds(store.schema)
      store.addComponent(a.type, Math.round(a.x || 24), Math.round(a.y || 24), a.parentId || null)
      const newId = firstNewId(collectIds(useEditorStore.getState().schema), before)
      return { ok: true, id: newId }
    }
    case 'updateProps':
      store.updateProps(a.id, a.patch || {})
      return { ok: true }
    case 'updateStyles':
      store.updateStyles(a.id, a.patch || {})
      return { ok: true }
    case 'setLayout':
      store.setLayout(a.id, a.patch || {})
      return { ok: true }
    case 'removeComponent':
      store.removeComponent(a.id)
      return { ok: true }
    case 'duplicateComponent':
      store.duplicateComponent(a.id)
      return { ok: true }
    // Store names are bringToFront / sendToBack but those are confusing in a
    // flow-mode (vertical document) context — expose them to the model as
    // moveToEnd / moveToStart instead.
    case 'moveToEnd':
      store.bringToFront(a.id)
      return { ok: true }
    case 'moveToStart':
      store.sendToBack(a.id)
      return { ok: true }
    case 'moveForward':
      store.moveForward(a.id)
      return { ok: true }
    case 'moveBackward':
      store.moveBackward(a.id)
      return { ok: true }
    case 'setActiveTab':
      store.setActiveTab(a.id, a.tabId)
      return { ok: true }
    case 'setCustomCss':
      store.setCustomCss(a.code || '')
      return { ok: true }
    case 'setCustomJs':
      store.setCustomJs(a.code || '')
      return { ok: true }
    case 'addPage': {
      const before = useEditorStore.getState().schema.pages.map((p) => p.id)
      store.addPage(a.name || 'New page')
      const after = useEditorStore.getState().schema.pages.map((p) => p.id)
      const newId = after.find((id) => !before.includes(id))
      return { ok: true, id: newId }
    }
    case 'selectPage':
      store.selectPage(a.id)
      return { ok: true }
    case 'updateTheme':
      store.updateTheme(a.patch || {})
      // The store ships theme variables via CSS — but already-placed
      // components keep their hard-coded styles until applyTheme rewrites
      // them. Auto-apply so "make everything blue" actually colours the
      // existing canvas instead of just changing future drops.
      try { store.applyTheme() } catch { /* applyTheme is optional */ }
      return { ok: true, autoApplied: true }
    case 'centerHorizontally': {
      const node = findDeep(store.schema, a.id)
      if (!node) return { ok: false, error: 'Component not found' }
      const page = store.schema.pages.find((p) => p.components.some((c) => c.id === a.id))
      const canvasW = page?.canvasWidth || 1000
      const w = Math.round(node.layout?.w || 200)
      const newX = Math.max(0, Math.round((canvasW - w) / 2))
      store.setLayout(a.id, { x: newX })
      return { ok: true, x: newX }
    }
    case 'setLinks': {
      const links = Array.isArray(a.links) ? a.links.map((l) => ({
        label: String(l?.label || ''),
        href: String(l?.href || ''),
      })) : []
      store.updateProps(a.id, { links })
      return { ok: true, count: links.length }
    }
    case 'setSelectOptions': {
      const opts = Array.isArray(a.options) ? a.options.map((s) => String(s)) : []
      const patch = { options: opts.join('\n') }
      if (typeof a.placeholder === 'string') patch.placeholder = a.placeholder
      store.updateProps(a.id, patch)
      return { ok: true, count: opts.length }
    }
    case 'setTabs': {
      const tabs = Array.isArray(a.tabs) ? a.tabs.map((t) => ({
        id: String(t?.id || ''),
        label: String(t?.label || ''),
      })).filter((t) => t.id) : []
      const patch = { tabs }
      if (typeof a.activeId === 'string') patch.activeId = a.activeId
      else if (tabs.length) patch.activeId = tabs[0].id
      store.updateProps(a.id, patch)
      return { ok: true, count: tabs.length }
    }
    case 'replaceComponentText': {
      const node = findDeep(store.schema, a.id)
      if (!node) return { ok: false, error: 'Component not found' }
      const field = pickTextField(node.type, a.field || 'auto')
      if (!field) return { ok: false, error: `No editable text field on ${node.type}` }
      store.updateProps(a.id, { [field]: String(a.text || '') })
      return { ok: true, field }
    }
    case 'setHidden': {
      const patch = {}
      if (typeof a.hidden === 'boolean') patch.hidden = a.hidden
      if (typeof a.hiddenMobile === 'boolean') patch.hiddenMobile = a.hiddenMobile
      if (!Object.keys(patch).length) return { ok: false, error: 'Provide hidden or hiddenMobile' }
      store.setVisibility(a.id, patch)
      return { ok: true }
    }
    case 'alignComponent':
      store.alignComponent(a.id, a.mode)
      return { ok: true }
    case 'distributeSiblings':
      store.distributeSiblings(a.parentId || null, a.axis === 'x' ? 'x' : 'y')
      return { ok: true }
    case 'clearPage': {
      const before = useEditorStore.getState()
      const page = before.schema.pages.find((p) => p.id === before.currentPageId)
      const ids = (page?.components || []).map((c) => c.id)
      ids.forEach((id) => store.removeComponent(id))
      return { ok: true, removed: ids.length }
    }
    case 'applyTemplate': {
      const tpl = TEMPLATES[a.name]
      if (!tpl) return { ok: false, error: `Unknown template "${a.name}". Choose one of: ${Object.keys(TEMPLATES).join(', ')}` }
      // 1) wipe the page first so existing components don't leak.
      const before0 = useEditorStore.getState()
      const page0 = before0.schema.pages.find((p) => p.id === before0.currentPageId)
      ;(page0?.components || []).map((c) => c.id).forEach((id) => store.removeComponent(id))
      // 2) force HTML Flow mode. addComponent on a non-flow page drops every
      // new node at (24,24) → templates with no explicit positions used to
      // stack on top of each other and looked broken. Flow mode lets flex
      // stack them naturally in document order.
      const refreshed = useEditorStore.getState()
      const currentPage = refreshed.schema.pages.find((p) => p.id === refreshed.currentPageId)
      if (currentPage && !currentPage.flowMode) {
        try { store.enableFlowMode() } catch { /* ignore */ }
      }
      // 3) theme + custom css
      if (tpl.theme) {
        store.updateTheme(tpl.theme)
        try { store.applyTheme() } catch { /* ignore */ }
      }
      if (typeof tpl.customCss === 'string') store.setCustomCss(tpl.customCss)
      // 4) build the component tree top-down. Track newest id so we can patch
      // props after creation.
      const created = {}
      for (const step of tpl.steps || []) {
        const beforeIds = collectIds(useEditorStore.getState().schema)
        store.addComponent(step.type, step.x || 0, step.y || 0, step.parentId ? created[step.parentId] : null)
        const newId = firstNewId(collectIds(useEditorStore.getState().schema), beforeIds)
        if (newId) {
          if (step.alias) created[step.alias] = newId
          if (step.props) store.updateProps(newId, step.props)
          if (step.styles) store.updateStyles(newId, step.styles)
          if (step.layout) store.setLayout(newId, step.layout)
        }
      }
      return { ok: true, template: a.name, componentsCreated: Object.keys(created).length }
    }
    default:
      return { ok: false, error: `Unknown tool "${rawName}" (normalised to "${name}"). Use one of the declared tool names exactly.` }
  }
}

// Named look presets. Each is { theme, customCss, steps[] } where steps are
// applied to a freshly-cleared page. The model can call applyTemplate('github')
// for a coherent result in one tool call instead of orchestrating many.
const TEMPLATES = {
  github: {
    theme: {
      primaryColor: '#2da44e',
      textColor: '#1f2328',
      mutedColor: '#656d76',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      softColor: '#f6f8fa',
      headerColor: '#24292f',
      headerTextColor: '#ffffff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      radius: '6px',
      buttonRadius: '6px',
      shadow: '0 1px 0 rgba(31,35,40,.04), 0 1px 3px rgba(140,149,159,.15)',
    },
    customCss: `body { background: #ffffff; }
.rh-card, .card { border: 1px solid #d0d7de !important; box-shadow: none !important; }
.rh-btn { font-weight: 500 !important; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }`,
    steps: [
      { type: 'navbar', alias: 'nav', props: { brand: 'My Project', links: [
        { label: 'Code', href: '#code' },
        { label: 'Issues', href: '#issues' },
        { label: 'Pull requests', href: '#pulls' },
        { label: 'Actions', href: '#actions' },
      ] } },
      { type: 'section', alias: 'hero', props: { heading: 'Build better software, together.' }, styles: { backgroundColor: '#f6f8fa', padding: '64px 40px', textAlign: 'left' } },
      { type: 'heading', props: { text: 'Your one-stop platform for code, collaboration, and shipping.', level: 'h2' }, styles: { fontSize: '36px', fontWeight: '600', color: '#1f2328' } },
      { type: 'text', props: { text: 'Plan, build, and ship with the tools your team already knows. Free for individuals and small teams.' }, styles: { color: '#656d76', fontSize: '18px', maxWidth: '640px' } },
      { type: 'button', props: { text: 'Sign up for free', href: '#signup' }, styles: { backgroundColor: '#2da44e', color: '#ffffff', borderRadius: '6px', padding: '12px 24px' } },
      { type: 'section', props: { heading: 'Why teams choose us' }, styles: { padding: '48px 40px', backgroundColor: '#ffffff' } },
      { type: 'card', props: { title: 'Code review', text: 'Pull requests make collaboration on changes simple.' }, styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: '#d0d7de', borderRadius: '6px', boxShadow: 'none' } },
      { type: 'card', props: { title: 'Project planning', text: 'Track work with issues and boards your team will actually use.' }, styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: '#d0d7de', borderRadius: '6px', boxShadow: 'none' } },
      { type: 'card', props: { title: 'CI / CD', text: 'Automate testing and deployment with workflows.' }, styles: { borderWidth: '1px', borderStyle: 'solid', borderColor: '#d0d7de', borderRadius: '6px', boxShadow: 'none' } },
    ],
  },
  dark: {
    theme: {
      primaryColor: '#3b82f6',
      textColor: '#e6edf3',
      mutedColor: '#7d8590',
      backgroundColor: '#0d1117',
      surfaceColor: '#161b22',
      softColor: '#21262d',
      headerColor: '#010409',
      headerTextColor: '#e6edf3',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: '8px',
      buttonRadius: '8px',
      shadow: '0 8px 24px rgba(0,0,0,.5)',
    },
    customCss: `body { background: #0d1117; color: #e6edf3; }
.rh-card, .card { background: #161b22 !important; border: 1px solid #30363d !important; color: #e6edf3 !important; }
a { color: #58a6ff; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Studio', links: [
        { label: 'Home', href: '#home' },
        { label: 'Work', href: '#work' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ] } },
      { type: 'section', props: { heading: 'Beautiful things, built in the dark.' }, styles: { backgroundColor: '#0d1117', padding: '96px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Design that disappears, work that stands out.', level: 'h1' }, styles: { color: '#e6edf3', fontSize: '52px', fontWeight: '600', textAlign: 'center' } },
      { type: 'text', props: { text: 'A studio practice focused on calm, considered software.' }, styles: { color: '#7d8590', fontSize: '18px', textAlign: 'center' } },
      { type: 'button', props: { text: 'See our work', href: '#work' }, styles: { backgroundColor: '#3b82f6', color: '#ffffff', borderRadius: '8px', padding: '12px 28px' } },
    ],
  },
  apple: {
    theme: {
      primaryColor: '#0071e3',
      textColor: '#1d1d1f',
      mutedColor: '#86868b',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      softColor: '#f5f5f7',
      headerColor: '#000000',
      headerTextColor: '#f5f5f7',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      radius: '18px',
      buttonRadius: '980px',
      shadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
    customCss: `body { background: #ffffff; }
.rh-card, .card { border: 0 !important; }`,
    steps: [
      { type: 'navbar', props: { brand: '', links: [
        { label: 'Store', href: '#store' },
        { label: 'Mac', href: '#mac' },
        { label: 'iPhone', href: '#iphone' },
        { label: 'Watch', href: '#watch' },
        { label: 'Support', href: '#support' },
      ] }, styles: { backgroundColor: '#000000', color: '#f5f5f7', padding: '12px 28px', fontSize: '14px' } },
      { type: 'section', props: { heading: 'iPhone' }, styles: { backgroundColor: '#000000', color: '#f5f5f7', padding: '80px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Pro. Beyond.', level: 'h1' }, styles: { color: '#f5f5f7', fontSize: '72px', fontWeight: '600', textAlign: 'center', letterSpacing: '-0.03em' } },
      { type: 'text', props: { text: 'A magical new way to do everything.' }, styles: { color: '#a1a1a6', fontSize: '24px', textAlign: 'center' } },
      { type: 'button', props: { text: 'Learn more', href: '#learn' }, styles: { backgroundColor: '#0071e3', color: '#ffffff', borderRadius: '980px', padding: '12px 22px', fontSize: '17px' } },
    ],
  },
  'minimal-landing': {
    theme: {
      primaryColor: '#111111',
      textColor: '#1a1a1a',
      mutedColor: '#737373',
      backgroundColor: '#fafafa',
      surfaceColor: '#ffffff',
      softColor: '#f4f4f5',
      headerColor: '#fafafa',
      headerTextColor: '#111111',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '2px',
      buttonRadius: '2px',
      shadow: 'none',
    },
    customCss: `body { background: #fafafa; letter-spacing: -0.01em; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Acme', links: [
        { label: 'Product', href: '#product' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Login', href: '#login' },
      ] }, styles: { backgroundColor: '#fafafa', color: '#111111', padding: '20px 40px' } },
      { type: 'section', styles: { backgroundColor: '#fafafa', padding: '120px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Ship faster. Iterate calmer.', level: 'h1' }, styles: { color: '#111111', fontSize: '60px', fontWeight: '600', textAlign: 'center' } },
      { type: 'text', props: { text: 'A no-nonsense way to build the next iteration of your product.' }, styles: { color: '#737373', fontSize: '20px', textAlign: 'center' } },
      { type: 'button', props: { text: 'Get started', href: '#start' }, styles: { backgroundColor: '#111111', color: '#ffffff', borderRadius: '2px', padding: '14px 28px' } },
    ],
  },
  portfolio: {
    theme: {
      primaryColor: '#2563eb',
      textColor: '#1d1d1f',
      mutedColor: '#6e6e73',
      backgroundColor: '#ffffff',
      surfaceColor: '#ffffff',
      softColor: '#f5f5f7',
      headerColor: '#1d1d1f',
      headerTextColor: '#f5f5f7',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '12px',
      buttonRadius: '999px',
      shadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
    customCss: '',
    steps: [
      { type: 'navbar', props: { brand: 'Jane Doe', links: [
        { label: 'Work', href: '#work' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ] } },
      { type: 'section', props: { heading: '' }, styles: { backgroundColor: '#f5f5f7', padding: '96px 40px', textAlign: 'left' } },
      { type: 'heading', props: { text: 'Hi, I’m Jane — a product designer based in Istanbul.', level: 'h1' }, styles: { fontSize: '48px', fontWeight: '600' } },
      { type: 'text', props: { text: 'I help teams turn complex problems into calm, usable interfaces.' }, styles: { color: '#6e6e73', fontSize: '20px', maxWidth: '600px' } },
      { type: 'button', props: { text: 'See my work', href: '#work' }, styles: { backgroundColor: '#2563eb', color: '#ffffff' } },
      { type: 'card', props: { title: 'Project Alpha', text: 'A dashboard for analytics teams. Reduced time-to-insight by 40%.' } },
      { type: 'card', props: { title: 'Project Beta', text: 'A consumer mobile app for habit tracking. 5⭐ in App Store.' } },
      { type: 'card', props: { title: 'Project Gamma', text: 'Brand and website refresh for a Series A startup.' } },
    ],
  },
  blog: {
    theme: {
      primaryColor: '#9333ea',
      textColor: '#1a1a1a',
      mutedColor: '#737373',
      backgroundColor: '#fafafa',
      surfaceColor: '#ffffff',
      softColor: '#f4f4f5',
      headerColor: '#1a1a1a',
      headerTextColor: '#fafafa',
      fontFamily: "Georgia, 'Times New Roman', serif",
      radius: '4px',
      buttonRadius: '4px',
      shadow: '0 1px 3px rgba(0,0,0,.05)',
    },
    customCss: `body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; }
.rh-card, .card { border: 0 !important; box-shadow: none !important; border-bottom: 1px solid #e5e5e5 !important; border-radius: 0 !important; }
h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; letter-spacing: -0.01em; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Daily Notes', links: [
        { label: 'Latest', href: '#latest' },
        { label: 'Archive', href: '#archive' },
        { label: 'About', href: '#about' },
        { label: 'Subscribe', href: '#subscribe' },
      ] } },
      { type: 'section', styles: { backgroundColor: '#fafafa', padding: '72px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Daily Notes', level: 'h1' }, styles: { fontSize: '56px', fontWeight: '700', textAlign: 'center', letterSpacing: '-0.02em' } },
      { type: 'text', props: { text: 'Writing on design, software, and the quiet craft of building things.' }, styles: { color: '#737373', fontSize: '20px', textAlign: 'center', fontStyle: 'italic' } },
      { type: 'heading', props: { text: 'Latest posts', level: 'h2' }, styles: { fontSize: '28px', fontWeight: '700', padding: '24px 40px 8px' } },
      { type: 'card', props: { title: 'On naming things', text: 'A short essay on why naming is the hardest problem in software — and what to do about it.  ·  June 4, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'card', props: { title: 'Design without designers', text: 'How small engineering teams can ship beautiful products without a dedicated design team.  ·  May 28, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'card', props: { title: 'The case for boring stacks', text: 'Why the most exciting engineering decision you can make is to pick the boring tool everyone already knows.  ·  May 19, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'card', props: { title: 'Slow software', text: 'Notes on building software that respects the user’s attention — and the team’s sanity.  ·  May 7, 2026' }, styles: { padding: '24px 40px', borderRadius: '0' } },
      { type: 'section', styles: { backgroundColor: '#f4f4f5', padding: '40px', textAlign: 'center' } },
      { type: 'text', props: { text: 'Get new posts in your inbox — once a week, no spam.' }, styles: { color: '#1a1a1a', fontSize: '18px', textAlign: 'center' } },
      { type: 'button', props: { text: 'Subscribe', href: '#subscribe' }, styles: { backgroundColor: '#9333ea', color: '#ffffff' } },
    ],
  },
  dashboard: {
    theme: {
      primaryColor: '#2563eb',
      textColor: '#0f172a',
      mutedColor: '#64748b',
      backgroundColor: '#f8fafc',
      surfaceColor: '#ffffff',
      softColor: '#f1f5f9',
      headerColor: '#0f172a',
      headerTextColor: '#f8fafc',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '8px',
      buttonRadius: '8px',
      shadow: '0 1px 2px rgba(15,23,42,.05), 0 2px 8px rgba(15,23,42,.05)',
    },
    customCss: `.rh-card, .card { border: 1px solid #e2e8f0 !important; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Acme Console', links: [
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Customers', href: '#customers' },
        { label: 'Reports', href: '#reports' },
        { label: 'Settings', href: '#settings' },
      ] } },
      { type: 'section', props: { heading: 'Dashboard' }, styles: { backgroundColor: '#f8fafc', padding: '40px 40px 16px' } },
      { type: 'text', props: { text: 'A quick summary of how the business is doing this week.' }, styles: { color: '#64748b', padding: '0 40px 24px' } },
      { type: 'card', props: { title: 'Revenue', text: '$84,920  ·  +12.4% vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'card', props: { title: 'New signups', text: '1,284  ·  +6.1% vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'card', props: { title: 'Active users', text: '23,402  ·  +2.8% vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'card', props: { title: 'Churn', text: '2.1%  ·  −0.3pp vs last week' }, styles: { padding: '20px 24px' } },
      { type: 'heading', props: { text: 'Recent activity', level: 'h3' }, styles: { fontSize: '20px', fontWeight: '600', padding: '24px 40px 8px' } },
      { type: 'card', props: { title: 'New customer: Northwind Ltd', text: 'Signed up on the Pro plan — $2,400 ARR.' } },
      { type: 'card', props: { title: 'Plan upgrade: Foo Inc', text: 'Moved from Pro to Enterprise — +$36,000 ARR.' } },
      { type: 'card', props: { title: 'Cancellation: Acme Co', text: 'Cancelled after 14 months — $4,800 ARR churn.' } },
    ],
  },
  marketing: {
    theme: {
      primaryColor: '#ea580c',
      textColor: '#1c1917',
      mutedColor: '#78716c',
      backgroundColor: '#fef7ed',
      surfaceColor: '#ffffff',
      softColor: '#fed7aa',
      headerColor: '#1c1917',
      headerTextColor: '#fef7ed',
      fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      radius: '12px',
      buttonRadius: '12px',
      shadow: '0 12px 24px rgba(234,88,12,.15)',
    },
    customCss: `.rh-btn { font-weight: 700 !important; padding: 14px 32px !important; }`,
    steps: [
      { type: 'navbar', props: { brand: 'Sunlight', links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Customers', href: '#customers' },
        { label: 'Sign in', href: '#signin' },
      ] } },
      { type: 'section', styles: { backgroundColor: '#fef7ed', padding: '120px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Sunlight makes your team radiant.', level: 'h1' }, styles: { color: '#1c1917', fontSize: '60px', fontWeight: '700', textAlign: 'center' } },
      { type: 'text', props: { text: 'The simplest way to plan, ship, and celebrate the work your team is doing — together.' }, styles: { color: '#78716c', fontSize: '22px', textAlign: 'center', maxWidth: '640px' } },
      { type: 'button', props: { text: 'Start free trial', href: '#trial' }, styles: { backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '12px' } },
      { type: 'section', props: { heading: 'Built for teams that ship.' }, styles: { backgroundColor: '#ffffff', padding: '64px 40px' } },
      { type: 'card', props: { title: 'Faster planning', text: 'Roadmaps, sprints, and pivots — all in one place.' } },
      { type: 'card', props: { title: 'Effortless reporting', text: 'Auto-generated status updates so you never write another spreadsheet.' } },
      { type: 'card', props: { title: 'Calmer launches', text: 'Coordinate launches across product, marketing, and support without the chaos.' } },
      { type: 'section', styles: { backgroundColor: '#1c1917', padding: '80px 40px', textAlign: 'center' } },
      { type: 'heading', props: { text: 'Ready to make this week your best one yet?', level: 'h2' }, styles: { color: '#fef7ed', fontSize: '36px', fontWeight: '700', textAlign: 'center' } },
      { type: 'button', props: { text: 'Try Sunlight free', href: '#trial' }, styles: { backgroundColor: '#ea580c', color: '#ffffff' } },
    ],
  },
}

// snake_case / kebab-case / PascalCase / spaces → camelCase.
function normaliseToolName(raw) {
  if (typeof raw !== 'string') return ''
  let s = raw.trim().replace(/[\s_-]+/g, '_')
  // Convert each chunk after the first to TitleCase, first stays lowercase.
  const parts = s.split('_').filter(Boolean)
  if (!parts.length) return ''
  return [
    parts[0].charAt(0).toLowerCase() + parts[0].slice(1),
    ...parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)),
  ].join('')
}

function findDeep(schema, id) {
  const walk = (arr) => {
    for (const c of arr || []) {
      if (c.id === id) return c
      if (Array.isArray(c.children)) {
        const f = walk(c.children)
        if (f) return f
      }
    }
    return null
  }
  for (const p of schema?.pages || []) {
    const f = walk(p.components)
    if (f) return f
  }
  return null
}

// Map a component type + caller hint to the prop name that holds its main
// visible text. Used by replaceComponentText so the AI doesn't have to
// remember per-type field names.
function pickTextField(type, hint) {
  if (hint && hint !== 'auto') return hint
  switch (type) {
    case 'heading':
    case 'text':
    case 'button':
    case 'linkbutton':
    case 'badge':
    case 'alert':
    case 'list':
    case 'quote':
      return 'text'
    case 'card':
      return 'title'
    case 'input':
    case 'select':
      return 'label'
    default:
      return null
  }
}

function collectIds(schema) {
  const ids = []
  const walk = (arr) => {
    for (const c of arr || []) {
      ids.push(c.id)
      if (Array.isArray(c.children)) walk(c.children)
    }
  }
  for (const p of schema.pages || []) walk(p.components)
  return new Set(ids)
}

function firstNewId(after, before) {
  for (const id of after) if (!before.has(id)) return id
  return null
}

const SYSTEM_PROMPT = `You are an editing assistant inside a no-code website builder. Each turn the user either (a) describes a change they want to the design, or (b) asks a conversational / meta question about what you can do. Detect which one this is BEFORE acting.

If (a) — a request for change — you MUST use the provided tools by emitting a real tool call. Do NOT paste the call as JSON text inside your reply (the runtime ignores text-mode calls). Output the call through the proper function-calling channel, not as a code block or paragraph.
If (b) — a conversational question like "what can you do?", "what templates are there?", "which model is this?" — answer with one short paragraph of plain text, DO NOT call any tools, DO NOT clear the page, DO NOT apply a template. List a few example things the user could ask next.

Examples of (b) phrasings to watch for: "neler yapabilirsin", "ne yapabilirsin", "what can you do", "help", "list templates", "show me templates", "options".

Rules:
- All user-facing UI text and content you generate must be in English, even if the user writes in another language. Translate user-provided text into English before placing it.
- Use the available tools — never reply with code blocks or markdown describing what to do. Either call tools, or, after you have already applied the change, send one short sentence confirming what you did.
- Read the schema snapshot for the current state. Reference existing components by their id when modifying them.
- **NO DUPLICATES.** Before calling addComponent, scan the snapshot for an existing component of the same role (only one navbar per page, one hero section, one footer, etc.). If one exists, MODIFY it via updateProps / replaceComponentText / setLinks instead of adding a new one. The user almost never wants two navbars stacked.
- Tool names are camelCase exactly as declared — addComponent, updateProps, setLinks — NEVER add_component or add-component or AddComponent.
- Components that hold children (container, tabs) require parentId when adding INTO them.
- CSS keys are camelCase (backgroundColor, fontSize). Hrefs starting with javascript: will be dropped by the server; use http(s):// or #anchor.
- For Custom JS code, keep it self-contained and small; the public site runs it inside a sandboxed iframe so there is no editor app access.

**For named looks or kinds of site, ALWAYS prefer applyTemplate over manually adding components.** It clears the page, switches to HTML Flow mode, applies a tuned theme + CSS + 5-12 polished components in one call. Available names and the user phrases they cover:
- github → "GitHub", "open source repo style"
- dark → "dark mode", "studio dark"
- apple → "Apple", "iPhone product page"
- minimal-landing → "minimal", "saas landing"
- portfolio → "portfolio", "personal site", fan/topic pages (Star Wars, Marvel, a band, a hobby)
- blog → "blog", "blog site" ("blog sitesi"), "writer", "personal blog", "newsletter"
- dashboard → "admin dashboard", "internal tool", "analytics console"
- marketing → "marketing site", "product launch", "landing page with CTA"
Pick the closest one to the user's intent and call applyTemplate({name:'...'}).

**CRITICAL: applyTemplate MUST be the only tool call in its response.** applyTemplate clears the page and creates brand-new components with brand-new IDs. If you emit applyTemplate together with replaceComponentText / setLinks / updateProps in the same parallel batch, those follow-up calls will target the OLD component IDs from the current snapshot — IDs that no longer exist after applyTemplate runs — and they will silently fail. The runtime will detect this and force you to redo them, wasting a round.

The right pattern is two responses:
- Response 1 (this turn): exactly one tool call, applyTemplate({name:'...'}). Nothing else. No text, no other tools.
- Response 2 (next turn): you will receive a fresh schema snapshot listing the real new component IDs. THEN emit your customisation tool calls (setLinks for the navbar, replaceComponentText / updateProps for each heading / text / button / card title) so every visible default placeholder is replaced with topic-relevant copy. Do not stop until every default string has been customised.

Worked example — user asks "make a Star Wars fan page":
Response 1: applyTemplate({name:"portfolio"})   ← single tool call, nothing else
Response 2 (after seeing the new schema):
   - setLinks({id: navbar_id, links:[{label:"Galaxy", href:"#galaxy"},{label:"Heroes", href:"#heroes"},{label:"Villains", href:"#villains"},{label:"Episodes", href:"#episodes"}]})
   - replaceComponentText({id: heading_id, text: "A galaxy far, far away."})
   - replaceComponentText({id: text_id, text: "A fan-built tribute to the Skywalker saga and the worlds beyond."})
   - replaceComponentText({id: button_id, text: "Explore the galaxy"})
   - replaceComponentText({id: card1_id, text: "Episode IV — A New Hope · The original 1977 film that started it all."})
   - …and so on for every component.
Response 3: one short sentence summarising what you did.

Apply the same pattern for ANY topic the user names (Marvel, food blog, gym, vintage cars, indie band, etc.). The user almost never wants the default template copy.

How to apply WIDE / GLOBAL changes:
- When the user says "all", "every", "everything", or "site-wide" — DO NOT call a single tool and stop. Iterate: for a colour theme change call updateTheme(...) (e.g. {"primaryColor":"#2563eb","headerColor":"#1d4ed8"}); the editor automatically applies the theme to already-placed components, so you don't need to touch every id by hand UNLESS the user asked for something theme-vars don't cover.
- For named looks ("GitHub style", "dark mode", "Apple-like", "neon") — set the theme to a matching palette via updateTheme AND tweak the most visible blocks (navbar, cards, buttons) via updateStyles AND optionally finish with setCustomCss for fonts, scrollbars, hover states.
- When the user asks to colour a single visible component (e.g. "make the button red"), use updateStyles(id, {backgroundColor:"#ef4444", color:"#fff"}) on that component's id from the schema snapshot.
- If multiple components need to change individually (e.g. "make all card backgrounds dark"), emit one updateStyles call per matching id from the snapshot.

How to REORDER components (flow / HTML Flow mode):
- "Move X to the bottom / end" → moveToEnd(id). NEVER use setLayout for reorder — y coordinates do not control flow order.
- "Move X to the top / start" → moveToStart(id).
- "Send X one row up / down" → moveBackward(id) / moveForward(id).
- The navbar usually sits at the top because it is the first component in the array. Reordering it via moveToEnd puts it visually at the bottom.

How to use the SPECIALISED content tools (preferred over updateProps for these):
- Navbar links: setLinks(navbarId, [{label, href}, ...])
- Select / dropdown options: setSelectOptions(id, ['Option A','Option B',...], placeholder?)
- Tabs widget tabs: setTabs(tabsId, [{id,label},...], activeId?)
- "Change the heading to X" / "rename the button to Y": replaceComponentText(id, "...") — picks the right prop automatically.
- "Hide X on mobile" / "show X again": setHidden(id, { hidden?, hiddenMobile? }).

LAYOUT reasoning:
- The schema snapshot includes layout = {x,y,w,h} in design pixels for every component. canvasWidth (default 1000) is on each page.
- "Center the heading horizontally" → alignComponent(id, 'centerH') or centerHorizontally(id) (both work).
- "Right-align the button" / "snap X to the right edge" → alignComponent(id, 'right').
- "Vertically center inside the container" → alignComponent(id, 'middleV') (use the parent container's id space).
- "Make the buttons the same width" → setLayout on each id with the same w.
- "Move X 40 pixels to the right" → setLayout(id, { x: currentX + 40 }) using the snapshot's current x.
- "Distribute the cards evenly" → distributeSiblings(parentId, 'y') for a column, 'x' for a row. Needs 3+ siblings.

Worked examples for common requests:
- "Make a GitHub-style design" → updateTheme({"primaryColor":"#2da44e","textColor":"#1f2328","backgroundColor":"#ffffff","headerColor":"#24292f","headerTextColor":"#ffffff","fontFamily":"-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif","radius":"6px","buttonRadius":"6px"}) then optionally setCustomCss with monospace overrides.
- "Make the site dark" → updateTheme({"backgroundColor":"#0d1117","textColor":"#e6edf3","headerColor":"#161b22","headerTextColor":"#e6edf3","surfaceColor":"#161b22","softColor":"#21262d","mutedColor":"#7d8590"}).
- "Add a hero" → addComponent('section') → updateProps(id, {heading:'Welcome'}) → addComponent('heading') → addComponent('button') (using the section's id as parentId where applicable).

Behavioural rules:
- If the user request is ambiguous, pick reasonable defaults (English copy, common sizes, named CSS colours converted to hex like blue=#2563eb, red=#ef4444, green=#22c55e) and proceed — never stop to ask a question; the user will iterate.
- After applying the changes, end with ONE concise sentence summarising what you did (e.g. "Updated the site theme to a blue palette.").`

// Parse Google's RetryInfo block (RFC-style "30s") into milliseconds, falling
// back to a reasonable default. Used so the auto-retry sleeps exactly the
// amount Google asked for instead of a guess.
function parseRetryDelayMs(parsed, defaultMs) {
  try {
    const details = parsed?.error?.details || []
    for (const d of details) {
      const t = d?.['@type'] || ''
      if (t.endsWith('RetryInfo') && typeof d.retryDelay === 'string') {
        const m = d.retryDelay.match(/(\d+(?:\.\d+)?)s/)
        if (m) return Math.round(parseFloat(m[1]) * 1000)
      }
    }
  } catch { /* ignore */ }
  return defaultMs
}

// Map a raw provider error blob to a one-line, human-friendly message that
// fits the chat panel without overwhelming the user with JSON. `providerId`
// drives the wording (so a Groq 429 doesn't say "Gemini quota hit").
function describeApiError(status, rawText, providerId = getProvider()) {
  let parsed
  try { parsed = JSON.parse(rawText) } catch { parsed = null }
  const apiMessage = parsed?.error?.message || parsed?.error?.error || ''
  const me = AI_PROVIDERS.find((p) => p.id === providerId)
  const meLabel = me?.label?.replace(/ \(.*\)$/, '') || 'AI provider'
  const other = AI_PROVIDERS.find((p) => p.id !== providerId)
  const otherLabel = other?.label?.replace(/ \(.*\)$/, '') || 'the other provider'
  // OpenRouter retires free models from time to time. When that happens the
  // message is "No endpoints found for <model>" — point the user at Settings
  // instead of leaving them puzzled.
  if (/no endpoints found/i.test(apiMessage)) {
    return `${meLabel} retired the selected model. Open Settings → Model dropdown and pick a fresh one (DeepSeek V3 0324 free is the safe default), or paste any current id from openrouter.ai/models.`
  }
  if (status === 429) {
    const waitMs = parseRetryDelayMs(parsed, 30_000)
    const waitSec = Math.ceil(waitMs / 1000)
    return `${meLabel} quota hit (per-minute or per-day). Wait ~${waitSec}s and try again, or switch to ${otherLabel} in Settings (Properties → AI Assistant).`
  }
  if (status === 400 && /api key|invalid/i.test(apiMessage)) {
    return `Your ${meLabel} API key is invalid or missing the right permissions. Re-paste it in Settings.`
  }
  if (status === 401) {
    return `Your ${meLabel} API key was rejected (401). Open Settings → AI Assistant and paste a fresh key.`
  }
  if (status === 403) {
    return `Your ${meLabel} API key was rejected (403). Check that the key is active and has the Generative Language / Chat Completions API enabled.`
  }
  if (status >= 500) {
    return `${meLabel} is having trouble right now (${status}). Try again in a moment or switch to ${otherLabel}.`
  }
  return apiMessage || `${meLabel} ${status}: ${rawText.slice(0, 200)}`
}

// Universal turn shape we hand around so the rest of the file doesn't have to
// care which provider it talks to. Each "turn" is either:
//   { role: 'user'|'model', text }                       (text turn)
//   { role: 'model', functionCalls: [{name, args}] }     (model tool calls)
//   { role: 'tool', toolResults: [{name, response}] }    (our tool outputs)
// callProvider() translates this into the right wire shape and translates the
// response back into a list of `parts` shaped like Gemini's (so the calling
// loop is unchanged).

async function callProvider(apiKey, history, currentTurnText) {
  const provider = getProvider()
  if (provider === 'groq') return callGroq(apiKey, history, currentTurnText)
  if (provider === 'openrouter') return callOpenRouter(apiKey, history, currentTurnText)
  if (provider === 'local') return callLocal(apiKey, history, currentTurnText)
  return callGemini(apiKey, history, currentTurnText)
}

// ---- Gemini transport --------------------------------------------------
async function callGemini(apiKey, history, currentTurnText) {
  const modelId = getModel('gemini')
  const url = `${buildGeminiEndpoint(modelId)}?key=${encodeURIComponent(apiKey)}`
  const contents = historyToGeminiContents(history, currentTurnText)
  const body = JSON.stringify({
    systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: toolDeclarations() }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { temperature: 0.2 },
  })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) {
      const data = await res.json()
      const candidate = data?.candidates?.[0]
      return candidate?.content?.parts || []
    }
    const text = await res.text()
    if (res.status === 429 && attempt === 0) {
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = null }
      const waitMs = Math.min(8000, parseRetryDelayMs(parsed, 4000))
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    throw new Error(describeApiError(res.status, text, 'gemini'))
  }
  throw new Error('Gemini did not respond after the retry. Please try again.')
}

function historyToGeminiContents(history, currentTurnText) {
  const out = []
  for (const turn of history) {
    if (turn.role === 'user' && typeof turn.text === 'string') {
      out.push({ role: 'user', parts: [{ text: turn.text }] })
    } else if (turn.role === 'model' && Array.isArray(turn.functionCalls)) {
      out.push({
        role: 'model',
        parts: turn.functionCalls.map((c) => ({ functionCall: { name: c.name, args: c.args || {} } })),
      })
    } else if (turn.role === 'model' && typeof turn.text === 'string') {
      out.push({ role: 'model', parts: [{ text: turn.text }] })
    } else if (turn.role === 'tool' && Array.isArray(turn.toolResults)) {
      out.push({
        role: 'user',
        parts: turn.toolResults.map((r) => ({ functionResponse: { name: r.name, response: r.response } })),
      })
    }
  }
  if (currentTurnText) {
    out.push({ role: 'user', parts: [{ text: currentTurnText }] })
  }
  return out
}

// ---- Generic OpenAI-compatible transport -------------------------------
// Shared by Groq and the local Ollama / LM Studio path. `opts.url` is the
// chat-completions endpoint, `opts.apiKey` is optional (local providers may
// not need one), `opts.providerId` is just used for friendly error wording.
async function callOpenAICompatible(history, currentTurnText, opts) {
  const messages = historyToOpenAiMessages(history, currentTurnText)
  const body = JSON.stringify({
    model: opts.modelId,
    messages,
    tools: toolDeclarations().map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
    temperature: 0.2,
    ...(opts.extraBody || {}),
  })
  const headers = { 'Content-Type': 'application/json', ...(opts.extraHeaders || {}) }
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res
    try {
      res = await fetch(opts.url, { method: 'POST', headers, body })
    } catch (e) {
      // Network-level failure (typical for unreachable local servers /
      // missing CORS headers). Give the user a hint they can actually act on.
      if (opts.providerId === 'local') {
        throw new Error(
          `Could not reach the local AI at ${opts.url}. Make sure Ollama (or LM Studio) is running and started with OLLAMA_ORIGINS="*" so the browser can call it.`,
        )
      }
      throw new Error(e?.message || 'Network error')
    }
    if (res.ok) {
      const data = await res.json()
      const choice = data?.choices?.[0]?.message
      if (!choice) return []
      const parts = []
      if (Array.isArray(choice.tool_calls)) {
        for (const tc of choice.tool_calls) {
          let args = {}
          try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {} } catch { args = {} }
          parts.push({ functionCall: { name: tc.function?.name || '', args } })
        }
      }
      // Some local models (Llama 3.1 8B in particular) "think aloud" and
      // print the intended call as JSON inside the assistant text instead of
      // using the tool_calls field. Recover those so the canvas still
      // updates. If we extract any call from the text we DROP the original
      // text so the chat doesn't show both the JSON and the action.
      if (parts.length === 0 && typeof choice.content === 'string' && choice.content.trim()) {
        const recovered = extractTextCalls(choice.content)
        if (recovered.length) {
          for (const r of recovered) parts.push({ functionCall: r })
        } else {
          parts.push({ text: choice.content })
        }
      } else if (typeof choice.content === 'string' && choice.content.trim()) {
        parts.push({ text: choice.content })
      }
      return parts
    }
    const text = await res.text()
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 4000))
      continue
    }
    throw new Error(describeApiError(res.status, text, opts.providerId))
  }
  throw new Error(`${opts.providerId} did not respond after the retry. Please try again.`)
}

async function callGroq(apiKey, history, currentTurnText) {
  return callOpenAICompatible(history, currentTurnText, {
    url: GROQ_ENDPOINT,
    apiKey,
    providerId: 'groq',
    modelId: getModel('groq'),
  })
}

async function callOpenRouter(apiKey, history, currentTurnText) {
  return callOpenAICompatible(history, currentTurnText, {
    url: OPENROUTER_ENDPOINT,
    apiKey,
    providerId: 'openrouter',
    modelId: getModel('openrouter'),
    // OpenRouter asks for these so traffic from this app appears in its
    // analytics correctly; both are optional but it's polite to send them.
    extraHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'PersonelWebSiteBuilder',
    },
  })
}

async function callLocal(apiKey, history, currentTurnText) {
  const base = getEndpoint('local') || DEFAULT_ENDPOINT_BY_PROVIDER.local
  // Last-mile model validation: if Settings ever ran a status fetch this
  // session, the installed models are cached. If the saved id isn't in that
  // cache, silently swap to the best installed alternative — prevents
  // Ollama 404s from a stale localStorage default (e.g. "llama3.1" when the
  // user actually pulled "llama3.1:8b").
  let savedModel = getModel('local')
  const cached = readCachedLocalModels()
  if (cached.length && !cached.includes(savedModel)) {
    const corrected = pickBestLocalModel(cached, savedModel)
    if (corrected && corrected !== savedModel) {
      savedModel = corrected
      setModel(corrected, 'local')
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
    }
  }
  // Route through Django: browser → /api/ai/local/proxy/ → Ollama. The base
  // URL travels inside the body (key `_localBase`) so we don't trigger a CORS
  // preflight with a custom header.
  const url = `${resolveBackendBase()}${LOCAL_PROXY_PATH}/proxy/`
  return callOpenAICompatible(history, currentTurnText, {
    url,
    apiKey,
    providerId: 'local',
    modelId: savedModel,
    extraBody: { _localBase: base },
  })
}

// Scan a piece of assistant text for inline tool-call JSON and recover it.
// Matches loose patterns like:
//   {"name":"applyTemplate","parameters":{"name":"blog"}}
//   {"name":"addComponent","arguments":{"type":"navbar"}}
//   `applyTemplate({"name":"blog"})`  (some models use this syntax)
// Returns an array of { name, args } entries (empty if none found).
// Scan an assistant text reply for tool-call intent and recover it as a real
// function call. Weak local models (e.g. Llama 3.1 8B) frequently write the
// call as JSON, as a JS-like function call, or in prose with the function
// name mentioned. We try several patterns in order of specificity.
function extractTextCalls(text) {
  const out = []
  if (typeof text !== 'string') return out
  const declared = toolDeclarations()
  const isReal = (n) => declared.some((t) => t.name === n)
  const norm = (n) => (isReal(n) ? n : normaliseToolName(n))

  // Pattern A — JSON object with name + parameters/arguments.
  const jsonRe = /\{\s*"name"\s*:\s*"([a-zA-Z_][\w]*)"\s*,\s*"(?:parameters|arguments|args)"\s*:\s*(\{[\s\S]*?\})\s*\}/g
  let m
  while ((m = jsonRe.exec(text)) !== null) {
    let args = {}
    try { args = JSON.parse(m[2]) } catch { /* skip malformed */ }
    const n = norm(m[1])
    if (isReal(n)) out.push({ name: n, args })
  }
  if (out.length) return out

  // Pattern B — JS-like call: applyTemplate({...}) / addComponent({...})
  const callRe = /\b([a-zA-Z_][\w]*)\s*\(\s*(\{[\s\S]*?\})\s*\)/g
  while ((m = callRe.exec(text)) !== null) {
    let args = {}
    try { args = JSON.parse(m[2]) } catch { /* skip malformed */ }
    const n = norm(m[1])
    if (isReal(n)) out.push({ name: n, args })
  }
  if (out.length) return out

  // Pattern C — prose mentions a tool name verbatim with quoted args nearby.
  // "I'll call applyTemplate with name='blog'" or "apply the github template".
  // Special-case applyTemplate because it's the most common high-impact call.
  const templateNames = ['github', 'dark', 'apple', 'minimal-landing', 'portfolio', 'blog', 'dashboard', 'marketing']
  const lower = text.toLowerCase()
  if (/apply\s*template|applytemplate|use\s+the\s+\w+\s+template|hazır\s*şablon|template\s+(?:name|adı)/i.test(text)) {
    const found = templateNames.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(lower))
    if (found) out.push({ name: 'applyTemplate', args: { name: found } })
  }
  if (out.length) return out

  return out
}

function historyToOpenAiMessages(history, currentTurnText) {
  const out = [{ role: 'system', content: SYSTEM_PROMPT }]
  // OpenAI-compatible APIs require a tool_call_id to thread tool results back
  // to the assistant turn that requested them.
  let pendingCallIds = []
  for (const turn of history) {
    if (turn.role === 'user' && typeof turn.text === 'string') {
      out.push({ role: 'user', content: turn.text })
    } else if (turn.role === 'model' && typeof turn.text === 'string') {
      out.push({ role: 'assistant', content: turn.text })
    } else if (turn.role === 'model' && Array.isArray(turn.functionCalls)) {
      const calls = turn.functionCalls.map((c, i) => {
        const id = `c_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`
        return {
          id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
        }
      })
      pendingCallIds = calls.map((c) => c.id)
      out.push({ role: 'assistant', content: '', tool_calls: calls })
    } else if (turn.role === 'tool' && Array.isArray(turn.toolResults)) {
      turn.toolResults.forEach((r, i) => {
        const tcid = pendingCallIds[i] || `c_${Date.now()}_${i}`
        out.push({
          role: 'tool',
          tool_call_id: tcid,
          name: r.name,
          content: JSON.stringify(r.response || {}),
        })
      })
      pendingCallIds = []
    }
  }
  if (currentTurnText) {
    out.push({ role: 'user', content: currentTurnText })
  }
  return out
}

// Main entry point: take a user prompt, run the function-calling loop until
// Gemini stops calling tools, return the final text the model emits.
//
// `history` (optional) is an array of prior text-only turns
//   [{ role: 'user' | 'model', text }]
// the chat panel keeps so the model remembers what we already discussed —
// without re-shipping the (large) schema snapshot for every previous turn.
// Walk the configured providers in display order and return the ones that are
// ready to take a request (have a key, or are key-less like the local
// runtime). The currently-active provider is moved to the front so it's
// tried first when runAiPrompt is called.
function readyProviders() {
  const active = getProvider()
  const ready = AI_PROVIDERS.filter((p) => p.needsKey === false || !!getApiKey(p.id))
  ready.sort((a, b) => (a.id === active ? -1 : b.id === active ? 1 : 0))
  return ready
}

function isFailoverWorthy(err) {
  const m = String(err?.message || err || '').toLowerCase()
  return (
    m.includes('quota') ||
    m.includes('429') ||
    m.includes('rate') ||
    m.includes('could not reach the local') ||
    m.includes('did not respond after the retry')
  )
}

export async function runAiPrompt(prompt, { maxRounds = 3, history = [] } = {}) {
  const candidates = readyProviders()
  if (!candidates.length) {
    throw new Error('No AI provider is set up yet. Open Settings (Properties → AI Assistant) and paste any free key, or pick Local AI if you have Ollama running.')
  }
  // Try each ready provider in turn; bail out on the first one that succeeds.
  // Non-quota errors bubble up immediately so we don't mask real bugs.
  const tried = []
  let lastErr = null
  let switchedFrom = null
  for (const p of candidates) {
    if (getProvider() !== p.id) {
      switchedFrom = switchedFrom || getProvider()
      setProvider(p.id)
      // Let the toolbar + chat header refresh their provider/model badges
      // without waiting for a focus event.
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
    }
    try {
      const result = await runAiPromptOnce(prompt, { maxRounds, history })
      if (switchedFrom && switchedFrom !== p.id) {
        const fromLabel = AI_PROVIDERS.find((x) => x.id === switchedFrom)?.label || switchedFrom
        const toLabel = p.label
        const cleanFrom = fromLabel.replace(/ \(.*\)$/, '')
        const cleanTo = toLabel.replace(/ \(.*\)$/, '')
        result.text = `(Switched from ${cleanFrom} to ${cleanTo} — first one’s quota was full.) ${result.text || ''}`
      }
      return result
    } catch (e) {
      tried.push({ id: p.id, label: p.label, err: e })
      lastErr = e
      if (!isFailoverWorthy(e)) {
        // Real bug, not a quota/availability hiccup — surface it as-is.
        if (switchedFrom) {
          setProvider(switchedFrom)
          try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
        }
        throw e
      }
      if (tried.length >= candidates.length) {
        // Every configured provider hit its quota or was unreachable. Build
        // a compact summary so the user knows what's happening and what to
        // set up to break the deadlock next time.
        if (switchedFrom) {
          setProvider(switchedFrom)
          try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
        }
        const tail = tried
          .map((t) => t.label.replace(/ \(.*\)$/, ''))
          .join(', ')
        const missing = AI_PROVIDERS
          .filter((x) => x.needsKey !== false && !getApiKey(x.id))
          .map((x) => x.label.replace(/ \(.*\)$/, ''))
        const hint = missing.length
          ? ` Add a free ${missing[0]} key in Settings (Properties → AI Assistant) so auto-failover has somewhere to fall back to.`
          : ' Wait ~60s and try again.'
        throw new Error(`All ready providers are out of quota or unreachable (tried: ${tail}).${hint}`)
      }
    }
  }
  if (switchedFrom) {
    setProvider(switchedFrom)
    try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
  }
  throw lastErr
}

async function runAiPromptOnce(prompt, { maxRounds = 3, history = [] } = {}) {
  const provider = getProvider()
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const apiKey = getApiKey(provider)
  if (!apiKey && providerInfo?.needsKey !== false) {
    const providerLabel = providerInfo?.label || provider
    throw new Error(`Set your ${providerLabel} API key in the editor settings.`)
  }

  const snapshot = schemaSnapshot()
  const HISTORY_TURNS = 12
  // Strong cloud providers handle multi-step customization in the first
  // function-calling response; only weak local models (Llama 3.1 8B and
  // friends) actually need a second-round nudge after applyTemplate.
  const NEEDS_TEMPLATE_NUDGE = provider === 'local'
  // Provider-neutral conversation log. We feed it to callProvider() each
  // round and it gets translated into the right wire shape (Gemini parts /
  // OpenAI messages). Each entry is one of:
  //   { role: 'user', text }
  //   { role: 'model', text }                          (assistant text)
  //   { role: 'model', functionCalls: [{name, args}] } (assistant tool call)
  //   { role: 'tool', toolResults: [{name, response}] }
  const turns = (history || [])
    .filter((m) => m && m.text)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text }))

  // We ship the snapshot in turn 1 only. Subsequent rounds reuse the model's
  // memory of it — the function-call tool results we feed back already tell
  // it what changed, so reshipping the full schema is pure token waste.
  const initialPromptText = `Current schema snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nUser request: ${prompt}`

  let finalText = ''
  const calls = []
  for (let round = 0; round < maxRounds; round += 1) {
    const isFirst = round === 0
    const parts = await callProvider(
      apiKey,
      turns,
      isFirst ? initialPromptText : '',
    )
    const functionCalls = parts.filter((p) => p.functionCall)
    const textParts = parts.filter((p) => typeof p.text === 'string' && p.text.length > 0)

    // On the first round our turns array did not yet contain the prompt; add
    // it now so subsequent rounds (which use turns directly) carry it.
    if (isFirst) turns.push({ role: 'user', text: initialPromptText })

    if (functionCalls.length === 0) {
      finalText = textParts.map((p) => p.text).join('\n').trim() || 'Done.'
      if (finalText) turns.push({ role: 'model', text: finalText })
      break
    }

    // Record the model's tool-calling turn.
    turns.push({
      role: 'model',
      functionCalls: functionCalls.map(({ functionCall }) => ({
        name: functionCall.name,
        args: functionCall.args || {},
      })),
    })

    const toolResults = functionCalls.map(({ functionCall }) => {
      const args = functionCall.args || {}
      let result
      try {
        result = executeTool(functionCall.name, args)
      } catch (e) {
        result = { ok: false, error: String(e?.message || e) }
      }
      const entry = { name: functionCall.name, args, result }
      calls.push(entry)
      // eslint-disable-next-line no-console
      console.debug('[AI tool]', entry)
      return { name: functionCall.name, response: result }
    })
    turns.push({ role: 'tool', toolResults })

    // Two failure modes after applyTemplate, both fixed by force-feeding a
    // fresh snapshot into the next round:
    //
    // (1) Weak local models (Llama 3.1 8B, etc.) stop after applyTemplate
    //     and never emit the customisation calls at all.
    // (2) Strong cloud models (Gemini, Groq, OpenRouter) emit applyTemplate
    //     and customisation calls in the SAME parallel batch — the
    //     customisations target component IDs from the pre-template snapshot
    //     and silently fail with "Component not found" because applyTemplate
    //     wiped them. The user then sees the chat claim "all done" while the
    //     canvas still shows the old template (or empty).
    //
    // Whenever applyTemplate succeeded this round, hand the model the new
    // schema and tell it to redo the customisation against real IDs. This
    // costs at most one extra round (still within maxRounds=2) but fixes
    // both classes of failure in one shot.
    const appliedTemplate = toolResults.find((r) => r.name === 'applyTemplate' && r.response?.ok)
    const staleCalls = toolResults.filter(
      (r) => r.name !== 'applyTemplate' && r.response && r.response.ok === false && /not found/i.test(r.response.error || ''),
    )
    if (appliedTemplate && (NEEDS_TEMPLATE_NUDGE || staleCalls.length > 0)) {
      const freshSnapshot = schemaSnapshot()
      const reason = staleCalls.length > 0
        ? `${staleCalls.length} of your tool calls in this batch targeted component IDs from the BEFORE-template snapshot and were silently dropped because applyTemplate wiped those components. `
        : 'Template applied — now you must customise it. '
      turns.push({
        role: 'user',
        text:
          reason
          + 'Here is the FRESH schema with the real new IDs. Re-emit your customisation tool calls '
          + '(setLinks for the navbar, replaceComponentText for EVERY heading / text / button / card '
          + 'title) using the NEW IDs from this snapshot so the page actually reflects the user\'s topic. '
          + 'Do not stop until every default placeholder string has been replaced.\n\n'
          + 'New schema:\n'
          + JSON.stringify(freshSnapshot, null, 2),
      })
    }
  }

  return { text: finalText || 'Done.', toolCallCount: calls.length, calls }
}
