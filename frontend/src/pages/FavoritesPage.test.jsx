import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFavorite, listFavorites, removeFavorite } from '../api/explore.js'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import FavoritesPage from './FavoritesPage.jsx'

vi.mock('../api/explore.js', () => ({ listFavorites: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('../components/dashboard/DashboardHeader.jsx', () => ({ default: () => <header>Dashboard</header> }))
vi.mock('../components/dashboard/SitePreview.jsx', () => ({ default: () => <div /> }))

const site = {
  id: 7, slug: 'favorite-site', title: 'Favorite site', owner_display_name: 'Ada',
  view_count: 12, favorite_count: 4, is_favorited: true,
}

function renderFavorites() {
  return render(<LanguageProvider><MemoryRouter><FavoritesPage /></MemoryRouter></LanguageProvider>)
}

beforeEach(() => {
  localStorage.setItem('pwb_language', 'en')
  vi.mocked(listFavorites).mockReset().mockResolvedValue([site])
  vi.mocked(addFavorite).mockReset()
  vi.mocked(removeFavorite).mockReset()
})

describe('FavoritesPage request failures', () => {
  it('stops loading after a failed initial request and allows a successful retry', async () => {
    let resolveRetry
    vi.mocked(listFavorites)
      .mockRejectedValueOnce(new Error('Favorites unavailable'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve }))
    renderFavorites()

    expect(await screen.findByRole('alert')).toHaveTextContent('Favorites unavailable')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('No favorites yet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading…')
    await act(async () => resolveRetry([site]))

    expect(screen.getByRole('link', { name: 'Favorite site' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(listFavorites).toHaveBeenCalledTimes(2)
  })

  it('keeps a card and count after a failed removal, prevents overlapping saves, and allows retry', async () => {
    let rejectRemoval
    vi.mocked(removeFavorite).mockImplementationOnce(() => new Promise((_, reject) => { rejectRemoval = reject }))
    renderFavorites()
    const button = await screen.findByRole('button', { name: 'Unfavorite' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(removeFavorite).toHaveBeenCalledTimes(1)
    expect(removeFavorite).toHaveBeenCalledWith(7)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Favorite site' })).toBeInTheDocument()
    await act(async () => rejectRemoval(new Error('Save unavailable')))

    expect(screen.getByRole('alert')).toHaveTextContent('Save unavailable')
    expect(button).toBeEnabled()
    expect(screen.getByTitle('Favorites')).toHaveTextContent('4')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    vi.mocked(removeFavorite).mockResolvedValueOnce({})
    fireEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Favorite site' })).not.toBeInTheDocument())
    expect(screen.getByText('No favorites yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(removeFavorite).toHaveBeenCalledTimes(2)
    expect(addFavorite).not.toHaveBeenCalled()
  })
})
