// Multi-step work: the plan, and the two things that stop a turn ending on a
// half-built page.
//
// "Build me a portfolio" is eight or nine pieces of work. The loop used to end
// the moment the model stopped calling tools, so three-of-nine plus a confident
// sign-off counted as success — the user was told the site was ready and found
// template copy all over it. The guards here are deliberately independent:
// the plan is the model's own promise, the sweep is a fact about the page that
// no sign-off can override.
import { describe, expect, it, beforeEach } from 'vitest'
import {
  executeTool,
  getActivePlan,
  resetPlan,
  unfinishedPlaceholders,
} from './aiAssistant.js'
import { useEditorStore, selectCurrentPage } from '../store/editorStore.js'
import { TEMPLATES } from './aiTemplates.js'

function page() {
  return selectCurrentPage(useEditorStore.getState())
}

beforeEach(() => {
  resetPlan()
  useEditorStore.getState().loadSchema({
    theme: {},
    pages: [{ id: 'page_home', name: 'Home', components: [], background: '#ffffff' }],
  })
})

describe('setPlan', () => {
  it('records the steps and hands them back numbered for the user', () => {
    const res = executeTool('setPlan', { steps: ['Apply a portfolio template', 'Rewrite the hero', 'Fill the project cards'] })
    expect(res.ok).toBe(true)
    expect(res.steps).toEqual([
      '1. Apply a portfolio template',
      '2. Rewrite the hero',
      '3. Fill the project cards',
    ])
    expect(getActivePlan().steps.every((s) => s.done === false)).toBe(true)
  })

  it('refuses a one-step "plan", which is just overhead', () => {
    const res = executeTool('setPlan', { steps: ['Make the button red'] })
    expect(res.ok).toBe(false)
    expect(getActivePlan()).toBeNull()
  })

  it('ignores blank steps and caps a runaway list', () => {
    executeTool('setPlan', { steps: ['Real step', '   ', '', 'Another'] })
    expect(getActivePlan().steps.map((s) => s.text)).toEqual(['Real step', 'Another'])

    resetPlan()
    executeTool('setPlan', { steps: Array.from({ length: 25 }, (_, i) => `Step ${i}`) })
    expect(getActivePlan().steps).toHaveLength(10)
  })
})

describe('completePlanStep', () => {
  beforeEach(() => {
    executeTool('setPlan', { steps: ['One', 'Two', 'Three'] })
  })

  it('ticks a step and reports what is left', () => {
    const res = executeTool('completePlanStep', { step: 2 })
    expect(res.ok).toBe(true)
    expect(res.remaining).toEqual(['One', 'Three'])
    expect(getActivePlan().steps[1].done).toBe(true)
  })

  it('says so when the plan is finished', () => {
    executeTool('completePlanStep', { step: 1 })
    executeTool('completePlanStep', { step: 2 })
    const res = executeTool('completePlanStep', { step: 3 })
    expect(res.remaining).toEqual([])
    expect(res.note).toMatch(/complete/i)
  })

  it('rejects a step number that does not exist rather than silently passing', () => {
    expect(executeTool('completePlanStep', { step: 9 }).ok).toBe(false)
    expect(executeTool('completePlanStep', { step: 0 }).ok).toBe(false)
    expect(executeTool('completePlanStep', { step: 'two' }).ok).toBe(false)
  })

  it('refuses to tick a plan that was never made', () => {
    resetPlan()
    const res = executeTool('completePlanStep', { step: 1 })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/setPlan/)
  })
})

