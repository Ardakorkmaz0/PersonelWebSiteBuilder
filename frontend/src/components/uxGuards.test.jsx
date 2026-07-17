import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../ui/UiThemeProvider.jsx'
import ExplorePage from '../pages/ExplorePage.jsx'
import FavoritesPage from '../pages/FavoritesPage.jsx'
import TemplatePicker from './editor/TemplatePicker.jsx'
import DefaultViewportSelect from './editor/DefaultViewportSelect.jsx'
import MobileEditorPreview from './editor/MobileEditorPreview.jsx'
import SiteControlCenter from './editor/SiteControlCenter.jsx'
import PublicToolbar from './preview/PublicToolbar.jsx'
import { Navbar } from './renderer/components.jsx'
import { listSites } from '../api/sites.js'
import { listExplore, listFavorites } from '../api/explore.js'

vi.mock('../api/explore.js', () => ({
  listExplore: vi.fn().mockResolvedValue({ results: [], next: null }),
  listFavorites: vi.fn().mockResolvedValue([]),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}))

vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector) => selector({
    user: { username: 'tester', display_name: 'Test User', is_staff: false },
    logout: vi.fn(),
  }),
}))

vi.mock('../api/sites.js', () => ({
  cloneSite: vi.fn(),
  configureDomain: vi.fn(),
  deleteSiteSubmission: vi.fn(),
  getDomainSetup: vi.fn(),
  getSiteAnalytics: vi.fn(),
  listSiteComments: vi.fn(),
  listSites: vi.fn().mockResolvedValue([]),
  listSiteSubmissions: vi.fn(),
  patchSite: vi.fn(),
  regenerateReviewLink: vi.fn(),
  reportSite: vi.fn(),
  resolveSiteComment: vi.fn(),
  updateSiteSubmission: vi.fn(),
}))

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  }
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('pwb_language', 'en')
  vi.mocked(listSites).mockResolvedValue([])
  vi.mocked(listExplore).mockClear()
  vi.mocked(listExplore).mockResolvedValue({ results: [], next: null })
  vi.mocked(listFavorites).mockReset()
  vi.mocked(listFavorites).mockResolvedValue([])
})

function renderWithShell(ui) {
  return render(
    <UiThemeProvider>
      <LanguageProvider><MemoryRouter>{ui}</MemoryRouter></LanguageProvider>
    </UiThemeProvider>,
  )
}

