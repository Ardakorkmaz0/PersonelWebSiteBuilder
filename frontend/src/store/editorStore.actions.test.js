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
