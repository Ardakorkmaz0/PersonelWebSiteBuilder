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

describe('multi-select + align/distribute', () => {
  function threeBoxes() {
    freshTwoPageSchema()
    s().addComponent('button', 0, 0)
    s().addComponent('button', 0, 0)
    s().addComponent('button', 0, 0)
    const ids = selectCurrentPage(useEditorStore.getState()).components.map((c) => c.id)
    s().setLayout(ids[0], { x: 10, y: 10, w: 100, h: 40 })
    s().setLayout(ids[1], { x: 50, y: 200, w: 80, h: 40 })
    s().setLayout(ids[2], { x: 300, y: 100, w: 60, h: 40 })
    return ids
  }
  const layoutOf = (id) =>
    selectCurrentPage(useEditorStore.getState()).components.find((c) => c.id === id).layout

  it('toggleSelect builds a multi-selection with the primary = last toggled', () => {
    const ids = threeBoxes()
    s().selectComponent(ids[0])
    s().toggleSelect(ids[1])
    expect(s().selectedIds).toEqual([ids[0], ids[1]])
    expect(s().selectedId).toBe(ids[1])
    s().toggleSelect(ids[1]) // remove it again
    expect(s().selectedIds).toEqual([ids[0]])
    expect(s().selectedId).toBe(ids[0])
  })

  it('alignSelection(left) snaps every selected item to the selection left edge', () => {
    const ids = threeBoxes()
    s().selectMany(ids)
    s().alignSelection('left')
    expect(layoutOf(ids[0]).x).toBe(10)
    expect(layoutOf(ids[1]).x).toBe(10)
    expect(layoutOf(ids[2]).x).toBe(10)
  })

  it('distributeSelection(x) produces equal horizontal gaps', () => {
    const ids = threeBoxes()
    s().selectMany(ids)
    s().distributeSelection('x')
    const ls = ids.map(layoutOf).sort((a, b) => a.x - b.x)
    const gap1 = ls[1].x - (ls[0].x + ls[0].w)
    const gap2 = ls[2].x - (ls[1].x + ls[1].w)
    expect(Math.abs(gap1 - gap2)).toBeLessThanOrEqual(1)
  })

  it('setLayoutMany moves several items in one history step', () => {
    const ids = threeBoxes()
    s().setLayoutMany({ [ids[0]]: { x: 5, y: 5 }, [ids[2]]: { x: 7, y: 9 } })
    expect(layoutOf(ids[0])).toMatchObject({ x: 5, y: 5 })
    expect(layoutOf(ids[2])).toMatchObject({ x: 7, y: 9 })
    expect(layoutOf(ids[1])).toMatchObject({ x: 50, y: 200 }) // untouched
  })

  it('removing a component drops it from the multi-selection', () => {
    const ids = threeBoxes()
    s().selectMany(ids)
    s().removeComponent(ids[1])
    expect(s().selectedIds).toEqual([ids[0], ids[2]])
  })
})
