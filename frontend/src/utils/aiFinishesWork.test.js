// The turn does not end while the work is unfinished.
//
// This drives the REAL prompt loop against a scripted model, because the bug
// was never in a helper: the loop ended the moment a response arrived without
// tool calls. A model that did three of nine things and wrote "All done!" was
// taken at its word, and the user was handed a half-built page with a cheerful
// summary on top.
//
// Each test scripts a model that gives up early and asserts that the loop
// pushes back — with the model's own remaining steps, or with the list of
// components still carrying template copy — and that it accepts the sign-off
// once the work is genuinely done.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { runAiPrompt, unfinishedPlaceholders } from './aiAssistant.js'
import { useEditorStore, selectCurrentPage } from '../store/editorStore.js'

// One scripted assistant response, in the Gemini parts shape the loop reads.
const say = (text) => ({ parts: [{ text }] })
const call = (name, args = {}) => ({ parts: [{ functionCall: { name, args } }] })
const both = (text, calls) => ({
  parts: [{ text }, ...calls.map(([name, args = {}]) => ({ functionCall: { name, args } }))],
})

let responses = []
let requests = []

function scriptModel(list) {
  responses = [...list]
  requests = []
  globalThis.fetch = vi.fn(async (_url, options) => {
    requests.push(JSON.parse(options.body))
    const next = responses.shift() || say('Done.')
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: next.parts } }] }),
    }
  })
}

// Everything the loop fed back to the model, as one searchable string.
const promptText = () => JSON.stringify(requests)

function page() {
  return selectCurrentPage(useEditorStore.getState())
}

beforeEach(() => {
  localStorage.setItem('pwb_ai_provider', 'gemini')
  localStorage.setItem('pwb_gemini_key', 'test-key')
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{ id: 'page_home', name: 'Home', components: [], background: '#ffffff' }],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('a plan the model does not finish', () => {
  it('hands back the unfinished steps instead of accepting the sign-off', async () => {
    scriptModel([
      call('setPlan', { steps: ['Add a hero band', 'Add a footer band', 'Write the hero copy'] }),
      both('Hero added.', [['addSection', { background: '#101010' }], ['completePlanStep', { step: 1 }]]),
      say('All done! Your site is ready.'),           // ← the lie
      call('addSection', { background: '#f5f5f5' }),   // ← what it does when pushed
      say('Added the footer too.'),
    ])

    const res = await runAiPrompt('build me a landing page', { maxRounds: 6 })

    const nudge = promptText()
    expect(nudge).toContain('2 of your own plan steps unfinished')
    expect(nudge).toContain('Add a footer band')
    expect(nudge).toContain('Write the hero copy')
    // It kept working after the challenge: two bands on the page, not one.
    expect(page().components.filter((c) => c.type === 'region')).toHaveLength(2)
    expect(res.text).toContain('footer')
  })

  it('accepts the sign-off once every step is ticked', async () => {
    scriptModel([
      call('setPlan', { steps: ['Add a band', 'Add another'] }),
      both('Working.', [
        ['addSection', { background: '#111' }],
        ['completePlanStep', { step: 1 }],
        ['addSection', { background: '#222' }],
        ['completePlanStep', { step: 2 }],
      ]),
      say('Both bands are in.'),
    ])

    const res = await runAiPrompt('add two bands', { maxRounds: 6 })

    expect(promptText()).not.toContain('plan steps unfinished')
    expect(res.text).toBe('Both bands are in.')
  })

  it('lets go after one challenge rather than looping on a model that cannot finish', async () => {
    scriptModel([
      call('setPlan', { steps: ['One', 'Two', 'Three'] }),
      say('Done.'),
      say('Done, really.'),
      say('Still done.'),
    ])

    const res = await runAiPrompt('do three things', { maxRounds: 6 })

    const challenges = (promptText().match(/plan steps unfinished/g) || []).length
    expect(challenges).toBe(1)
    expect(res.text).toBeTruthy()
  })
})

describe('template copy left on the page', () => {
  it('names the components still carrying it and will not sign off', async () => {
    scriptModel([
      call('applyTemplate', { name: 'github' }),
      say('Your GitHub-style site is ready!'),   // ← every default string intact
      say('Rewrote the copy.'),
    ])

    await runAiPrompt('make me a github style page for my open source tool', { maxRounds: 6 })

    const sweep = promptText()
    expect(sweep).toMatch(/still carry the template's default copy/)
    // The nudge is specific: real ids and the exact strings to replace, so the
    // model can act on it rather than being scolded.
    const listed = unfinishedPlaceholders(12)
    expect(listed.length).toBeGreaterThan(3)
    expect(sweep).toContain(listed[0].id)
    expect(sweep).toContain(listed[0].value)
  })

  it('says nothing when the model rewrote the copy itself', async () => {
    // A model doing the job properly: it replaces every default string before
    // signing off. Built at send time so it reflects the page as it then is.
    const rewriteEverything = () => both(
      'Customising.',
      unfinishedPlaceholders(40).map((p, i) => (
        ['updateProps', { id: p.id, patch: { [p.field]: `Bespoke copy ${i}` } }]
      )),
    )
    scriptModel([
      call('applyTemplate', { name: 'github' }),
      { get parts() { return rewriteEverything().parts } },
      { get parts() { return rewriteEverything().parts } },
      say('Done — all copy is about your project.'),
    ])

    const res = await runAiPrompt('make me a github style page', { maxRounds: 6 })

    expect(promptText()).not.toMatch(/still carry the template's default copy/)
    expect(res.text).toContain('all copy is about your project')
  })

  it('leaves a plain edit alone — no template, no sweep', async () => {
    const id = useEditorStore.getState().addComponent('button')
    scriptModel([
      call('updateStyles', { id: page().components[0].id, patch: { backgroundColor: '#ef4444' } }),
      say('Made the button red.'),
    ])

    await runAiPrompt('make the button red', { maxRounds: 4 })

    expect(id === undefined || true).toBe(true)
    expect(promptText()).not.toMatch(/default copy/)
  })
})

describe('a model that repeats itself', () => {
  it('runs an identical call once and tells it to move on', async () => {
    scriptModel([
      call('addSection', { background: '#0f172a' }),
      call('addSection', { background: '#0f172a' }),   // ← the same call again
      say('Section added.'),
    ])

    const res = await runAiPrompt('add a dark band', { maxRounds: 5 })

    // One band, not two — the duplicate was recognised, not replayed.
    expect(page().components.filter((c) => c.type === 'region')).toHaveLength(1)
    const skipped = res.calls.filter((c) => c.result?.skipped)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].result.note).toMatch(/already made this exact call/i)
  })
})
