import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchDashboard } from '../api/search.js'
import { addFavorite, removeFavorite } from '../api/explore.js'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import SearchPage from './SearchPage.jsx'

vi.mock('../api/search.js', () => ({ searchDashboard: vi.fn() }))
vi.mock('../api/explore.js', () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('../components/dashboard/DashboardHeader.jsx', () => ({ default: () => <header>Dashboard</header> }))
vi.mock('../components/dashboard/ExploreCard.jsx', () => ({
  default: ({ site, onToggleFav }) => (
    <article aria-label={site.title}>
      <a href={`/site/${site.slug}`}>{site.title}</a>
      <button onClick={() => onToggleFav(site)} aria-pressed={site.is_favorited}>Favorite {site.title}</button>
      <span>{site.favorite_count} favorites</span>
    </article>
  ),
}))

const person = (id, name) => ({ id, username: name.toLowerCase(), display_name: name, avatar_url: '' })
const site = (id, title) => ({ id, title, slug: title.toLowerCase().replaceAll(' ', '-'), is_favorited: false, favorite_count: 0 })
const response = (overrides = {}) => ({
  query: 'ada', users: [person(3, 'Ada')], sites: [site(10, 'Ada Portfolio')],
  counts: { users: 1, sites: 1 }, page: 1, has_more: false, ...overrides,
})

function NavigationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <>
    <output aria-label="Current URL">{location.pathname}{location.search}</output>
    <button onClick={() => navigate('/search?q=grace&type=all')}>Navigate to Grace</button>
    <button onClick={() => navigate(-1)}>Go back</button>
  </>
}

function renderSearch(url = '/search?q=ada&type=all') {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[url]}>
          <NavigationProbe />
          <SearchPage />
        </MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

function mockResults(implementation) {
  vi.mocked(searchDashboard).mockImplementation((query, options) => (
    options?.mode === 'results'
      ? implementation(query, options)
      : Promise.resolve({ query, users: [], sites: [] })
  ))
}

function resultCalls() {
  return vi.mocked(searchDashboard).mock.calls.filter(([, options]) => options?.mode === 'results')
}