describe('responsive and accessibility guards', () => {
  it('uses a compact accessible hamburger navbar in mobile site previews', () => {
    renderWithShell(
      <Navbar
        viewport="mobile"
        props={{
          brand: 'Studio',
          mobileNavMode: 'menu',
          links: [{ label: 'Work', href: '#work' }],
        }}
        style={{ backgroundColor: '#111827', color: '#ffffff', height: 64 }}
      />,
    )

    const toggle = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Work' })).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Work' })).toBeInTheDocument()
  })

  it('keeps the Explore header shrinkable and exposes a named mobile menu', async () => {
    renderWithShell(<ExplorePage />)
    const headerInner = screen.getByTestId('explore-header-inner')
    expect(headerInner).toHaveClass('dashboard-header-inner')
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument()
    const mobileMenu = screen.getByRole('button', { name: 'Open menu' })
    expect(mobileMenu).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#explore-main')
    fireEvent.click(mobileMenu)
    expect(mobileMenu).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Nothing here yet')).toBeInTheDocument())
  })

  it('offers one-click continuation for the most recently edited site', async () => {
    vi.mocked(listSites).mockResolvedValueOnce([
      {
        id: 42,
        title: 'Latest portfolio',
        slug: 'latest-portfolio',
        published: false,
        updated_at: '2026-07-17T10:30:00Z',
        view_count: 12,
        favorite_count: 3,
      },
    ])
    renderWithShell(<ExplorePage />)

    expect(await screen.findByRole('heading', { name: 'Continue where you left off' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue editing: Latest portfolio' })).toHaveAttribute('href', '/editor/42')
  })

  it('searches the full community feed by site or creator', async () => {
    renderWithShell(<ExplorePage />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search community sites' }), {
      target: { value: 'lighthouse' },
    })

    await waitFor(() => {
      expect(listExplore).toHaveBeenCalledWith({ category: '', page: 1, search: 'lighthouse' })
    })
  })

  it('keeps the shared navbar on Favorites and filters saved sites', async () => {
    vi.mocked(listFavorites).mockResolvedValueOnce([
      {
        id: 7,
        title: 'Ada Portfolio',
        slug: 'ada-portfolio',
        owner_id: 1,
        owner_username: 'ada',
        owner_display_name: 'Ada Studio',
        owner_avatar_url: '',
        category: 'portfolio',
        view_count: 12,
        favorite_count: 1,
        is_favorited: true,
      },
    ])
    renderWithShell(<FavoritesPage />)

    expect(await screen.findByText('Ada Portfolio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Favorites' })).toHaveAttribute('aria-current', 'page')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search favorites' }), {
      target: { value: 'missing' },
    })
    expect(await screen.findByText('No favorites match your search.')).toBeInTheDocument()
    expect(screen.queryByText('Ada Portfolio')).not.toBeInTheDocument()
  })

  it('exposes template discovery controls through accessible names', () => {
    const { container } = renderWithShell(<TemplatePicker open title="Test" onPick={vi.fn()} onClose={vi.fn()} />)
    expect(container.firstChild).toHaveClass('studio-theme-surface')
    expect(screen.getByRole('dialog', { name: /Template gallery/i })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('textbox', { name: 'Search templates' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Favorites' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('combobox', { name: 'Content language' })).toBeInTheDocument()
  })

  it('uses an explicit PC or mobile editor opening preference', () => {
    const onChange = vi.fn()
    renderWithShell(<DefaultViewportSelect value="pc" onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Editor opening screen' })

    expect(select).toHaveValue('pc')
    fireEvent.change(select, { target: { value: 'mobile' } })
    expect(onChange).toHaveBeenCalledWith('mobile')
  })

  it('keeps preview navigation and secondary actions in one accessible toolbar', () => {
    const onNavigate = vi.fn()
    renderWithShell(
      <PublicToolbar
        site={{ id: 1, slug: 'demo', title: 'Demo site', owner_id: 2, owner_username: 'Ada' }}
        pages={[{ id: 'home', name: 'Home' }, { id: 'about', name: 'About' }]}
        activePageId="home"
        onNavigate={onNavigate}
      />,
    )

    expect(screen.getByRole('navigation', { name: 'Site pages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(onNavigate).toHaveBeenCalledWith('about')

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('menuitem', { name: 'Report this site' })).toBeInTheDocument()
  })

  it('keeps phone editing preview-first and moves secondary actions into sheets', async () => {
    const onSelectPage = vi.fn()
    renderWithShell(
      <MobileEditorPreview
        title="Mobile portfolio"
        slug="mobile-portfolio"
        published={false}
        pages={[
          { id: 'home', name: 'Home', mode: 'html', html: '<!doctype html><html><body>Home</body></html>' },
          { id: 'about', name: 'About', mode: 'html', html: '<!doctype html><html><body>About</body></html>' },
        ]}
        currentPageId="home"
        pageHtmlMap={{}}
        theme={{}}
        customCss=""
        customJs=""
        onSelectPage={onSelectPage}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByTestId('mobile-editor-preview')).toHaveAccessibleName('Mobile site preview')
    expect(screen.getByRole('navigation', { name: 'Mobile preview navigation' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByText('Components')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Pages' }))
    expect(screen.getByRole('dialog', { name: 'Site pages' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(onSelectPage).toHaveBeenCalledWith('about')

    fireEvent.click(screen.getByRole('button', { name: 'Desktop' }))
    expect(screen.getByRole('dialog', { name: 'Desktop editing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy editor link' })).toBeInTheDocument()
  })

  it('does not show a stale loader on local control-center tabs', () => {
    renderWithShell(
      <SiteControlCenter
        open
        onClose={vi.fn()}
        site={{ id: 1, title: 'Test site', site_options: {}, review_token: 'token' }}
        schema={{ pages: [{ id: 'home', name: 'Home', mode: 'html', components: [] }] }}
        pageHtmlMap={{ home: '<html><body><h1>Hello</h1></body></html>' }}
        onSitePatch={vi.fn()}
        onHtmlContentChange={vi.fn()}
        onSchemaContentChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Site control center' }).parentElement).toHaveClass('studio-theme-surface')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Content' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Readiness' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
