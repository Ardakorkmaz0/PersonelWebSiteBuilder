// A project's HTML pages survive import → view → save → export → undo.
//
// Importing a project .json used to clear the editor's page-HTML map right
// after loading the schema, so every HTML page opened blank and the next save
// sent '' over the real documents. Exporting wrote the store's copy of each
// page's HTML, which was only filled at load time. This mounts the real editor
// against a mocked API and drives the whole round trip.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const updateSite = vi.fn(async (id, payload) => ({ ...payload, slug: 'rt' }))

vi.mock('../api/sites.js', () => ({
  getSite: vi.fn(async () => ({
    id: 1, title: 'Round trip', slug: 'rt', published: false, category: 'other', tags: [], html: '', site_options: {},
    schema: {
      theme: {},
      pages: [{
        id: 'old_home',
        name: 'Old',
        components: [{ id: 'h1', type: 'heading', props: { text: 'Before import' }, styles: {}, layout: { x: 20, y: 20, w: 400, h: 60 } }],
      }],
    },
  })),
  updateSite: (...args) => updateSite(...args),
  patchSite: vi.fn(async () => ({})),
}))

import EditorPage from './EditorPage.jsx'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import { useEditorStore } from '../store/editorStore.js'

const LANDING = '<!doctype html><html><head><title>Landing</title></head><body><h1>Imported landing page</h1></body></html>'
const PROJECT = {
  theme: {},
  pages: [
    { id: 'p_components', name: 'Home', components: [{ id: 't1', type: 'text', props: { text: 'Component page' }, styles: {}, layout: { x: 10, y: 10, w: 300, h: 40 } }] },
    { id: 'p_landing', name: 'Landing', mode: 'html', html: LANDING, components: [] },
  ],
}

beforeEach(() => {
  updateSite.mockClear()
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

// waitFor's own default is one second, while these tests budget thirty. The
// editor and the HTML workspace are both React.lazy chunks, so under a loaded
// full-suite run the import alone can outlast that second and the assertion
// fails on a page that was merely still arriving. Waiting properly is not the
// same as waiting longer: nothing here sleeps, it just stops giving up early.
const SLOW = { timeout: 15000 }

async function openEditor() {
  render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/editor/1']}>
          <Routes><Route path="/editor/:id" element={<EditorPage />} /></Routes>
        </MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
  await waitFor(() => expect(document.querySelector('[data-cid="h1"]')).toBeTruthy(), SLOW)
}

async function importProject(project) {
  const input = document.querySelector('input[type="file"][accept=".json,application/json"]')
  const file = new File([JSON.stringify(project)], 'project.json', { type: 'application/json' })
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
  await waitFor(() => expect(useEditorStore.getState().schema.pages.map((p) => p.id)).toEqual(['p_components', 'p_landing']), SLOW)
}

function saveNow() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
}

describe('project round trip', () => {
  it('opens an imported HTML page with its document, not blank', async () => {
    await openEditor()
    await importProject(PROJECT)
    await act(async () => useEditorStore.getState().selectPage('p_landing'))
    await waitFor(() => expect(screen.getByTitle('site').getAttribute('srcdoc') || '').toContain('Imported landing page'), SLOW)
  }, 30000)

  it('saves the imported document instead of an empty one', async () => {
    await openEditor()
    await importProject(PROJECT)
    await act(async () => saveNow())
    await waitFor(() => expect(updateSite).toHaveBeenCalled(), SLOW)
    const payload = updateSite.mock.calls.at(-1)[1]
    const landing = payload.schema.pages.find((p) => p.id === 'p_landing')
    expect(landing.html).toContain('Imported landing page')
    expect(payload.schema.pages.find((p) => p.id === 'p_components').html).toBe('')
  }, 30000)

  it('keeps no stale copy of page HTML in the store schema', async () => {
    await openEditor()
    await importProject(PROJECT)
    for (const page of useEditorStore.getState().schema.pages) expect(page).not.toHaveProperty('html')
  }, 30000)

  it('exports the pages as they are now, HTML included', async () => {
    let exported = null
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      exported = blob
      return 'blob:x'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await openEditor()
    await importProject(PROJECT)
    // Export is offered on the component page. With no page HTML left in the
    // store, only the shared snapshot can put the landing document in the file.
    await act(async () => useEditorStore.getState().selectPage('p_components'))
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(await screen.findByText(/Export project \(\.json\)/))
    expect(createObjectURL).toHaveBeenCalled()
    const json = JSON.parse(await exported.text())
    expect(json.pages.find((p) => p.id === 'p_landing').html).toContain('Imported landing page')
  }, 30000)

  it('undoing the import brings back the previous pages and their HTML', async () => {
    await openEditor()
    await importProject(PROJECT)
    await act(async () => useEditorStore.getState().undo())
    expect(useEditorStore.getState().schema.pages.map((p) => p.id)).toEqual(['old_home'])
    await act(async () => useEditorStore.getState().redo())
    await act(async () => useEditorStore.getState().selectPage('p_landing'))
    await waitFor(() => expect(screen.getByTitle('site').getAttribute('srcdoc') || '').toContain('Imported landing page'), SLOW)
  }, 30000)
})
