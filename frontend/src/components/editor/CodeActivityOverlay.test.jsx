// The ticker has to show the REAL file: what it types is the diff of the
// document the exporter writes, not a description of the setting that changed.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import CodeActivityOverlay from './CodeActivityOverlay.jsx'
import { useEditorStore } from '../../store/editorStore.js'

function renderOverlay(pageId = 'p1') {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <CodeActivityOverlay pageId={pageId} title="My Site" />
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

function seedPages(home = {}) {
  const store = useEditorStore.getState()
  store.loadSchema({
    theme: {},
    pages: [
      { id: 'p1', name: 'Home', components: [], ...home },
      { id: 'p2', name: 'About', components: [] },
    ],
  })
  store.selectPage('p1')
}

const card = () => document.querySelector('.code-activity')
const codeText = () => document.querySelector('.code-activity-body')?.textContent || ''

describe('CodeActivityOverlay', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
    seedPages()
  })

  it('stays out of the way until an edit changes the page', async () => {
    renderOverlay()
    await new Promise((resolve) => window.setTimeout(resolve, 260))
    expect(card()).toBeNull()
  })

  it('types out the line a settings change rewrote, then retires the card', async () => {
    renderOverlay()
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    act(() => useEditorStore.getState().setPageSettings('p1', { language: 'tr' }))

    expect(await screen.findByText('Live code')).toBeInTheDocument()
    await waitFor(() => expect(codeText()).toContain('lang="tr"'), { timeout: 2000 })
    // The line number is the document's own, so the user can find it in Source.
    expect(document.querySelector('.code-activity-file').textContent).toMatch(/^index\.html:\d+$/)
    await waitFor(() => expect(card()).toBeNull(), { timeout: 4000 })
  })

  it('shows a removed line when an edit takes code away', async () => {
    act(() => useEditorStore.getState().setPageSettings('p1', { noIndex: true }))
    renderOverlay()
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    act(() => useEditorStore.getState().setPageSettings('p1', { noIndex: false }))

    await waitFor(() => expect(codeText()).toContain('noindex'), { timeout: 2000 })
    expect(document.querySelector('.code-activity-line-removed')).toBeTruthy()
  })

  // "Every change" is the point of the feature: a setting, a block, an
  // animation, the theme and hand-written CSS all reach the document, so all of
  // them have to reach the ticker.
  it.each([
    ['an animation', () => useEditorStore.getState().updateProps('c1', { animIn: 'fade-up' }), 'fade-up'],
    ['the theme', () => useEditorStore.getState().updateTheme({ primaryColor: '#ff00aa' }), '#ff00aa'],
    ['project CSS', () => useEditorStore.getState().setCustomCss('.hero { gap: 12px }'), 'gap: 12px'],
    ['a block edit', () => useEditorStore.getState().updateProps('c1', { text: 'Merhaba' }), 'Merhaba'],
  ])('reports %s', async (_label, edit, expected) => {
    seedPages({ components: [{ id: 'c1', type: 'heading', props: { text: 'Hi' }, layout: { x: 0, y: 0, w: 300, h: 60 } }] })
    renderOverlay()
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    act(edit)

    await waitFor(() => expect(codeText()).toContain(expected), { timeout: 2000 })
  })

  // Moving a block rewrites the STYLESHEET, not the markup: reading only the
  // page's html reported nothing at all for a drag across the canvas.
  it('reports a move, and says which file it happened in', async () => {
    seedPages({ components: [{ id: 'c1', type: 'heading', props: { text: 'Hi' }, layout: { x: 0, y: 0, w: 300, h: 60 } }] })
    renderOverlay()
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    act(() => useEditorStore.getState().setLayout('c1', { x: 240, y: 96, w: 300, h: 60 }))

    await waitFor(() => expect(codeText()).toMatch(/240px|96px/), { timeout: 2000 })
    expect(document.querySelector('.code-activity-file').textContent).toContain('styles.css')
  })

  it('hands the whole changed region to the editor, not just the first line', async () => {
    const onOpenSource = vi.fn()
    seedPages({ components: [{ id: 'c1', type: 'heading', props: { text: 'Hi' }, layout: { x: 0, y: 0, w: 300, h: 60 } }] })
    render(
      <UiThemeProvider>
        <LanguageProvider>
          <CodeActivityOverlay pageId="p1" title="My Site" holdMs={0} onOpenSource={onOpenSource} />
        </LanguageProvider>
      </UiThemeProvider>,
    )
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    act(() => useEditorStore.getState().addComponent('navbar'))
    await waitFor(() => expect(document.querySelector('.code-activity')).not.toBeNull(), { timeout: 2000 })
    fireEvent.click(screen.getByRole('button', { name: 'Open in Source' }))

    const target = onOpenSource.mock.calls[0][0]
    expect(target.file).toBeTruthy()
    expect(target.endLine).toBeGreaterThanOrEqual(target.line)
  })

  it('works from the document itself for an HTML page', async () => {
    const doc = (heading) => ['<html>', '<body>', `<h1>${heading}</h1>`, '</body>', '</html>'].join('\n')
    const page = (heading) => (
      <UiThemeProvider>
        <LanguageProvider>
          <CodeActivityOverlay document={doc(heading)} fileName="about.html" />
        </LanguageProvider>
      </UiThemeProvider>
    )
    const { rerender } = render(page('Hi'))
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    rerender(page('Merhaba'))

    await waitFor(() => expect(codeText()).toContain('<h1>Merhaba</h1>'), { timeout: 2000 })
    expect(document.querySelector('.code-activity-file').textContent).toBe('about.html:3')
  })

  // A line holding several tags is shown split at them, so its rows share one
  // line number — which React warned about as duplicate keys on every edit.
  it('shows every row of a line split at its tags', async () => {
    const doc = (text) => ['<html>', '<body>', `<p>${text}</p><p>${text}</p>`, '</body>', '</html>'].join('\n')
    const page = (text) => (
      <UiThemeProvider>
        <LanguageProvider>
          <CodeActivityOverlay document={doc(text)} fileName="index.html" />
        </LanguageProvider>
      </UiThemeProvider>
    )
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { rerender } = render(page('Ilk'))
      await new Promise((resolve) => window.setTimeout(resolve, 220))

      rerender(page('Yeni'))

      await waitFor(() => expect(document.querySelectorAll('.code-activity-line')).toHaveLength(2), { timeout: 2000 })
      const rows = [...document.querySelectorAll('.code-activity-number')].map((n) => n.textContent)
      expect(rows).toEqual(['3', '3'])
      expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/)
    } finally {
      errors.mockRestore()
    }
  })

  it('stays until it is closed when the hold is set to zero', async () => {
    render(
      <UiThemeProvider>
        <LanguageProvider>
          <CodeActivityOverlay pageId="p1" title="My Site" holdMs={0} />
        </LanguageProvider>
      </UiThemeProvider>,
    )
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    act(() => useEditorStore.getState().setPageSettings('p1', { language: 'tr' }))
    await waitFor(() => expect(codeText()).toContain('lang="tr"'), { timeout: 2000 })

    // Well past the default hold: it is still there.
    await new Promise((resolve) => window.setTimeout(resolve, 2200))
    expect(card()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(card()).toBeNull()
  })

  it('hands the changed line to the editor when the card is clicked', async () => {
    const onOpenSource = vi.fn()
    render(
      <UiThemeProvider>
        <LanguageProvider>
          <CodeActivityOverlay pageId="p1" title="My Site" holdMs={0} onOpenSource={onOpenSource} />
        </LanguageProvider>
      </UiThemeProvider>,
    )
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    act(() => useEditorStore.getState().setPageSettings('p1', { language: 'tr' }))
    await waitFor(() => expect(codeText()).toContain('lang="tr"'), { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: 'Open in Source' }))

    expect(onOpenSource).toHaveBeenCalledTimes(1)
    const target = onOpenSource.mock.calls[0][0]
    expect(target.text).toContain('lang="tr"')
    expect(target.line).toBeGreaterThan(0)
  })

  it('does not fade while the pointer is on it', async () => {
    renderOverlay()
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    act(() => useEditorStore.getState().setPageSettings('p1', { language: 'tr' }))
    await waitFor(() => expect(codeText()).toContain('lang="tr"'), { timeout: 2000 })

    fireEvent.mouseEnter(card())
    await new Promise((resolve) => window.setTimeout(resolve, 2200))
    expect(card()).not.toBeNull()

    fireEvent.mouseLeave(card())
    await waitFor(() => expect(card()).toBeNull(), { timeout: 4000 })
  })

  it('does not read a page switch as an edit', async () => {
    const { rerender } = renderOverlay('p1')
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    rerender(
      <UiThemeProvider>
        <LanguageProvider>
          <CodeActivityOverlay pageId="p2" title="My Site" />
        </LanguageProvider>
      </UiThemeProvider>,
    )
    await new Promise((resolve) => window.setTimeout(resolve, 300))

    expect(card()).toBeNull()
  })
})
