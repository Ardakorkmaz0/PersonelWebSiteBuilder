// The component canvas's Ctrl+C / Ctrl+X / Ctrl+V used to call preventDefault
// before checking there was anything to copy, so with no component selected the
// browser's own copy never ran either — text highlighted on the canvas could
// not be copied at all. Mounts the real editor page against a mocked API.
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/sites.js', () => ({
  getSite: vi.fn(async () => ({
    id: 1, title: 'Clipboard', slug: 'clip', published: false, category: 'other', tags: [], html: '', site_options: {},
    schema: {
      theme: {},
      pages: [{
        id: 'p1',
        name: 'Home',
        components: [{ id: 'h1', type: 'heading', props: { text: 'Hello' }, styles: {}, layout: { x: 20, y: 20, w: 400, h: 60 } }],
      }],
    },
  })),
  updateSite: vi.fn(async (id, payload) => ({ ...payload, slug: 'clip' })),
  patchSite: vi.fn(async () => ({})),
}))

import EditorPage from './EditorPage.jsx'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import { useEditorStore } from '../store/editorStore.js'

async function openEditor() {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/editor/1']}>
          <Routes><Route path="/editor/:id" element={<EditorPage />} /></Routes>
        </MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
  await waitFor(() => expect(document.querySelector('[data-cid="h1"]')).toBeTruthy())
}

function press(key) {
  const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('editor clipboard shortcuts', () => {
  it('leave copy, cut and paste to the browser when the editor has nothing to do', async () => {
    await openEditor()
    useEditorStore.getState().selectComponent(null)
    expect(press('c').defaultPrevented).toBe(false)
    expect(press('x').defaultPrevented).toBe(false)
    expect(press('v').defaultPrevented).toBe(false)
  }, 30000)

  it('copy and paste a selected component', async () => {
    await openEditor()
    useEditorStore.getState().selectComponent('h1')
    expect(press('c').defaultPrevented).toBe(true)
    expect(useEditorStore.getState().clipboard).toHaveLength(1)
    expect(press('v').defaultPrevented).toBe(true)
    const components = useEditorStore.getState().schema.pages[0].components
    expect(components).toHaveLength(2)
  }, 30000)

  it('let the browser copy highlighted text even with a component selected', async () => {
    await openEditor()
    useEditorStore.getState().selectComponent('h1')
    const text = document.querySelector('[data-cid="h1"]')
    const range = document.createRange()
    range.selectNodeContents(text)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
    expect(press('c').defaultPrevented).toBe(false)
    window.getSelection().removeAllRanges()
  }, 30000)
})
