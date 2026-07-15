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

describe('custom canvas resolution', () => {
  it('stores independent desktop and mobile width/height values', () => {
    freshTwoPageSchema()

    s().setViewport('pc')
    s().setCanvasPreset({ width: 1366, fold: 768 })
    let page = selectCurrentPage(useEditorStore.getState())
    expect(page.canvasWidth).toBe(1366)
    expect(page.canvasFold).toBe(768)

    s().setViewport('mobile')
    s().setCanvasPreset({ width: 412, fold: 915 })
    page = selectCurrentPage(useEditorStore.getState())
    expect(page.mobileWidth).toBe(412)
    expect(page.mobileFold).toBe(915)
    expect(page.canvasWidth).toBe(1366)
    expect(page.canvasFold).toBe(768)
  })

  it('clamps manually entered sizes to the supported artboard limits', () => {
    freshTwoPageSchema()
    s().setViewport('pc')
    s().setCanvasPreset({ width: 99999, fold: -1 })
    const page = selectCurrentPage(useEditorStore.getState())
    expect(page.canvasWidth).toBe(4000)
    expect(page.canvasFold).toBe(0)
  })
})

describe('selection invariants', () => {
  it('keeps single and multi-selection aligned after add and duplicate', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const first = s().selectedId
    expect(s().selectedIds).toEqual([first])

    s().duplicateComponent(first)
    expect(s().selectedIds).toEqual([s().selectedId])
    expect(s().selectedId).not.toBe(first)
  })

  it('clears both selection forms when loading, changing pages, undoing, or redoing', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    s().undo()
    expect(s().selectedId).toBeNull()
    expect(s().selectedIds).toEqual([])

    s().redo()
    expect(s().selectedId).toBeNull()
    expect(s().selectedIds).toEqual([])

    s().selectComponent(selectCurrentPage(useEditorStore.getState()).components[0].id)
    s().selectPage('p2')
    expect(s().selectedId).toBeNull()
    expect(s().selectedIds).toEqual([])

    s().loadSchema({ pages: [{ id: 'fresh', name: 'Fresh', components: [] }] })
    expect(s().selectedId).toBeNull()
    expect(s().selectedIds).toEqual([])
  })

  it('promotes a remaining selected component when the primary is removed', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const first = s().selectedId
    s().addComponent('text', 30, 30)
    const second = s().selectedId
    s().selectMany([first, second])

    s().removeComponent(second)

    expect(s().selectedIds).toEqual([first])
    expect(s().selectedId).toBe(first)
  })
})

describe('native tabs drops', () => {
  it('creates palette tab presets as native tabs with matching labels', () => {
    freshTwoPageSchema()
    s().addComponent('tabs', 0, 0, null, 'simple')
    const tabs = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(tabs.type).toBe('tabs')
    expect(tabs.props.activeId).toBe('overview')
    expect(tabs.props.tabs.map((t) => t.label)).toEqual(['Overview', 'Details', 'FAQ'])
  })

  it('stores nested children on the currently active tab', () => {
    freshTwoPageSchema()
    s().addComponent('tabs', 0, 0, null, 'simple')
    const tabs = selectCurrentPage(useEditorStore.getState()).components[0]
    s().setActiveTab(tabs.id, 'details')
    s().addComponent('heading', 20, 30, tabs.id)
    const updated = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(updated.children).toHaveLength(1)
    expect(updated.children[0].type).toBe('heading')
    expect(updated.children[0].tabId).toBe('details')
  })
})

describe('native navbar drops', () => {
  it('creates vertical navbar presets with editable links and compact size', () => {
    freshTwoPageSchema()
    s().addComponent('navbar', 0, 0, null, 'vertical', { w: 220, h: 320 })
    const nav = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(nav.type).toBe('navbar')
    expect(nav.props.navLayout).toBe('vertical')
    expect(nav.props.links.map((l) => l.label)).toEqual(['Dashboard', 'Projects', 'Team', 'Settings'])
    expect(nav.layout).toMatchObject({ w: 220, h: 320 })
  })
})

