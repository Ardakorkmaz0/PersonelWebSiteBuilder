// The grid's promise is "what you see is what you get". Two things have to hold
// for that to be true: the card must render the real artefact, and it must
// render it without the power to run anything.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import CommunityPage from './CommunityPage.jsx'
import {
  listComponents,
  countComponentView,
  withdrawComponent,
  setComponentVisibility,
} from '../api/community.js'
import { useAuthStore } from '../store/authStore.js'

vi.mock('../api/community.js', () => ({
  listComponents: vi.fn(),
  countComponentView: vi.fn(),
  withdrawComponent: vi.fn(),
  setComponentVisibility: vi.fn(),
  reportComponent: vi.fn(),
  takeComponent: vi.fn(),
}))
vi.mock('../api/sites.js', () => ({ listSites: vi.fn(() => Promise.resolve([])), getSite: vi.fn() }))

const CARD = {
  id: 3,
  title: 'Pricing card',
  description: 'Three tiers',
  category: 'business',
  tags: [],
  html: '<div class="card">Pro</div>',
  css: '[data-pwb-shared="s1"] .card { padding: 24px; }',
  fonts: [],
  policy: {},
  author_id: 9,
  author_username: 'ada',
  author_display_name: 'Ada',
  use_count: 4,
  view_count: 12,
}

function renderPage() {
  localStorage.setItem('pwb_language', 'en')
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <MemoryRouter>
          <CommunityPage />
        </MemoryRouter>
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 1, username: 'me' } })
  listComponents.mockResolvedValue({ results: [CARD], count: 1 })
  countComponentView.mockResolvedValue()
  withdrawComponent.mockResolvedValue({})
  setComponentVisibility.mockResolvedValue({})
})

describe('the community grid', () => {
  it('previews the real block, and gives the frame no scripts', async () => {
    renderPage()
    const frame = await screen.findByTitle('Pricing card')
    // Markup AND the styles that came with it — a card that dropped the CSS
    // would be showing something the taker will not get.
    expect(frame.getAttribute('srcdoc')).toContain('Pro')
    expect(frame.getAttribute('srcdoc')).toContain('padding: 24px')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin')
  })

  it('counts a view once the card is on screen, by POST', async () => {
    renderPage()
    await screen.findByTitle('Pricing card')
    expect(countComponentView).toHaveBeenCalledWith(3)
    expect(countComponentView).toHaveBeenCalledTimes(1)
  })

  it('filters by category without re-asking for everything', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTitle('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Portfolio' }))

    await waitFor(() =>
      expect(listComponents).toHaveBeenLastCalledWith({ category: 'portfolio', q: '', scope: '' }))
  })

  it('waits for the typing to stop before searching', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTitle('Pricing card')
    listComponents.mockClear()

    await user.type(screen.getByRole('textbox', { name: 'Search blocks…' }), 'hero')

    // Four keystrokes, one request — otherwise the library gets hammered.
    await waitFor(() =>
      expect(listComponents).toHaveBeenLastCalledWith({ category: '', q: 'hero', scope: '' }))
    expect(listComponents).toHaveBeenCalledTimes(1)
  })
})

describe('looking closer before taking', () => {
  it('opens the big preview from the card picture, not just a button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTitle('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Preview Pricing card' }))

    // The overlay's own frame, at the desktop width — not the card thumbnail.
    const frame = await screen.findByTitle('Preview block')
    expect(frame.style.width).toBe('1100px')
  })

  it('goes from the preview straight into choosing a site', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTitle('Pricing card')
    await user.click(screen.getByRole('button', { name: 'Preview Pricing card' }))

    const preview = screen.getByRole('dialog', { name: 'Preview block' })
    await user.click(within(preview).getByRole('button', { name: 'Use this' }))

    expect(await screen.findByRole('dialog', { name: 'Add to one of your sites' })).toBeInTheDocument()
    // The preview steps aside rather than stacking behind the picker.
    expect(screen.queryByTitle('Preview block')).toBeNull()
  })
})

describe('who may do what to a block', () => {
  it('offers a stranger the report action, not the withdraw one', async () => {
    renderPage()
    await screen.findByTitle('Pricing card')
    expect(screen.getByRole('button', { name: 'Report this block' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull()
  })

  it('offers the author withdrawal, and drops the card once it is gone', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: { id: 9, username: 'ada' } })
    renderPage()
    await screen.findByTitle('Pricing card')

    expect(screen.queryByRole('button', { name: 'Report this block' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Withdraw' }))

    expect(withdrawComponent).toHaveBeenCalledWith(3)
    await waitFor(() => expect(screen.queryByTitle('Pricing card')).toBeNull())
  })
})

describe('public and private', () => {
  const asAuthor = () => useAuthStore.setState({ user: { id: 9, username: 'ada' } })

  it('keeps the community grid and your own shelf as separate asks', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTitle('Pricing card')

    await user.click(screen.getByRole('button', { name: 'My blocks' }))

    await waitFor(() =>
      expect(listComponents).toHaveBeenLastCalledWith({ category: '', q: '', scope: 'mine' }))
  })

  it('says on the card when a block is private', async () => {
    asAuthor()
    listComponents.mockResolvedValue({ results: [{ ...CARD, visibility: 'private' }], count: 1 })
    renderPage()
    await screen.findByTitle('Pricing card')

    expect(screen.getByText('Private')).toBeInTheDocument()
    // Nobody is looking at a private block, so nothing is counted for it.
    expect(countComponentView).not.toHaveBeenCalled()
  })

  it('offers the author one click each way', async () => {
    const user = userEvent.setup()
    asAuthor()
    listComponents.mockResolvedValue({ results: [{ ...CARD, visibility: 'public' }], count: 1 })
    renderPage()
    await screen.findByTitle('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Make private' }))

    expect(setComponentVisibility).toHaveBeenCalledWith(3, 'private')
  })

  it('drops a block from the community grid the moment it goes private', async () => {
    const user = userEvent.setup()
    asAuthor()
    listComponents.mockResolvedValue({ results: [{ ...CARD, visibility: 'public' }], count: 1 })
    renderPage()
    await screen.findByTitle('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Make private' }))

    // It no longer belongs on the grid it is being hidden from.
    await waitFor(() => expect(screen.queryByTitle('Pricing card')).toBeNull())
  })

  it('keeps it on your own shelf, wearing the badge', async () => {
    const user = userEvent.setup()
    asAuthor()
    listComponents.mockResolvedValue({ results: [{ ...CARD, visibility: 'public' }], count: 1 })
    renderPage()
    await screen.findByTitle('Pricing card')
    await user.click(screen.getByRole('button', { name: 'My blocks' }))
    await screen.findByTitle('Pricing card')

    await user.click(screen.getByRole('button', { name: 'Make private' }))

    expect(await screen.findByText('Private')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make public' })).toBeInTheDocument()
  })

  it('never offers a stranger a switch on somebody else’s block', async () => {
    listComponents.mockResolvedValue({ results: [{ ...CARD, visibility: 'public' }], count: 1 })
    renderPage()
    await screen.findByTitle('Pricing card')

    expect(screen.queryByRole('button', { name: 'Make private' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make public' })).toBeNull()
  })
})

describe('when there is nothing to show', () => {
  it('says so instead of leaving an empty grid', async () => {
    listComponents.mockResolvedValue({ results: [], count: 0 })
    renderPage()
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('reports a failure rather than pretending the library is empty', async () => {
    listComponents.mockRejectedValue(new Error('offline'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the community library.')
    expect(screen.queryByText('Nothing here yet.')).toBeNull()
  })
})
