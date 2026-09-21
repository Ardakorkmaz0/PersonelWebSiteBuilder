import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFavorite, listExplore, removeFavorite } from '../api/explore.js'
import { listSites } from '../api/sites.js'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import ExplorePage from './ExplorePage.jsx'
import { useAuthStore } from '../store/authStore.js'

vi.mock('../api/explore.js', () => ({ listExplore: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('../api/sites.js', () => ({ listSites: vi.fn(), cloneSite: vi.fn() }))
vi.mock('../components/dashboard/DashboardHeader.jsx', () => ({ default: () => <header>Dashboard</header> }))
vi.mock('../components/dashboard/CreateSiteWizard.jsx', () => ({ default: () => null }))
vi.mock('../components/dashboard/SitePreview.jsx', () => ({ default: () => <div /> }))

const site = {
  id: 7, slug: 'explore-site', title: 'Explore site', owner_display_name: 'Ada',
  view_count: 12, favorite_count: 4, is_favorited: false,
}

beforeEach(() => {
  localStorage.setItem('pwb_language', 'en')
  useAuthStore.setState({ user: { id: 100, username: 'ada' }, token: 'test-session' })
  vi.mocked(listExplore).mockReset().mockResolvedValue({ results: [site], next: null })
  vi.mocked(listSites).mockReset().mockResolvedValue([])
  vi.mocked(addFavorite).mockReset()
  vi.mocked(removeFavorite).mockReset()
})

describe('ExplorePage favorite saves', () => {
  it('reloads account-specific favorite state after logging out and switching accounts', async () => {
    useAuthStore.setState({ user: { id: 200, username: 'first' }, token: 'first-session' })
    const first = render(<LanguageProvider><MemoryRouter><ExplorePage /></MemoryRouter></LanguageProvider>)
    await screen.findByRole('button', { name: 'Favorite' })
    first.unmount()
    const returned = render(<LanguageProvider><MemoryRouter><ExplorePage /></MemoryRouter></LanguageProvider>)
    expect(await screen.findByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'false')
    expect(listExplore).toHaveBeenCalledTimes(1)
    returned.unmount()
    useAuthStore.getState().logout()
    useAuthStore.setState({ user: { id: 201, username: 'second' }, token: 'second-session' })
    vi.mocked(listExplore).mockResolvedValueOnce({ results: [{ ...site, is_favorited: true }], next: null })

    render(<LanguageProvider><MemoryRouter><ExplorePage /></MemoryRouter></LanguageProvider>)
    expect(await screen.findByRole('button', { name: 'Unfavorite' })).toHaveAttribute('aria-pressed', 'true')
    expect(listExplore).toHaveBeenCalledTimes(2)
  })

  it('keeps confirmed stars and counts on failure, prevents overlapping saves, and supports retry in both directions', async () => {
    let rejectSave
    vi.mocked(addFavorite).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject }))
    render(<LanguageProvider><MemoryRouter><ExplorePage /></MemoryRouter></LanguageProvider>)
    const button = await screen.findByRole('button', { name: 'Favorite' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(addFavorite).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTitle('Favorites')).toHaveTextContent('4')
    await act(async () => rejectSave(new Error('Save unavailable')))

    expect(screen.getByRole('alert')).toHaveTextContent('Save unavailable')
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTitle('Favorites')).toHaveTextContent('4')
    vi.mocked(addFavorite).mockResolvedValueOnce({})
    fireEvent.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByTitle('Favorites')).toHaveTextContent('5')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    vi.mocked(removeFavorite).mockRejectedValueOnce(new Error('Removal unavailable'))
    fireEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Removal unavailable')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('Favorites')).toHaveTextContent('5')
    vi.mocked(removeFavorite).mockResolvedValueOnce({})
    fireEvent.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.getByTitle('Favorites')).toHaveTextContent('4')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(addFavorite).toHaveBeenCalledTimes(2)
    expect(removeFavorite).toHaveBeenCalledTimes(2)
  })
})
