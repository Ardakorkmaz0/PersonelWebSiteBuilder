import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LanguageProvider from '../i18n/LanguageProvider.jsx'
import ExplorePage from '../pages/ExplorePage.jsx'
import TemplatePicker from './editor/TemplatePicker.jsx'
import MobileEditorPreview from './editor/MobileEditorPreview.jsx'
import SiteControlCenter from './editor/SiteControlCenter.jsx'
import { Navbar } from './renderer/components.jsx'

vi.mock('../api/explore.js', () => ({
  listExplore: vi.fn().mockResolvedValue({ results: [], next: null }),
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
  configureDomain: vi.fn(),
  deleteSiteSubmission: vi.fn(),
  getDomainSetup: vi.fn(),
  getSiteAnalytics: vi.fn(),
  listSiteComments: vi.fn(),
  listSiteSubmissions: vi.fn(),
  patchSite: vi.fn(),
  regenerateReviewLink: vi.fn(),
  resolveSiteComment: vi.fn(),
  updateSiteSubmission: vi.fn(),
}))

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('pwb_language', 'en')
})

function renderWithShell(ui) {
  return render(<LanguageProvider><MemoryRouter>{ui}</MemoryRouter></LanguageProvider>)
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
    expect(headerInner).toHaveClass('min-w-0', 'px-3', 'sm:px-6')
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#explore-main')
  })

  it('exposes template discovery controls through accessible names', () => {
    renderWithShell(<TemplatePicker open title="Test" onPick={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: /Template gallery/i })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('textbox', { name: 'Search templates' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Favorites' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('combobox', { name: 'Content language' })).toBeInTheDocument()
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

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Content' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Readiness' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