describe('responsive regions', () => {
  it('creates a full-width parent and clamps children to its safe content width', () => {
    freshTwoPageSchema()
    s().addComponent('region', 0, 40)
    const region = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(region.type).toBe('region')
    expect(region.props.contentWidth).toBe(980)
    expect(region.children).toEqual([])
    expect(region.mobileLayout).toMatchObject({ x: 0, y: 0, w: 390, h: 360 })

    s().addComponent('heading', 960, 20, region.id)
    const updated = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(updated.children).toHaveLength(1)
    expect(updated.children[0].layout.x + updated.children[0].layout.w).toBeLessThanOrEqual(980)
    expect(updated.children[0].mobileLayout).toMatchObject({ x: 16, y: 16 })
  })

  it('keeps sections stacked when resized and lets them be reordered', () => {
    freshTwoPageSchema()
    s().addComponent('region', 0, 0)
    s().addComponent('region', 0, 360)
    let regions = selectCurrentPage(useEditorStore.getState()).components
    const firstId = regions[0].id
    const secondId = regions[1].id
    expect(regions.map((region) => region.mobileLayout.y)).toEqual([0, 360])
    s().setLayout(regions[0].id, { h: 460 })
    regions = selectCurrentPage(useEditorStore.getState()).components
    expect(regions[1].layout.y).toBe(460)
    expect(regions[1].mobileLayout.y).toBe(460)

    s().moveRegion(regions[1].id, 'up')
    regions = selectCurrentPage(useEditorStore.getState()).components
      .filter((component) => component.type === 'region')
      .sort((a, b) => a.layout.y - b.layout.y)
    expect(regions.map((region) => region.id)).toEqual([secondId, firstId])
    expect(regions[0].layout.y).toBe(0)
    expect(regions[1].layout.y).toBe(regions[0].layout.h)
  })
})

describe('component scroll behavior', () => {
  it('stores fixed positioning props on any component', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const id = selectCurrentPage(useEditorStore.getState()).components[0].id
    s().updateProps(id, {
      scrollBehavior: 'fixed',
      pinY: 'bottom',
      pinX: 'right',
      pinOffsetY: 18,
      pinOffsetX: 24,
      pinZIndex: 120,
    })
    const button = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(button.props).toMatchObject({
      scrollBehavior: 'fixed',
      pinY: 'bottom',
      pinX: 'right',
      pinOffsetY: 18,
      pinOffsetX: 24,
      pinZIndex: 120,
    })
  })
})

