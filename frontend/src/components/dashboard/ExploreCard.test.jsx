import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import ExploreCard from './ExploreCard.jsx'

const previewSpy = vi.fn()

vi.mock('./SitePreview.jsx', () => ({
  default: (props) => {
    previewSpy(props)
    return <div data-testid="site-preview" />
  },
}))

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
}

function renderCard(props = {}) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <ExploreCard site={site} {...props} />
      </MemoryRouter>
    </LanguageProvider>,
  )
}

describe('ExploreCard', () => {
  beforeEach(() => {
    previewSpy.mockClear()
    localStorage.setItem('pwb_language', 'en')
  })

  it('keeps the public preview and card actions functional', () => {
    const onToggleFav = vi.fn()
    const onRemix = vi.fn()
    renderCard({ onToggleFav, onRemix })

    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      site,
      source: 'public',
      fill: true,
      scrollOnHover: true,
      scrolling: false,
    }))
    expect(screen.getByTitle('Open the live site')).toHaveAttribute('href', '/site/modern-portfolio')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/site/modern-portfolio')
    expect(screen.getByRole('link', { name: 'Ada Studio' })).toHaveAttribute('href', '/u/42')

    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }))
    expect(onToggleFav).toHaveBeenCalledWith(site)

    fireEvent.click(screen.getByRole('button', { name: 'Use as template' }))
    expect(onRemix).toHaveBeenCalledWith(site)
  })

  it('disables remix while the copy is being created', () => {
    renderCard({ onRemix: vi.fn(), remixing: true })
    expect(screen.getByRole('button', { name: /Creating copy/ })).toBeDisabled()
  })
})

describe('ExploreCard — the modern feed card', () => {
  beforeEach(() => {
    previewSpy.mockClear()
    localStorage.setItem('pwb_language', 'en')
  })

  it('scrolls the thumbnail while the pointer rests on the card, and stops when it leaves', () => {
    const { container } = renderCard()
    const card = container.querySelector('article')
    fireEvent.mouseEnter(card)
    expect(previewSpy).toHaveBeenLastCalledWith(expect.objectContaining({ scrolling: true }))
    fireEvent.mouseLeave(card)
    expect(previewSpy).toHaveBeenLastCalledWith(expect.objectContaining({ scrolling: false }))
  })

  it('also scrolls for keyboard users reaching the card', () => {
    renderCard({ onRemix: vi.fn() })
    fireEvent.focus(screen.getByRole('button', { name: 'Use as template' }))
    expect(previewSpy).toHaveBeenLastCalledWith(expect.objectContaining({ scrolling: true }))
  })

  it('labels the featured card and its category above the title, not on the thumbnail', () => {
    const { container } = renderCard({ featured: true })
    expect(container.querySelector('article')).toHaveClass('explore-card-featured')
    const kicker = container.querySelector('.explore-card-kicker')
    expect(kicker).toHaveTextContent('Featured')
    expect(kicker).toHaveTextContent('Portfolio')
    expect(container.querySelector('.explore-card-media .explore-card-kicker')).toBeNull()
  })

  it('shows large counts compactly', () => {
    render(
      <LanguageProvider>
        <MemoryRouter>
          <ExploreCard site={{ ...site, view_count: 12500, favorite_count: 3 }} />
        </MemoryRouter>
      </LanguageProvider>,
    )
    expect(screen.getByTitle('Views')).toHaveTextContent('12.5K')
  })

  it('marks a favourite as pressed', () => {
    renderCard({ site: { ...site, is_favorited: true } })
    expect(screen.getByRole('button', { name: 'Unfavorite' })).toHaveAttribute('aria-pressed', 'true')
  })
})