describe('unfinishedPlaceholders', () => {
  it('finds template copy still sitting on the page', () => {
    expect(executeTool('applyTemplate', { name: 'github' }).ok).toBe(true)
    const left = unfinishedPlaceholders()
    expect(left.length).toBeGreaterThan(3)
    // Every entry names something the model can act on.
    for (const item of left) {
      expect(item.id).toBeTruthy()
      expect(item.field).toBeTruthy()
      expect(item.value.length).toBeGreaterThan(2)
    }
    // And they really are the template's own strings.
    const shipped = TEMPLATES.github.steps.map((s) => s.props?.text || s.props?.title || s.props?.heading)
    expect(shipped).toContain(left.find((l) => shipped.includes(l.value))?.value)
  })

  it('goes quiet as the model writes real copy', () => {
    executeTool('applyTemplate', { name: 'github' })
    const before = unfinishedPlaceholders()
    const target = before[0]

    executeTool('replaceComponentText', { id: target.id, text: 'Photographs from the Anatolian coast, 2019—2024.' })

    const after = unfinishedPlaceholders()
    // That field is settled. A card can still be listed for its OTHER default
    // string (title as well as text) — which is correct: it is not finished.
    expect(after.find((p) => p.id === target.id && p.field === target.field)).toBeUndefined()
    expect(after.length).toBeLessThanOrEqual(before.length)
  })

  it('clears completely once every default string is rewritten', () => {
    executeTool('applyTemplate', { name: 'github' })
    // Keep rewriting whatever it reports until it has nothing left to say.
    for (let pass = 0; pass < 40 && unfinishedPlaceholders().length; pass += 1) {
      const [next] = unfinishedPlaceholders()
      executeTool('updateProps', { id: next.id, patch: { [next.field]: `Real copy ${pass}` } })
    }
    expect(unfinishedPlaceholders()).toEqual([])
  })

  it('says nothing about a page the user wrote themselves', () => {
    const id = executeTool('addComponent', { type: 'heading' }).id
    executeTool('replaceComponentText', { id, text: 'Arda Korkmaz — product designer' })
    expect(unfinishedPlaceholders()).toEqual([])
  })

  it('reports a bounded list rather than a hundred lines of prompt', () => {
    executeTool('applyTemplate', { name: 'portfolio' })
    expect(unfinishedPlaceholders(3)).toHaveLength(3)
  })

  it('looks inside containers, not just the top level', () => {
    const section = executeTool('addSection', {}).id
    const child = executeTool('addComponent', { type: 'heading', parentId: section }).id
    expect(child).toBeTruthy()
    // A freshly added heading still carries the registry's default copy.
    const found = unfinishedPlaceholders()
    expect(found.some((p) => p.id === child)).toBe(true)
  })
})

describe('replaceComponentText reaches the copy templates actually ship', () => {
  // The prompt pushes this tool for rewriting copy, and it used to answer "no
  // editable text field" for the two types every template starts with — so the
  // brand and the section titles could not be rewritten with it at all.
  it('renames a navbar brand', () => {
    const id = executeTool('addComponent', { type: 'navbar' }).id
    const res = executeTool('replaceComponentText', { id, text: 'Arda Korkmaz' })
    expect(res.ok).toBe(true)
    expect(res.field).toBe('brand')
    expect(page().components.find((c) => c.id === id).props.brand).toBe('Arda Korkmaz')
  })

  it('retitles a section band', () => {
    const id = executeTool('addComponent', { type: 'section' }).id
    const res = executeTool('replaceComponentText', { id, text: 'Selected work' })
    expect(res.ok).toBe(true)
    expect(res.field).toBe('heading')
    expect(page().components.find((c) => c.id === id).props.heading).toBe('Selected work')
  })

  it('still refuses a type with no copy at all', () => {
    const id = executeTool('addComponent', { type: 'divider' }).id
    expect(executeTool('replaceComponentText', { id, text: 'x' }).ok).toBe(false)
  })
})

describe('the plan survives a real edit sequence', () => {
  it('tracks a template build end to end', () => {
    executeTool('setPlan', { steps: ['Apply the template', 'Rewrite the hero'] })
    executeTool('applyTemplate', { name: 'portfolio' })
    executeTool('completePlanStep', { step: 1 })

    const heading = page().components.find((c) => c.type === 'heading')
    expect(heading).toBeTruthy()
    executeTool('replaceComponentText', { id: heading.id, text: 'Photography by Arda' })
    executeTool('completePlanStep', { step: 2 })

    expect(getActivePlan().steps.every((s) => s.done)).toBe(true)
    expect(page().components.find((c) => c.id === heading.id).props.text).toBe('Photography by Arda')
  })
})