describe('brush tool', () => {
  it('paints block backgrounds and text colors by component type', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    s().addComponent('text', 10, 80)
    const comps = selectCurrentPage(useEditorStore.getState()).components
    const buttonId = comps[0].id
    const textId = comps[1].id

    s().paintComponent(buttonId, '#ff0000')
    s().paintComponent(textId, '#00ff00')

    const updated = selectCurrentPage(useEditorStore.getState()).components
    expect(updated.find((c) => c.id === buttonId).styles.backgroundColor).toBe('#ff0000')
    expect(updated.find((c) => c.id === textId).styles.color).toBe('#00ff00')
  })

  it('paints form controls through editable field props', () => {
    freshTwoPageSchema()
    s().addComponent('select', 10, 10)
    const selectId = selectCurrentPage(useEditorStore.getState()).components[0].id

    s().paintComponent(selectId, '#123456')

    const select = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(select.props.fieldBackgroundColor).toBe('#123456')
    expect(select.props.fieldBorderColor).toBe('#123456')
  })

  it('supports explicit fill, text, and border targets', () => {
    freshTwoPageSchema()
    s().addComponent('button', 10, 10)
    const buttonId = selectCurrentPage(useEditorStore.getState()).components[0].id

    s().paintComponent(buttonId, '#111111', 'fill')
    s().paintComponent(buttonId, '#222222', 'text')
    s().paintComponent(buttonId, '#333333', 'border')

    const button = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(button.styles.backgroundColor).toBe('#111111')
    expect(button.styles.color).toBe('#222222')
    expect(button.styles.borderColor).toBe('#333333')
    expect(button.styles.borderStyle).toBe('solid')
  })

  it('recolors an html embed snippet in place (unified palette drops)', () => {
    freshTwoPageSchema()
    s().addBlock(
      [
        {
          type: 'html',
          x: 10,
          y: 0,
          w: 240,
          h: 60,
          props: { code: '<a style="background:#2563eb;color:#fff;">Button</a>' },
        },
      ],
      10,
    )
    const htmlId = selectCurrentPage(useEditorStore.getState()).components[0].id

    // smart → fill (snippet has a visible background)
    s().paintComponent(htmlId, '#10b981')
    let comp = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(comp.props.code).toContain('background:#10b981')
    expect(comp.props.code).not.toContain('#2563eb')

    // explicit text target recolors the snippet's text, not the wrapper styles
    s().paintComponent(htmlId, '#000000', 'text')
    comp = selectCurrentPage(useEditorStore.getState()).components[0]
    expect(comp.props.code).toContain('color:#000000')
    // the wrapper styles stay untouched — the visual lives in the code
    expect(comp.styles.backgroundColor).toBeUndefined()
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

describe('clipboard + selection shortcuts', () => {
  const comps = () => selectCurrentPage(useEditorStore.getState()).components

  it('copy + paste clones the selection with fresh ids, offset and selected', () => {
    freshTwoPageSchema()
    s().addComponent('button', 0, 0)
    s().addComponent('heading', 0, 0)
    const ids = comps().map((c) => c.id)
    s().setLayout(ids[0], { x: 10, y: 10, w: 100, h: 40 })
    s().selectMany(ids)
    s().copySelection()
    s().pasteClipboard()
    expect(comps()).toHaveLength(4) // two originals + two pasted
    const pasted = comps().slice(2)
    expect(pasted.map((c) => c.id)).not.toContain(ids[0]) // fresh ids
    expect(pasted[0].layout).toMatchObject({ x: 34, y: 34 }) // nudged +24
    expect(s().selectedIds).toEqual(pasted.map((c) => c.id)) // selects the copies
  })

  it('cut copies then removes the selection', () => {
    freshTwoPageSchema()
    s().addComponent('button', 0, 0)
    s().addComponent('button', 0, 0)
    const ids = comps().map((c) => c.id)
    s().selectMany([ids[0]])
    s().cutSelection()
    expect(comps()).toHaveLength(1)
    expect(comps()[0].id).toBe(ids[1])
    s().pasteClipboard() // the cut item is on the clipboard
    expect(comps()).toHaveLength(2)
  })

  it('duplicateSelection clones every selected item', () => {
    freshTwoPageSchema()
    s().addComponent('button', 0, 0)
    s().addComponent('button', 0, 0)
    s().selectMany(comps().map((c) => c.id))
    s().duplicateSelection()
    expect(comps()).toHaveLength(4)
  })

  it('selectAll selects every top-level component', () => {
    freshTwoPageSchema()
    s().addComponent('button', 0, 0)
    s().addComponent('button', 0, 0)
    s().addComponent('heading', 0, 0)
    s().selectComponent(null)
    s().selectAll()
    expect(s().selectedIds).toHaveLength(3)
  })

  it('removeSelection deletes all selected and clears the selection', () => {
    freshTwoPageSchema()
    s().addComponent('button', 0, 0)
    s().addComponent('button', 0, 0)
    s().selectMany(comps().map((c) => c.id))
    s().removeSelection()
    expect(comps()).toHaveLength(0)
    expect(s().selectedIds).toEqual([])
  })
})
