// Pinning a site to the home page.
//
// The control is superuser-only, which the server enforces; the card simply
// does not render it unless a handler is passed. The BADGE is a different
// thing and is shown to everybody — a site sitting above the ranking should
// say why it is there instead of looking like the most popular thing today.
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import ExploreCard from './ExploreCard.jsx'

vi.mock('./SitePreview.jsx', () => ({ default: () => <div data-testid="site-preview" /> }))

const site = {
  id: 7,
  slug: 'modern-portfolio',
  title: 'Modern Portfolio',
  category: 'portfolio',
  owner_id: 42,
  owner_display_name: 'Ada Studio',
  owner_avatar_url: '',
  view_count: 128,
  favorite_count: 9,
  is_favorited: false,
  pinned: false,
}

function renderCard(props = {}, overrides = {}) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <ExploreCard site={{ ...site, ...overrides }} {...props} />
      </MemoryRouter>
    </LanguageProvider>,
  )
}

describe('pinning from the feed', () => {
  beforeEach(() => {
    localStorage.setItem('pwb_language', 'en')
  })

  it('offers no pin control to an ordinary visitor', () => {
    renderCard()

    expect(screen.queryByRole('button', { name: /pin to the home page/i })).toBeNull()
    // The star is untouched: the card is exactly what it always was.
    expect(screen.getByRole('button', { name: /favorite/i })).toBeInTheDocument()
  })

  it('offers it once a handler is passed', () => {
    const onTogglePin = vi.fn()

    renderCard({ onTogglePin })

    fireEvent.click(screen.getByRole('button', { name: /pin to the home page/i }))
    expect(onTogglePin).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
  })

  it('reads as pressed and offers the way back once pinned', () => {
    const onTogglePin = vi.fn()

    renderCard({ onTogglePin }, { pinned: true })

    const button = screen.getByRole('button', { name: /unpin from the home page/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(onTogglePin).toHaveBeenCalled()
  })

  it('shows the badge to everyone, handler or not', () => {
    renderCard({}, { pinned: true })

    expect(screen.getByText('Pinned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unpin/i })).toBeNull()
  })

  it('hides the badge when the site is not pinned', () => {
    renderCard({ onTogglePin: vi.fn() })

    expect(screen.queryByText('Pinned')).toBeNull()
  })

  it('refuses a second click while the first is in flight', () => {
    const onTogglePin = vi.fn()

    renderCard({ onTogglePin, pinning: true })

    const button = screen.getByRole('button', { name: /pin to the home page/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})
