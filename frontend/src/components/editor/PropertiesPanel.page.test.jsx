// The Page panel only owns visual page and theme settings. Project code lives
// in Source and AI lives in its dedicated workspace.
import { describe, expect, it, beforeEach, vi } from 'vitest'
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

  it('keeps the scroll indicator setting in the Page panel with browser metadata', () => {
    renderPanel()
    expect(screen.getByLabelText('Show scroll indicator in mobile preview')).toBeChecked()
    fireEvent.change(screen.getByLabelText('Page language'), { target: { value: 'tr' } })
    fireEvent.change(screen.getByLabelText('Canonical URL'), {
      target: { value: 'https://example.com/work' },
    })
    fireEvent.click(screen.getByLabelText('Hide this page from search engines'))
    fireEvent.click(screen.getByLabelText('Show scroll indicator in mobile preview'))

    const page = useEditorStore.getState().schema.pages[0]
    expect(page.language).toBe('tr')
    expect(page.canonicalUrl).toBe('https://example.com/work')
    expect(page.noIndex).toBe(true)
    expect(page.showScrollIndicator).toBe(false)
    expect(screen.getByLabelText('Search result preview')).toHaveTextContent('example.com/work')
  })

  it('publishes in any of the offered languages, not just two', () => {
    renderPanel()
    const select = screen.getByLabelText('Page language')
    const codes = Array.from(select.options).map((option) => option.value)

    expect(codes.length).toBeGreaterThan(40)
    expect(codes).toEqual(expect.arrayContaining(['en', 'tr', 'de', 'ja', 'ar', 'pt-BR']))
    expect(select.options[codes.indexOf('tr')].textContent).toBe('Türkçe')

    fireEvent.change(select, { target: { value: 'ja' } })
    expect(useEditorStore.getState().schema.pages[0].language).toBe('ja')
  })

  it('edits reading direction, smooth scrolling and the browser theme colour', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('Text direction'), { target: { value: 'rtl' } })
    fireEvent.click(screen.getByLabelText('Smooth scrolling for in-page links'))
    fireEvent.change(screen.getByLabelText('Browser theme color'), { target: { value: '#0f172a' } })

    const page = useEditorStore.getState().schema.pages[0]
    expect(page.direction).toBe('rtl')
    expect(page.smoothScroll).toBe(true)
    expect(page.themeColor).toBe('#0f172a')
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

// An uploaded page has no schema to edit: the document IS the page. These
// controls used to write into the schema, where nothing published them — so a
// language picked here changed nothing at all.
describe('Page panel on an uploaded HTML page', () => {
  const settings = {
    language: 'de',
    direction: 'rtl',
    themeColor: '#0f172a',
    smoothScroll: true,
    noIndex: true,
    canonicalUrl: 'https://example.com/about',
    seoTitle: 'About us',
    seoDescription: 'Who we are',
  }

  beforeEach(() => {
    localStorage.clear()
    emptyPageNoSelection()
  })

  it('shows what the document says, not what the schema holds', () => {
    renderPanel({ htmlMode: true, htmlPageSettings: settings, onHtmlPageSettings: () => {} })

    expect(screen.getByLabelText('Page language')).toHaveValue('de')
    expect(screen.getByLabelText('Text direction')).toHaveValue('rtl')
    expect(screen.getByLabelText('Smooth scrolling for in-page links')).toBeChecked()
    expect(screen.getByLabelText('Hide this page from search engines')).toBeChecked()
    expect(screen.getByLabelText('Canonical URL')).toHaveValue('https://example.com/about')
    expect(screen.getByLabelText('Search title')).toHaveValue('About us')
    // The schema page is still 'en' — the panel is reading the document.
    expect(useEditorStore.getState().schema.pages[0].language).toBe('en')
  })

  it('writes every change back to the document instead of the schema', () => {
    const onHtmlPageSettings = vi.fn()
    renderPanel({ htmlMode: true, htmlPageSettings: settings, onHtmlPageSettings })

    fireEvent.change(screen.getByLabelText('Page language'), { target: { value: 'ja' } })
    fireEvent.click(screen.getByLabelText('Hide this page from search engines'))
    fireEvent.change(screen.getByLabelText('Search description'), { target: { value: 'New words' } })

    expect(onHtmlPageSettings).toHaveBeenNthCalledWith(1, { language: 'ja' })
    expect(onHtmlPageSettings).toHaveBeenNthCalledWith(2, { noIndex: false })
    expect(onHtmlPageSettings).toHaveBeenNthCalledWith(3, { seoDescription: 'New words' })
    expect(useEditorStore.getState().schema.pages[0].language).toBe('en')
  })

  it('leaves out the controls that only act on the component canvas', () => {
    renderPanel({ htmlMode: true, htmlPageSettings: settings, onHtmlPageSettings: () => {} })

    expect(screen.queryByLabelText('Page background (PC)')).toBeNull()
    expect(screen.queryByLabelText('Show scroll indicator in mobile preview')).toBeNull()
  })
})
