// executeTool against the real store: the id guard, the four capability tools
// added for motion / SEO / navbar placement / sections, and the change-request
// classifier behind the "you called nothing" self-check.
//
// These run the actual editor store, so a regression that makes a tool a silent
// no-op — the failure mode that let the assistant report success for work that
// never happened — shows up here rather than in the user's site.
import { describe, expect, it, beforeEach } from 'vitest'
import { executeTool, looksLikeChangeRequest } from './aiAssistant.js'
import { useEditorStore, selectCurrentPage } from '../store/editorStore.js'

function page() {
  return selectCurrentPage(useEditorStore.getState())
}

function add(type) {
  const before = page().components.map((c) => c.id)
  useEditorStore.getState().addComponent(type)
  return page().components.map((c) => c.id).find((id) => !before.includes(id))
}

beforeEach(() => {
  const s = useEditorStore.getState()
  s.loadSchema({
    theme: {},
    pages: [{ id: 'page_home', name: 'Home', components: [], background: '#ffffff' }],
  })
})

describe('id validation', () => {
  it('rejects a made-up id instead of reporting success', () => {
    const res = executeTool('updateProps', { id: 'nope_123', patch: { text: 'x' } })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not found/i)
  })

  it('names the ids that do exist so the model can retry', () => {
    const id = add('text')
    const res = executeTool('updateStyles', { id: 'ghost', patch: { color: '#fff' } })
    expect(res.error).toContain(id)
  })

  it('still applies the change when the id is real', () => {
    const id = add('text')
    expect(executeTool('updateProps', { id, patch: { text: 'Hello' } }).ok).toBe(true)
    expect(page().components.find((c) => c.id === id).props.text).toBe('Hello')
  })

  it('rejects an unknown parentId rather than silently placing at top level', () => {
    const res = executeTool('addComponent', { type: 'text', parentId: 'ghost' })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/Parent not found/i)
  })

  it('rejects an unknown page id', () => {
    const res = executeTool('selectPage', { id: 'page_ghost' })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/Page not found/i)
  })
})

describe('setMotion', () => {
  it('writes the entrance, hover, speed and delay props', () => {
    const id = add('card')
    const res = executeTool('setMotion', { id, animIn: 'fade-up', animHover: 'lift', animSpeed: 'fast', animDelay: 120 })
    expect(res.ok).toBe(true)
    const props = page().components.find((c) => c.id === id).props
    expect(props).toMatchObject({ animIn: 'fade-up', animHover: 'lift', animSpeed: 'fast', animDelay: 120 })
  })

  it('clamps the delay into the supported range', () => {
    const id = add('card')
    executeTool('setMotion', { id, animDelay: 99999 })
    expect(page().components.find((c) => c.id === id).props.animDelay).toBe(3000)
  })

  it('rejects an invented animation name and lists the real ones', () => {
    const id = add('card')
    const res = executeTool('setMotion', { id, animIn: 'explode' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('fade-up')
    expect(page().components.find((c) => c.id === id).props.animIn).toBeUndefined()
  })

  it('refuses to animate a pinned bar, which cannot animate', () => {
    const id = add('navbar')
    executeTool('updateProps', { id, patch: { scrollBehavior: 'fixed' } })
    const res = executeTool('setMotion', { id, animIn: 'fade' })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/pinned/i)
  })

  it('needs at least one field', () => {
    const id = add('card')
    expect(executeTool('setMotion', { id }).ok).toBe(false)
  })
})

describe('setPageMeta', () => {
  it('writes SEO fields to the current page by default', () => {
    const res = executeTool('setPageMeta', { seoTitle: 'Arda — Designer', seoDescription: 'Portfolio of an interface designer.' })
    expect(res.ok).toBe(true)
    expect(page().seoTitle).toBe('Arda — Designer')
    expect(page().seoDescription).toBe('Portfolio of an interface designer.')
  })

  it('truncates rather than storing an unbounded description', () => {
    executeTool('setPageMeta', { seoDescription: 'x'.repeat(500) })
    expect(page().seoDescription.length).toBe(200)
  })

  it('rejects an unknown page', () => {
    expect(executeTool('setPageMeta', { pageId: 'ghost', seoTitle: 'x' }).ok).toBe(false)
  })
})

describe('setNavbarLayout', () => {
  it('sets placement props on a navbar', () => {
    const id = add('navbar')
    const res = executeTool('setNavbarLayout', { id, linksAlign: 'center', brandAlign: 'left', linkGap: 24, scrollBehavior: 'sticky' })
    expect(res.ok).toBe(true)
    expect(page().components.find((c) => c.id === id).props).toMatchObject({
      linksAlign: 'center', brandAlign: 'left', linkGap: 24, scrollBehavior: 'sticky',
    })
  })

  it('refuses a component that is not a navbar', () => {
    const id = add('text')
    const res = executeTool('setNavbarLayout', { id, linksAlign: 'center' })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not a navbar/i)
  })

  it('rejects an out-of-vocabulary value', () => {
    const id = add('navbar')
    const res = executeTool('setNavbarLayout', { id, linksAlign: 'justified' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('center')
  })
})

describe('addSection', () => {
  it('creates a region and returns an id usable as a parent', () => {
    const res = executeTool('addSection', { background: '#0f172a', height: 500 })
    expect(res.ok).toBe(true)
    const band = page().components.find((c) => c.id === res.id)
    expect(band.type).toBe('region')
    // Background must land in styles: props go through the server allowlist.
    expect(band.styles.backgroundColor).toBe('#0f172a')
    expect(band.layout.h).toBe(500)
    expect(executeTool('addComponent', { type: 'heading', parentId: res.id }).ok).toBe(true)
  })
})

describe('looksLikeChangeRequest', () => {
  it('treats edits as change requests', () => {
    expect(looksLikeChangeRequest('add a navbar')).toBe(true)
    expect(looksLikeChangeRequest('sayfaya bir buton ekle')).toBe(true)
    expect(looksLikeChangeRequest('make the hero blue')).toBe(true)
  })

  it('treats meta questions and slash commands as conversation', () => {
    expect(looksLikeChangeRequest('what can you do?')).toBe(false)
    expect(looksLikeChangeRequest('neler yapabilirsin')).toBe(false)
    expect(looksLikeChangeRequest('/help')).toBe(false)
    expect(looksLikeChangeRequest('')).toBe(false)
  })
})
