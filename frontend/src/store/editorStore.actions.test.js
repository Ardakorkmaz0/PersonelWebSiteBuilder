// Store-level checks for the two newest component actions: per-component
// theme re-apply and cross-page copy. Both are invoked from the Properties
// panel, where a silent no-op would read as "Properties doesn't work".
import { describe, expect, it } from 'vitest'
import { useEditorStore, selectCurrentPage } from './editorStore.js'

const s = () => useEditorStore.getState()

function freshTwoPageSchema() {
  s().loadSchema({
    theme: {},
    pages: [
      { id: 'p1', name: 'Home', components: [] },
      { id: 'p2', name: 'Second', components: [] },
    ],
  })
  s().selectPage('p1')
}

describe('applyThemeToComponent', () => {
  it('restyles one component with the active theme', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const id = selectCurrentPage(useEditorStore.getState()).components[0].id
    s().updateTheme({ primaryColor: '#e8543f', buttonRadius: '7px' })
    s().applyThemeToComponent(id)
    const comp = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(comp.styles.backgroundColor).toBe('#e8543f')
    expect(comp.styles.borderRadius).toBe('7px')
  })
})

describe('copyComponentToPage', () => {
  it('clones the component (fresh id, same props) onto the target page', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const src = selectCurrentPage(useEditorStore.getState()).components[0]
    s().updateProps(src.id, { label: 'Tuned button' })
    s().copyComponentToPage(src.id, 'p2')
    const p2 = useEditorStore.getState().schema.pages.find((p) => p.id === 'p2')
    expect(p2.components).toHaveLength(1)
    const copy = p2.components[0]
    expect(copy.type).toBe('button')
    expect(copy.id).not.toBe(src.id)
    expect(copy.props.label).toBe('Tuned button')
    // Source stays put on the original page.
    const p1 = useEditorStore.getState().schema.pages.find((p) => p.id === 'p1')
    expect(p1.components).toHaveLength(1)
  })

  it('ignores copies onto the same page or unknown pages', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const id = selectCurrentPage(useEditorStore.getState()).components[0].id
    s().copyComponentToPage(id, 'p1')
    s().copyComponentToPage(id, 'nope')
    expect(selectCurrentPage(useEditorStore.getState()).components).toHaveLength(1)
  })
})

describe('per-page mode', () => {
  it('new pages default to empty and can start in html mode', () => {
    freshTwoPageSchema()
    s().addPage('Doc', '', 'html')
    const added = s().schema.pages.at(-1)
    expect(added.mode).toBe('html')
    s().addPage('Plain')
    expect(s().schema.pages.at(-1).mode).toBe('empty')
  })

  it('setPageMode flips a page between empty and html', () => {
    freshTwoPageSchema()
    s().setPageMode('p1', 'html')
    expect(s().schema.pages.find((p) => p.id === 'p1').mode).toBe('html')
    s().setPageMode('p1', 'empty')
    expect(s().schema.pages.find((p) => p.id === 'p1').mode).toBe('empty')
  })

  it('derives html mode from a loaded page that carries an HTML document', () => {
    s().loadSchema({
      theme: {},
      pages: [
        { id: 'h', name: 'Home', html: '<!doctype html><p>hi</p>', components: [] },
        { id: 'c', name: 'Comp', components: [] },
      ],
    })
    expect(s().schema.pages.find((p) => p.id === 'h').mode).toBe('html')
    expect(s().schema.pages.find((p) => p.id === 'c').mode).toBe('empty')
  })
})

describe('component link tool', () => {
  it('arms a link-capable source then binds it to a target component', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10) // source (renders an anchor)
    s().addComponent('heading', 10, 120) // target
    const comps = selectCurrentPage(useEditorStore.getState()).components
    const srcId = comps[0].id
    const tgtId = comps[1].id
    expect(s().pickLinkNode(srcId)).toBe('armed')
    expect(s().linkSourceId).toBe(srcId)
    expect(s().pickLinkNode(tgtId)).toBe('linked')
    expect(s().linkSourceId).toBeNull()
    const src = selectCurrentPage(useEditorStore.getState()).components.find((c) => c.id === srcId)
    expect(src.props.href).toBe('#' + tgtId)
  })

  it('arms ANY component as a source (every component is linkable)', () => {
    freshTwoPageSchema()
    s().addComponent('divider', 10, 10) // not an anchor type, still linkable
    const id = selectCurrentPage(useEditorStore.getState()).components[0].id
    expect(s().pickLinkNode(id)).toBe('armed')
    expect(s().linkSourceId).toBe(id)
  })

  it('binds an armed source to a whole page from the Files panel', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const id = selectCurrentPage(useEditorStore.getState()).components[0].id
    expect(s().bindLinkSourceToPage('p2')).toBe(false) // nothing armed → caller navigates
    s().pickLinkNode(id)
    expect(s().bindLinkSourceToPage('p2')).toBe(true)
    const src = selectCurrentPage(useEditorStore.getState()).components.find((c) => c.id === id)
    expect(src.props.href).toBe('#p2')
  })

  it('drops the pending source when switching pages', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const id = selectCurrentPage(useEditorStore.getState()).components[0].id
    s().pickLinkNode(id)
    expect(s().linkSourceId).toBe(id)
    s().selectPage('p2')
    expect(s().linkSourceId).toBeNull()
  })
})
