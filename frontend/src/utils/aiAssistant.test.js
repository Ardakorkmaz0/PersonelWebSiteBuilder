// Tests for the assistant's pure (no-store-needed) helpers:
//   - provider config sanity
//   - getter/setter persistence to localStorage
//   - pickBestLocalModel ranking (tool-calling priority)
// runAiPrompt itself is left to integration tests because it talks to the
// store + makes network calls; the failover ORDER is asserted indirectly via
// readyProviders being deterministic in AI_PROVIDERS order with the active
// one first — covered as a comment on the implementation.
import { describe, expect, it, beforeEach } from 'vitest'
import {
  AI_PROVIDERS,
  pickBestLocalModel,
  getProvider,
  setProvider,
  getModelsFor,
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  getEndpoint,
  setEndpoint,
} from './aiAssistant.js'

describe('AI_PROVIDERS', () => {
  it('exposes the four providers the editor knows about', () => {
    const ids = AI_PROVIDERS.map((p) => p.id).sort()
    expect(ids).toEqual(['gemini', 'groq', 'local', 'openrouter'])
  })

  it('puts OpenRouter first so it is the default for new users', () => {
    // The first entry is what setProvider(DEFAULT_PROVIDER) falls back to.
    // OpenRouter has the largest free-tier pool of decent models in 2026, so
    // it is the safest default — keep it pinned.
    expect(AI_PROVIDERS[0].id).toBe('openrouter')
  })

  it('marks only local as keyless', () => {
    const keyless = AI_PROVIDERS.filter((p) => p.needsKey === false)
    expect(keyless).toHaveLength(1)
    expect(keyless[0].id).toBe('local')
  })

  it('exposes a recommended model for every provider', () => {
    for (const p of AI_PROVIDERS) {
      const models = getModelsFor(p.id)
      expect(models.length, `${p.id} has no models`).toBeGreaterThan(0)
    }
  })
})

describe('pickBestLocalModel', () => {
  it('keeps the preferred model when nothing is installed (no choice to make)', () => {
    // When Ollama isn't reachable yet, we hold on to whatever the user had
    // last picked so the badge doesn't flip to empty mid-load.
    expect(pickBestLocalModel([], 'llama3.1:8b')).toBe('llama3.1:8b')
    expect(pickBestLocalModel(null, 'llama3.1:8b')).toBe('llama3.1:8b')
    expect(pickBestLocalModel([], '')).toBe('')
  })

  it('keeps the preferred model if it is installed', () => {
    const installed = ['llama3.1:8b', 'qwen2.5:7b', 'phi3:mini']
    expect(pickBestLocalModel(installed, 'llama3.1:8b')).toBe('llama3.1:8b')
  })

  it('upgrades from a weak default to a stronger installed model', () => {
    // When the saved model is the placeholder llama3.1 (no tag → likely
    // missing) but a real tool-calling model IS installed, the picker should
    // return the strong one so the first chat request actually works.
    const installed = ['qwen2.5:7b', 'phi3:mini']
    const picked = pickBestLocalModel(installed, 'llama3.1')
    // qwen2.5 is the preferred tool-caller; phi3 is too small for reliable
    // function calling in this builder's tool schema.
    expect(picked).toBe('qwen2.5:7b')
  })

  it('falls back to first installed model if none match the preference list', () => {
    const installed = ['mystery-model:latest']
    const picked = pickBestLocalModel(installed, 'llama3.1:8b')
    expect(picked).toBe('mystery-model:latest')
  })
})

describe('provider/key/model/endpoint persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists and reads back the provider selection', () => {
    setProvider('groq')
    expect(getProvider()).toBe('groq')
    setProvider('local')
    expect(getProvider()).toBe('local')
  })

  it('rejects unknown provider ids silently', () => {
    setProvider('groq')
    setProvider('not-a-real-provider')
    // Bad value ignored, previous good value retained
    expect(getProvider()).toBe('groq')
  })

  it('falls back to the recommended default when nothing is saved', () => {
    expect(getProvider()).toBe('openrouter')
  })

  it('stores API keys per-provider so switching providers does not lose either key', () => {
    setApiKey('gemini-secret', 'gemini')
    setApiKey('groq-secret', 'groq')
    expect(getApiKey('gemini')).toBe('gemini-secret')
    expect(getApiKey('groq')).toBe('groq-secret')
    // local doesn't need a key — should be empty regardless
    expect(getApiKey('local')).toBe('')
  })

  it('persists model choice per-provider', () => {
    setModel('llama-3.3-70b-versatile', 'groq')
    setModel('gemini-2.5-flash', 'gemini')
    expect(getModel('groq')).toBe('llama-3.3-70b-versatile')
    expect(getModel('gemini')).toBe('gemini-2.5-flash')
  })

  it('persists the local endpoint so a custom port survives reload', () => {
    setEndpoint('http://localhost:1234/v1', 'local')
    expect(getEndpoint('local')).toBe('http://localhost:1234/v1')
  })
})
