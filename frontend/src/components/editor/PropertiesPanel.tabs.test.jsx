// The Properties panel groups ~20 sections under four tabs. These pin the
// STRUCTURE: that the tabs exist, that switching one reveals its groups, and —
// most importantly — that no section was orphaned during the regrouping.
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import PropertiesPanel from './PropertiesPanel.jsx'
import { useEditorStore } from '../../store/editorStore.js'

function renderPanel() {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <PropertiesPanel />
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

// A card carries content, styles, size, motion and visibility, so it exercises
// every tab at once.
function selectACard() {
  const s = useEditorStore.getState()
  s.loadSchema({ theme: {}, pages: [{ id: 'p1', name: 'Home', components: [] }] })
  s.selectPage('p1')
  s.addComponent('card', 20, 20)
  const id = useEditorStore.getState().schema.pages[0].components[0].id
  useEditorStore.getState().selectComponent(id)
  return id
}

const TABS = ['Content', 'Design', 'Layout', 'Motion']

describe('Properties panel tabs', () => {
  beforeEach(() => {
    localStorage.clear()
    selectACard()
  })

  it('offers exactly the four sections', () => {
    renderPanel()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((el) => el.textContent.trim())).toEqual(TABS)
  })

  it('opens on Content and switches when another tab is picked', () => {
    renderPanel()
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Layout' }))
    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'false')
  })

  // The regrouping moved every section by hand; this is the guard that none was
  // dropped on the floor. Each group must be reachable from SOME tab.
  it('keeps every section reachable from one of the tabs', () => {
    const { container, unmount } = renderPanel()
    const seen = new Set()
    for (const tab of TABS) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      // Group headers are the only buttons that carry aria-expanded.
      container.querySelectorAll('button[aria-expanded]').forEach((el) => {
        seen.add(el.textContent.trim().split('(')[0].trim())
      })
    }
    unmount()

    for (const group of ['Content', 'Presets', 'Typography', 'Colors', 'Position & Size', 'Responsive', 'Motion', 'Scroll']) {
      expect(seen, `"${group}" is not reachable from any tab`).toContain(group)
    }
  })

  it('remembers the tab across mounts', () => {
    const { unmount } = renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: 'Design' }))
    unmount()

    renderPanel()
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true')
  })

  it('collapses and expands a group, and remembers that too', () => {
    const { unmount } = renderPanel()
    const content = screen.getByRole('button', { name: /^Content/ })
    expect(content).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(content)
    expect(content).toHaveAttribute('aria-expanded', 'false')
    unmount()

    renderPanel()
    expect(screen.getByRole('button', { name: /^Content/ })).toHaveAttribute('aria-expanded', 'false')
  })
})
