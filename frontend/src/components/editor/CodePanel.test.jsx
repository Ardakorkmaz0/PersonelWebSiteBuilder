import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import { useEditorStore } from '../../store/editorStore.js'
import CodePanel from './CodePanel.jsx'

function renderPanel(props = {}) {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <CodePanel {...props} />
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

describe('Source workspace', () => {
  beforeEach(() => {
    localStorage.clear()
    useEditorStore.getState().loadSchema({
      theme: {},
      customCss: '.old { color: red; }',
      customJs: 'console.log("old")',
      pages: [{ id: 'p1', name: 'Home', components: [] }],
    })
  })

  it('keeps the generated schema read-only', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /schema\.json/i }))
    expect(screen.getByLabelText('Generated source preview')).toBeInTheDocument()
    expect(screen.getByText('Generated read-only')).toBeInTheDocument()
  })

  it('shows the standalone and optimized exports as inspectable code files', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /home\.single\.html/i }))
    let preview = screen.getByLabelText('Generated source preview')
    expect(preview.textContent).toContain('.old { color: red; }')
    expect(preview.textContent).toContain('console.log("old")')
    expect(screen.getByText('Export preview')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /home\.optimized\.min\.html/i }))
    preview = screen.getByLabelText('Generated source preview')
    expect(preview.textContent).toContain('<!DOCTYPE html> <html')
    expect(preview.textContent).toContain('console.log("old")')
  })

  it('explains export choices in one neutral menu', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    expect(screen.getByRole('menu', { name: 'Choose an export format' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Single website file/i })).toBeInTheDocument()
    expect(screen.getByText(/Best for previewing, sharing or simple hosting/i))
      .toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Editable code project/i })).toBeInTheDocument()
    expect(screen.getByText(/Best for developers/i)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Optimized publication/i })).toBeInTheDocument()
    expect(screen.getByText(/Harder to read and edit afterward/i)).toBeInTheDocument()
  })

  it('edits and applies the current page HTML', () => {
    const onApplyHtml = vi.fn()
    renderPanel({ currentPageId: 'p1', onApplyHtml })
    const editor = screen.getByLabelText('HTML source editor')
    fireEvent.change(editor, {
      target: { value: editor.value.replace('</body>', '<h1>Changed</h1></body>') },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply HTML' }))
    const payload = onApplyHtml.mock.calls[0][0]
    expect(payload.pageId).toBe('p1')
    expect(payload.nextMode).toBe('source')
    expect(payload.html).toContain('<h1>Changed</h1>')
    expect(payload.html).toContain('<style data-pwb-project-styles>')
    expect(payload.html).toContain('<script data-pwb-project-runtime>')
    expect(payload.html).not.toContain('href="styles.css"')
    expect(payload.html).not.toContain('src="runtime.js"')
  })

  it('applies an HTML draft when Source is left', () => {
    const ref = createRef()
    const onApplyHtml = vi.fn()
    renderPanel({ ref, currentPageId: 'p1', onApplyHtml })
    const editor = screen.getByLabelText('HTML source editor')
    fireEvent.change(editor, {
      target: { value: editor.value.replace('</body>', '<p>Keep this draft</p></body>') },
    })
    act(() => ref.current.applyPendingHtml('view'))
    const payload = onApplyHtml.mock.calls[0][0]
    expect(payload.pageId).toBe('p1')
    expect(payload.nextMode).toBe('view')
    expect(payload.html).toContain('<p>Keep this draft</p>')
    expect(payload.html).toContain('<style data-pwb-custom-styles>')
    expect(payload.html).toContain('<script data-pwb-custom-script>')
  })

  it('edits project CSS from the Source workspace', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /custom\.css/i }))
    const editor = screen.getByLabelText('Custom CSS editor')
    fireEvent.change(editor, { target: { value: '.new { color: blue; }' } })
    expect(useEditorStore.getState().schema.customCss).toBe('.new { color: blue; }')
    expect(screen.getByText('Editable')).toBeInTheDocument()
  })

  it('edits project JavaScript from the Source workspace', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /custom\.js/i }))
    fireEvent.change(screen.getByLabelText('Custom JavaScript editor'), {
      target: { value: 'document.body.dataset.ready = "1"' },
    })
    expect(useEditorStore.getState().schema.customJs).toBe('document.body.dataset.ready = "1"')
  })
})
