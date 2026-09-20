import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import { searchDashboard } from '../../api/search.js'
import DashboardGlobalSearch from './DashboardGlobalSearch.jsx'

vi.mock('../../api/search.js', () => ({ searchDashboard: vi.fn() }))
vi.mock('./SitePreview.jsx', () => ({
  default: ({ site }) => <div data-testid="site-preview">{site.slug}</div>,
}))

const ADA = { id: 3, username: 'ada', display_name: 'Ada Studio', avatar_url: '', published_site_count: 2 }
const GRACE = { id: 4, username: 'grace', display_name: 'Grace Studio', avatar_url: '', published_site_count: 1 }

function CurrentLocation() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}{location.search}</span>
}

function renderSearch(props = {}) {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter><DashboardGlobalSearch {...props} /><CurrentLocation /></MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

function searchInput() {
  return screen.getByRole('searchbox', { name: 'Search sites and creators' })
}

describe('DashboardGlobalSearch', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
    vi.mocked(searchDashboard).mockReset()
    vi.mocked(searchDashboard).mockResolvedValue({ sites: [], users: [] })
  })

  it('waits for two characters before searching or allowing submission', async () => {
    renderSearch()
    fireEvent.change(searchInput(), { target: { value: 'a' } })

    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
    fireEvent.submit(screen.getByRole('search'))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    await new Promise((resolve) => window.setTimeout(resolve, 260))
    expect(searchDashboard).not.toHaveBeenCalled()
  })

  it('suggests people and the first few matching sites with a thumbnail', async () => {
    vi.mocked(searchDashboard).mockResolvedValueOnce({
      sites: [1, 2, 3, 4].map((id) => ({ id, title: `Ada Portfolio ${id}`, slug: `ada-${id}`, owner_display_name: 'Ada Team' })),
      users: [ADA],
    })
    renderSearch()
    fireEvent.change(searchInput(), { target: { value: 'ada' } })

    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
    expect(await screen.findByRole('link', { name: /Ada Studio/ })).toHaveAttribute('href', '/u/3')
    expect(searchDashboard).toHaveBeenCalledWith('ada', { type: 'all' })
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sites' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ada Portfolio 1/ })).toHaveAttribute('href', '/site/ada-1')
    // Only the first few sites ride along; the rest live on the results page.
    expect(screen.getAllByTestId('site-preview')).toHaveLength(3)
    expect(screen.queryByText('Ada Portfolio 4')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all results' })).toHaveAttribute('href', '/search?q=ada&type=all')
  })

  it('closes the suggestions when a site is opened', async () => {
    const onNavigate = vi.fn()
    vi.mocked(searchDashboard).mockResolvedValue({
      users: [], sites: [{ id: 10, title: 'Ada Portfolio', slug: 'ada-portfolio', owner_display_name: 'Ada Studio' }],
    })
    renderSearch({ mobile: true, onNavigate })
    fireEvent.change(searchInput(), { target: { value: 'ada' } })
    fireEvent.click(await screen.findByRole('link', { name: /Ada Portfolio/ }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('location')).toHaveTextContent('/site/ada-portfolio')
    expect(screen.queryByRole('heading', { name: 'People' })).not.toBeInTheDocument()
  })

  it('opens the full results page from the Search button and closes suggestions', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(searchInput(), '  ada  ')
    await user.click(screen.getByRole('button', { name: 'Search', exact: true }))

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=ada&type=all')
    expect(searchInput()).toHaveAttribute('aria-expanded', 'false')
  })

  it('submits Enter with an encoded query and keeps the selected results filter', async () => {
    const user = userEvent.setup()
    renderSearch({ initialQuery: 'Ada & Grace', resultType: 'sites', label: 'Search query', formLabel: 'Search results' })
    const input = screen.getByRole('searchbox', { name: 'Search query' })
    expect(input).toHaveValue('Ada & Grace')
    expect(input).toHaveAttribute('maxlength', '80')
    expect(screen.getByRole('search', { name: 'Search results' })).toBeInTheDocument()
    await user.click(input)
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=Ada+%26+Grace&type=sites')
  })

  it('hides previous people immediately while the next query is pending and ignores stale responses', async () => {
    let resolveAda
    let resolveGrace
    vi.mocked(searchDashboard)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAda = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveGrace = resolve }))
    renderSearch()
    fireEvent.change(searchInput(), { target: { value: 'ada' } })
    await waitFor(() => expect(searchDashboard).toHaveBeenCalledWith('ada', { type: 'all' }))
    fireEvent.change(searchInput(), { target: { value: 'grace' } })
    await act(async () => resolveAda({ users: [ADA] }))

    expect(screen.queryByRole('link', { name: /Ada Studio/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
    await waitFor(() => expect(searchDashboard).toHaveBeenCalledWith('grace', { type: 'all' }))
    await act(async () => resolveGrace({ users: [GRACE] }))
    expect(screen.getByRole('link', { name: /Grace Studio/ })).toBeInTheDocument()
    fireEvent.change(searchInput(), { target: { value: 'ada' } })
    expect(screen.queryByRole('link', { name: /Grace Studio/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
  })

  it('still offers full results when no person matches or suggestions fail', async () => {
    vi.mocked(searchDashboard).mockRejectedValueOnce(new Error('offline'))
    renderSearch()
    fireEvent.change(searchInput(), { target: { value: 'ada' } })
    expect(await screen.findByText('Search could not be completed.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all results' })).toHaveAttribute('href', '/search?q=ada&type=all')
    fireEvent.change(searchInput(), { target: { value: 'grace' } })
    expect(await screen.findByText('No results found.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search', exact: true })).toBeEnabled()
  })

  it('calls the mobile navigation callback for both a person and full results', async () => {
    const onNavigate = vi.fn()
    vi.mocked(searchDashboard).mockResolvedValue({ users: [ADA] })
    renderSearch({ mobile: true, onNavigate })
    fireEvent.change(searchInput(), { target: { value: 'ada' } })
    fireEvent.click(await screen.findByRole('link', { name: /Ada Studio/ }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('location')).toHaveTextContent('/u/3')
    fireEvent.focus(searchInput())
    fireEvent.click(screen.getByRole('link', { name: 'See all results' }))
    expect(onNavigate).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=ada&type=all')
    expect(searchInput()).toHaveAttribute('aria-expanded', 'false')
  })

  it('allows keyboard access to a person, closes with Escape, and clears the query', async () => {
    const user = userEvent.setup()
    vi.mocked(searchDashboard).mockResolvedValue({ users: [ADA] })
    renderSearch()
    await user.type(searchInput(), 'ada')
    const person = await screen.findByRole('link', { name: /Ada Studio/ })
    await user.keyboard('{ArrowDown}')
    expect(person).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(searchInput()).toHaveFocus()
    expect(searchInput()).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(searchInput()).toHaveValue('')
    expect(searchInput()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
  })
})
