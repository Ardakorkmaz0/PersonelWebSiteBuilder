// The Page panel (nothing selected) groups its sections under four tabs. These
// pin the structure and the two rules that are easy to break: Simple mode must
// not leave an empty tab in the list, and no section may be orphaned.
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import PropertiesPanel from './PropertiesPanel.jsx'
import { useEditorStore } from '../../store/editorStore.js'

function renderPanel(props = {}) {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <PropertiesPanel {...props} />
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

function emptyPageNoSelection() {
  const s = useEditorStore.getState()
  s.loadSchema({ theme: {}, pages: [{ id: 'p1', name: 'Home', components: [] }] })
  s.selectPage('p1')
  s.selectComponent(null)
}

describe('Page panel tabs', () => {
  beforeEach(() => {
    localStorage.clear()
    emptyPageNoSelection()
  })

  it('offers Page, Theme, Code and AI', () => {
    renderPanel()
    expect(screen.getAllByRole('tab').map((el) => el.textContent.trim()))
      .toEqual(['Page', 'Theme', 'Code', 'AI'])
  })

  // Simple mode strips the Code and AI content entirely, so those tabs must not
  // be drawn at all rather than opening onto nothing.
  it('hides the tabs that Simple mode empties', () => {
    renderPanel({ simpleMode: true })
    expect(screen.getAllByRole('tab').map((el) => el.textContent.trim()))
      .toEqual(['Page', 'Theme'])
  })

  it('falls back to a visible tab when the remembered one is hidden', () => {
    const { unmount } = renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: 'Code' }))
    unmount()

    // Re-open in Simple mode: "Code" is gone, so Page takes over.
    renderPanel({ simpleMode: true })
    expect(screen.getByRole('tab', { name: 'Page' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps every section reachable from one of the tabs', () => {
    const { container } = renderPanel()
    const seen = new Set()
    for (const tab of ['Page', 'Theme', 'Code', 'AI']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      container.querySelectorAll('button[aria-expanded]').forEach((el) => {
        seen.add(el.textContent.trim().split('(')[0].trim())
      })
    }
    for (const group of ['Page', 'SEO & sharing', 'Theme', 'Colors', 'Custom CSS', 'Custom JavaScript']) {
      expect(seen, `"${group}" is not reachable from any tab`).toContain(group)
    }
  })

  it('edits the page SEO fields', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Search title'), { target: { value: 'My page' } })
    expect(useEditorStore.getState().schema.pages[0].seoTitle).toBe('My page')
  })
})
