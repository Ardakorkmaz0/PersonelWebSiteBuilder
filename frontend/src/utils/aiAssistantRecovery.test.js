// Regression tests for the text-mode tool-call recovery used when weak local
// models (Llama 3.1 8B, gemma4) skip the OpenAI tool_calls field and embed
// their intent in the assistant text. Each test pins one of the recovery
// patterns A..D so a future refactor can't silently undo it.
import { describe, expect, it } from 'vitest'
import {
  extractTextCalls,
  mapTopicToTemplate,
  recoverIntentFromPrompt,
} from './aiAssistant.js'

describe('recoverIntentFromPrompt — when the model emits zero usable calls', () => {
  it('reads "do me a youtube site" → applyTemplate(portfolio) (creator)', () => {
    const r = recoverIntentFromPrompt('do it a youtube site')
    expect(r?.name).toBe('applyTemplate')
    expect(r?.args).toEqual({ name: 'portfolio' })
  })

  it('reads Turkish "bana youtube sitesi yap" → applyTemplate(portfolio)', () => {
    const r = recoverIntentFromPrompt('bana youtube sitesi yap')
    expect(r?.name).toBe('applyTemplate')
    expect(r?.args).toEqual({ name: 'portfolio' })
  })

  it('reads "make me a restaurant page" → applyTemplate(marketing)', () => {
    const r = recoverIntentFromPrompt('make me a restaurant page')
    expect(r?.name).toBe('applyTemplate')
    expect(r?.args).toEqual({ name: 'marketing' })
  })

  it('reads "switch to dark mode" → applyTemplate(dark)', () => {
    const r = recoverIntentFromPrompt('switch to dark mode')
    expect(r?.name).toBe('applyTemplate')
    expect(r?.args).toEqual({ name: 'dark' })
  })

  it('reads "github style" → applyTemplate(github)', () => {
    const r = recoverIntentFromPrompt('make it a github style site')
    expect(r?.name).toBe('applyTemplate')
  })

  it('reads "make primary blue" → updateTheme primary hex', () => {
    const r = recoverIntentFromPrompt('change primary colour to blue')
    expect(r?.name).toBe('updateTheme')
    expect(r?.args?.patch?.primaryColor).toBe('#2563eb')
  })

  it('returns null for unrelated prose', () => {
    expect(recoverIntentFromPrompt('hello how are you')).toBe(null)
    expect(recoverIntentFromPrompt('')).toBe(null)
  })
})

describe('mapTopicToTemplate — topic → curated-template fallback', () => {
  it('keeps a name that is already a curated key (exact match)', () => {
    expect(mapTopicToTemplate('blog')).toBe('blog')
    expect(mapTopicToTemplate('marketing')).toBe('marketing')
  })

  it('maps the screenshot scenario — youtube → portfolio (creator)', () => {
    // "bana youtube sitesi yap" → Llama 3.1 8B invented {name:"youtube"}.
    // Now we route to the closest creator-style template instead of erroring.
    expect(mapTopicToTemplate('youtube')).toBe('portfolio')
  })

  it('maps fan / topic pages to portfolio (existing #50 contract)', () => {
    expect(mapTopicToTemplate('star wars')).toBe('portfolio')
    expect(mapTopicToTemplate('marvel')).toBe('portfolio')
  })

  it('routes commerce / product / SaaS topics to marketing', () => {
    expect(mapTopicToTemplate('restaurant')).toBe('marketing')
    expect(mapTopicToTemplate('saas')).toBe('marketing')
    expect(mapTopicToTemplate('gym')).toBe('marketing')
  })

  it('routes content / writing topics to blog', () => {
    expect(mapTopicToTemplate('newsletter')).toBe('blog')
    expect(mapTopicToTemplate('writer')).toBe('blog')
  })

  it('routes admin / analytics topics to dashboard', () => {
    expect(mapTopicToTemplate('admin')).toBe('dashboard')
    expect(mapTopicToTemplate('analytics')).toBe('dashboard')
  })

  it('falls back to portfolio for anything else (most flexible)', () => {
    expect(mapTopicToTemplate('asdfqwerty')).toBe('portfolio')
  })

  it('returns "" for empty / nullish input', () => {
    expect(mapTopicToTemplate('')).toBe('')
    expect(mapTopicToTemplate(null)).toBe('')
  })
})

