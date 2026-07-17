import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import HistoryPanel from './HistoryPanel.jsx'
import { listVersions, setVersionPinned } from '../../api/versions.js'

vi.mock('../../api/versions.js', () => ({
  listVersions: vi.fn(),
  restoreVersion: vi.fn(),
  createCheckpoint: vi.fn(),
  overwriteVersion: vi.fn(),
  setVersionPinned: vi.fn(),
  deleteVersion: vi.fn(),
}))

function renderPanel(props = {}) {
  return render(
    <LanguageProvider>
      <HistoryPanel open siteId="7" onClose={vi.fn()} {...props} />
    </LanguageProvider>,
  )
}

describe('HistoryPanel save sources and pins', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
    vi.clearAllMocks()
    listVersions.mockResolvedValue([
      { id: 1, source: 'manual', pinned: false, label: '', created_at: '2026-07-15T10:00:00Z' },
      { id: 2, source: 'auto', pinned: true, label: '', created_at: '2026-07-15T09:00:00Z' },
    ])
    setVersionPinned.mockResolvedValue({})
  })

  it('separates manual and automatic saves without using the pin as the source', async () => {
    const { container } = renderPanel()
    expect(container.firstChild).toHaveClass('studio-theme-surface')
    expect(await screen.findByText('Manual save')).toBeInTheDocument()
    expect(screen.getByText('Auto-saved snapshot')).toBeInTheDocument()
    expect(screen.getAllByText(/manual|auto/i).length).toBeGreaterThan(1)
  })

  it('pins and unpins rows independently and exposes the auto-save switch', async () => {
    const onAutoSaveEnabled = vi.fn()
    renderPanel({ autoSaveEnabled: false, onAutoSaveEnabled })
    await screen.findByText('Manual save')

    fireEvent.click(screen.getByRole('button', { name: 'Pin' }))
    await waitFor(() => expect(setVersionPinned).toHaveBeenCalledWith('7', 1, true))

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onAutoSaveEnabled).toHaveBeenCalledWith(true)
  })
})
