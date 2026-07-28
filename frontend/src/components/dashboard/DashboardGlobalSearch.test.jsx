import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import { searchDashboard } from '../../api/search.js'
import DashboardGlobalSearch from './DashboardGlobalSearch.jsx'

vi.mock('../../api/search.js', () => ({ searchDashboard: vi.fn() }))

function renderSearch() {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter><DashboardGlobalSearch /></MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

describe('DashboardGlobalSearch', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
    vi.mocked(searchDashboard).mockReset()
    vi.mocked(searchDashboard).mockResolvedValue({ sites: [], users: [] })
  })

  it('waits for two characters before searching', async () => {
    renderSearch()
    const input = screen.getByRole('searchbox', { name: 'Search sites and creators' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'a' } })

    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument()
    await new Promise((resolve) => window.setTimeout(resolve, 260))
    expect(searchDashboard).not.toHaveBeenCalled()
  })

  it('renders sites and creators as separate navigable result groups', async () => {
    vi.mocked(searchDashboard).mockResolvedValueOnce({
      sites: [{
        id: 10,
        title: 'Ada Portfolio',
        slug: 'ada-portfolio',
        owner_display_name: 'Ada Studio',
        category: 'portfolio',
      }],
      users: [{
        id: 3,
        username: 'ada',
        display_name: 'Ada Studio',
        avatar_url: '',
        headline: 'Product designer',
        published_site_count: 2,
      }],
    })
    renderSearch()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sites and creators' }), {
      target: { value: 'ada' },
    })

    await waitFor(() => expect(searchDashboard).toHaveBeenCalledWith('ada'))
    expect(await screen.findByRole('link', { name: /Ada Portfolio/ })).toHaveAttribute('href', '/site/ada-portfolio')
    expect(screen.getByRole('link', { name: /Ada Studio.*@ada/ })).toHaveAttribute('href', '/u/3')
    expect(screen.getByText('Sites')).toBeInTheDocument()
    expect(screen.getByText('Creators')).toBeInTheDocument()
  })
})