describe('extractTextCalls — Pattern A: {"name", "parameters"|"arguments"|"args"}', () => {
  it('recovers a full tool-call JSON', () => {
    const out = extractTextCalls('{"name":"applyTemplate","parameters":{"name":"blog"}}')
    expect(out).toEqual([{ name: 'applyTemplate', args: { name: 'blog' } }])
  })

  it('accepts the "arguments" key as well', () => {
    const out = extractTextCalls('{"name":"addComponent","arguments":{"type":"navbar"}}')
    expect(out).toEqual([{ name: 'addComponent', args: { type: 'navbar' } }])
  })
})

describe('extractTextCalls — Pattern B: JS-style call applyTemplate({...})', () => {
  it('recovers when the model writes the call literally', () => {
    const out = extractTextCalls('I will applyTemplate({"name":"github"}) now.')
    expect(out).toEqual([{ name: 'applyTemplate', args: { name: 'github' } }])
  })
})

describe('extractTextCalls — Pattern C: prose mentions a template name', () => {
  it('hooks the template name out of "apply the dark template"', () => {
    const out = extractTextCalls("Sure — I'll apply the dark template now.")
    expect(out).toEqual([{ name: 'applyTemplate', args: { name: 'dark' } }])
  })
})

describe('extractTextCalls — Pattern D: bare args, shape-inferred tool name', () => {
  // This is the failure mode from the Llama 3.1 8B screenshot — the model
  // returned just the args object, the tool name was nowhere in the text.
  // Recovery has to look at the shape alone.

  it('infers updateTheme from {patch: {primaryColor}}', () => {
    const out = extractTextCalls('{"patch":{"primaryColor":"#007bff"}}')
    expect(out).toEqual([{ name: 'updateTheme', args: { patch: { primaryColor: '#007bff' } } }])
  })

  it('infers updateTheme when patch carries any theme key', () => {
    const out = extractTextCalls('{"patch":{"fontFamily":"\\"Inter\\", sans-serif"}}')
    expect(out[0]?.name).toBe('updateTheme')
  })

  it('infers applyTemplate from {name:"portfolio"}', () => {
    const out = extractTextCalls('{"name":"portfolio"}')
    expect(out).toEqual([{ name: 'applyTemplate', args: { name: 'portfolio' } }])
  })

  it('infers addComponent from {type:"navbar"}', () => {
    const out = extractTextCalls('{"type":"navbar"}')
    expect(out).toEqual([{ name: 'addComponent', args: { type: 'navbar' } }])
  })

  it('infers setLinks from {id, links:[...]}', () => {
    const out = extractTextCalls('{"id":"nav_1","links":[{"label":"Home","href":"#home"}]}')
    expect(out[0]?.name).toBe('setLinks')
  })

  it('infers replaceComponentText from {id, text}', () => {
    const out = extractTextCalls('{"id":"h_1","text":"Hello"}')
    expect(out[0]?.name).toBe('replaceComponentText')
  })

  it('infers alignComponent from {id, mode}', () => {
    const out = extractTextCalls('{"id":"h_1","mode":"centerH"}')
    expect(out[0]?.name).toBe('alignComponent')
  })

  it('infers setLayout from {id, patch: {x,y,w,h}}', () => {
    const out = extractTextCalls('{"id":"x","patch":{"x":40,"y":60}}')
    expect(out[0]?.name).toBe('setLayout')
  })

  it('infers updateStyles from {id, patch: {backgroundColor}}', () => {
    const out = extractTextCalls('{"id":"x","patch":{"backgroundColor":"#ef4444"}}')
    expect(out[0]?.name).toBe('updateStyles')
  })

  it('returns empty for unrecognisable input', () => {
    expect(extractTextCalls('I have no idea what to do here.')).toEqual([])
    expect(extractTextCalls('')).toEqual([])
    expect(extractTextCalls(null)).toEqual([])
  })
})