describe('SearchPage', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
    vi.mocked(searchDashboard).mockReset()
    vi.mocked(addFavorite).mockReset().mockResolvedValue({})
    vi.mocked(removeFavorite).mockReset().mockResolvedValue({})
    mockResults(() => Promise.resolve(response()))
  })

  it('shows linked people before site results and includes result counts in the filters', async () => {
    renderSearch()
    const people = await screen.findByRole('region', { name: 'People' })
    const sites = screen.getByRole('region', { name: 'Sites' })
    expect(people.compareDocumentPosition(sites) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(people).getByRole('link', { name: /Ada.*@ada/ })).toHaveAttribute('href', '/u/3')
    expect(within(sites).getByRole('link', { name: 'Ada Portfolio' })).toHaveAttribute('href', '/site/ada-portfolio')
    const filters = screen.getByRole('group', { name: 'Search filters' })
    expect(within(filters).getByRole('button', { name: /^All\s*2$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(filters).getByRole('button', { name: /^Users\s*1$/ })).toBeInTheDocument()
    expect(within(filters).getByRole('button', { name: /^Sites\s*1$/ })).toBeInTheDocument()
  })

  it('preserves the query in URL filters and requests only the selected result type', async () => {
    renderSearch()
    await screen.findByRole('region', { name: 'People' })
    fireEvent.click(screen.getByRole('button', { name: /^Sites\s*1$/ }))
    await waitFor(() => expect(searchDashboard).toHaveBeenCalledWith('ada', { mode: 'results', type: 'sites', page: 1 }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/search?q=ada&type=sites')
    expect(screen.queryByRole('region', { name: 'People' })).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Sites' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Users\s*1$/ }))
    await waitFor(() => expect(searchDashboard).toHaveBeenCalledWith('ada', { mode: 'results', type: 'users', page: 1 }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/search?q=ada&type=users')
    expect(await screen.findByRole('region', { name: 'People' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sites' })).not.toBeInTheDocument()
  })

  it('only replaces the full results when the form is submitted and restores the query on back navigation', async () => {
    mockResults((query) => Promise.resolve(response({ query, sites: [site(10, `${query} Portfolio`)] })))
    renderSearch('/search?q=ada&type=sites')
    await screen.findByRole('link', { name: 'ada Portfolio' })
    const input = screen.getByRole('searchbox', { name: 'Search query' })
    expect(input).toHaveValue('ada')
    fireEvent.change(input, { target: { value: 'grace' } })
    await waitFor(() => expect(searchDashboard).toHaveBeenCalledWith('grace', { type: 'all' }))
    expect(resultCalls()).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'ada Portfolio' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/search?q=ada&type=sites')

    fireEvent.submit(screen.getByRole('search', { name: 'Search results' }))
    expect(await screen.findByRole('link', { name: 'grace Portfolio' })).toBeInTheDocument()
    expect(searchDashboard).toHaveBeenCalledWith('grace', { mode: 'results', type: 'sites', page: 1 })
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/search?q=grace&type=sites')

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(await screen.findByRole('link', { name: 'ada Portfolio' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search query' })).toHaveValue('ada')
    expect(screen.queryByRole('link', { name: 'grace Portfolio' })).not.toBeInTheDocument()
  })

  it('ignores a slower response for a previous query', async () => {
    let resolvePrevious
    mockResults((query) => query === 'ada'
      ? new Promise((resolve) => { resolvePrevious = resolve })
      : Promise.resolve(response({ query, users: [person(4, 'Grace')], sites: [site(11, 'Grace Portfolio')] })))
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to Grace' }))
    await screen.findByRole('link', { name: 'Grace Portfolio' })
    await act(async () => { resolvePrevious(response()) })
    expect(screen.getByRole('link', { name: 'Grace Portfolio' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ada Portfolio' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('q=grace')
  })

  it('retries a failed next page without losing results and appends distinct people and sites', async () => {
    let pageTwoAttempts = 0
    mockResults((query, { page }) => {
      if (page === 1) return Promise.resolve(response({ counts: { users: 2, sites: 2 }, has_more: true }))
      pageTwoAttempts += 1
      if (pageTwoAttempts === 1) return Promise.reject(new Error('Temporary failure'))
      return Promise.resolve(response({
        page: 2, users: [person(3, 'Ada'), person(4, 'Grace')],
        sites: [site(10, 'Ada Portfolio'), site(11, 'Grace Portfolio')], counts: { users: 2, sites: 2 },
      }))
    })
    renderSearch()
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Search could not be completed.')
    expect(screen.getByRole('link', { name: 'Ada Portfolio' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Grace Portfolio' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Ada Portfolio' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /Ada.*@ada/ })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Grace.*@grace/ })).toHaveAttribute('href', '/u/4')
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(resultCalls().map(([, options]) => options.page)).toEqual([1, 2, 2])
  })

  it.each(['/search', '/search?q=a&type=all'])('does not request results for a missing or short query: %s', async (url) => {
    renderSearch(url)
    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 250)) })
    expect(searchDashboard).not.toHaveBeenCalled()
  })

  it('shows separate empty states for people and sites', async () => {
    mockResults(() => Promise.resolve(response({ users: [], sites: [], counts: { users: 0, sites: 0 } })))
    renderSearch()
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
    expect(screen.getByText('No sites found.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^All\s*0$/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lets the user retry an initial search failure', async () => {
    let attempts = 0
    mockResults(() => ++attempts === 1 ? Promise.reject(new Error('Offline')) : Promise.resolve(response()))
    renderSearch()
    expect(await screen.findByRole('alert')).toHaveTextContent('Search could not be completed.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Ada Portfolio' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(resultCalls()).toHaveLength(2)
  })

  it('keeps favorite state after a failed save and updates it after a successful retry', async () => {
    vi.mocked(addFavorite).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({})
    renderSearch()
    fireEvent.click(await screen.findByRole('button', { name: 'Favorite Ada Portfolio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update favorite. Please try again.')
    expect(screen.getByRole('button', { name: 'Favorite Ada Portfolio' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0 favorites')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Ada Portfolio' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Favorite Ada Portfolio' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByText('1 favorites')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Ada Portfolio' }))
    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith(10))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Favorite Ada Portfolio' })).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.getByText('0 favorites')).toBeInTheDocument()
  })
})
