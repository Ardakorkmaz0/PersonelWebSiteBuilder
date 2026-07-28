// The Page panel only owns visual page and theme settings. Project code lives
// in Source and AI lives in its dedicated workspace.
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

  it('offers only Page and Theme', () => {
    renderPanel()
    expect(screen.getAllByRole('tab').map((el) => el.textContent.trim()))
      .toEqual(['Page', 'Theme'])
  })

  it('keeps the same focused tabs in Simple mode', () => {
    renderPanel({ simpleMode: true })
    expect(screen.getAllByRole('tab').map((el) => el.textContent.trim()))
      .toEqual(['Page', 'Theme'])
  })

  it('falls back when an old session remembers the removed Code tab', () => {
    localStorage.setItem('pwb_page_tab', 'code')
    renderPanel()
    expect(screen.getByRole('tab', { name: 'Page' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps every section reachable from one of the tabs', () => {
    const { container } = renderPanel()
    const seen = new Set()
    for (const tab of ['Page', 'Theme']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      container.querySelectorAll('button[aria-expanded]').forEach((el) => {
        seen.add(el.textContent.trim().split('(')[0].trim())
      })
    }
    for (const group of ['Page', 'Browser & accessibility', 'SEO & sharing', 'Theme', 'Colors']) {
      expect(seen, `"${group}" is not reachable from any tab`).toContain(group)
    }
  })

  it('edits the page SEO fields', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Search title'), { target: { value: 'My page' } })
    expect(useEditorStore.getState().schema.pages[0].seoTitle).toBe('My page')
  })

  it('edits browser metadata for the current page', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Page language'), { target: { value: 'tr' } })
    fireEvent.change(screen.getByLabelText('Canonical URL'), {
      target: { value: 'https://example.com/work' },
    })
    fireEvent.click(screen.getByLabelText('Hide this page from search engines'))

    const page = useEditorStore.getState().schema.pages[0]
    expect(page.language).toBe('tr')
    expect(page.canonicalUrl).toBe('https://example.com/work')
    expect(page.noIndex).toBe(true)
    expect(screen.getByLabelText('Search result preview')).toHaveTextContent('example.com/work')
  })

  it('offers richer typography, shape and shadow theme controls', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('tab', { name: 'Theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Type & corners' }))

    fireEvent.change(screen.getByLabelText('Heading font'), {
      target: { value: 'Georgia, serif' },
    })
    fireEvent.change(screen.getByLabelText('Corner style'), { target: { value: 'soft' } })
    fireEvent.change(screen.getByLabelText('Shadow preset'), { target: { value: 'strong' } })

    const theme = useEditorStore.getState().schema.theme
    expect(theme.headingFontFamily).toBe('Georgia, serif')
    expect(theme.radius).toBe('8px')
    expect(theme.buttonRadius).toBe('8px')
    expect(theme.shadow).toContain('0 18px 45px')
    expect(screen.getByLabelText('Theme preview')).toBeInTheDocument()
  })
})
