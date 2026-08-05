// Moderating a shared block is the one admin action that can reach pages the
// moderator does not own. So the queue has to show the actual block, and the
// two takedowns have to stay clearly different things.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import AdminPage from './AdminPage.jsx'
import {
  listComponentReports,
  resolveComponentReport,
  moderateComponent,
} from '../api/admin.js'

vi.mock('../api/admin.js', () => ({
  listAdminUsers: vi.fn(() => Promise.resolve({ results: [], count: 0 })),
  getAdminStats: vi.fn(() => Promise.resolve({})),
  listReports: vi.fn(() => Promise.resolve({ results: [], count: 0 })),
  resolveReport: vi.fn(),
  suspendUser: vi.fn(),
  moderateSite: vi.fn(),
  listComponentReports: vi.fn(),
  resolveComponentReport: vi.fn(),
  moderateComponent: vi.fn(),
}))

const REPORT = {
  id: 5,
  reason: 'malware',
  reason_label: 'Malicious or phishing',
  detail: 'fake login form',
  status: 'open',
  created_at: '2026-08-01T10:00:00Z',
  reporter_username: 'taker',
  component: 3,
  component_title: 'Pricing card',
  component_status: 'published',
  component_use_count: 7,
  component_author: 'ada',
  component_html: '<div class="card">Pro</div>',
  component_css: '.card { padding: 24px; }',
}

async function openBlocksTab() {
  localStorage.setItem('pwb_language', 'en')
  render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Blocks' }))
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  listComponentReports.mockResolvedValue({ results: [REPORT], count: 1 })
  resolveComponentReport.mockResolvedValue({})
  moderateComponent.mockResolvedValue({ sites_touched: 3, copies_removed: 4 })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('the flagged-blocks queue', () => {
  it('opens on the blocks that are still open, not the whole history', async () => {
    await openBlocksTab()
    await screen.findByText('Pricing card')
    expect(listComponentReports).toHaveBeenCalledWith('open')
  })

  it('shows the block itself, rendered without the power to run anything', async () => {
    await openBlocksTab()
    const frame = await screen.findByTitle('Pricing card')
    expect(frame.getAttribute('srcdoc')).toContain('Pro')
    expect(frame.getAttribute('srcdoc')).toContain('padding: 24px')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin')
  })

  it('says who flagged it, why, and how far the block already travelled', async () => {
    await openBlocksTab()
    await screen.findByText('Pricing card')
    expect(screen.getByText('Malicious or phishing')).toBeInTheDocument()
    expect(screen.getByText(/fake login form/)).toBeInTheDocument()
    // The number that decides whether a purge is proportionate.
    expect(screen.getByText(/7 uses/)).toBeInTheDocument()
  })
})

describe('the two takedowns', () => {
  it('unlists without touching anyone’s page', async () => {
    const user = await openBlocksTab()
    await screen.findByText('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Unlist block' }))

    expect(moderateComponent).toHaveBeenCalledWith(3, 'remove')
    // The confirmation has to say which of the two this is.
    expect(window.confirm.mock.calls[0][0]).toMatch(/Copies already taken stay where they are/)
  })

  it('warns that a purge edits other people’s sites, and names the count', async () => {
    const user = await openBlocksTab()
    await screen.findByText('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Delete everywhere' }))

    expect(window.confirm.mock.calls[0][0]).toMatch(/7 site\(s\)/)
    expect(window.confirm.mock.calls[0][0]).toMatch(/cannot be undone/)
    expect(moderateComponent).toHaveBeenCalledWith(3, 'purge')
  })

  it('does nothing at all when the confirmation is declined', async () => {
    window.confirm.mockReturnValue(false)
    const user = await openBlocksTab()
    await screen.findByText('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Delete everywhere' }))

    expect(moderateComponent).not.toHaveBeenCalled()
    expect(screen.getByText('Pricing card')).toBeInTheDocument()
  })

  it('dismisses a report without moderating the block', async () => {
    const user = await openBlocksTab()
    await screen.findByText('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(resolveComponentReport).toHaveBeenCalledWith(5, 'dismiss')
    expect(moderateComponent).not.toHaveBeenCalled()
  })
})

describe('a block that is already down', () => {
  it('offers no second unlisting, but can still be purged', async () => {
    listComponentReports.mockResolvedValue({
      results: [{ ...REPORT, component_status: 'removed' }],
      count: 1,
    })
    await openBlocksTab()
    await screen.findByText('Pricing card')

    expect(screen.queryByRole('button', { name: 'Unlist block' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete everywhere' })).toBeInTheDocument()
  })
})
