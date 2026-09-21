import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PreviewPage from './PreviewPage.jsx'
import ReviewPage from './ReviewPage.jsx'
import { countSiteView, getPublicSite, getReviewSite, submitSiteForm } from '../api/sites.js'

vi.mock('../api/sites.js', () => ({
  getPublicSite: vi.fn(),
  countSiteView: vi.fn(),
  submitSiteForm: vi.fn(),
  getReviewSite: vi.fn(),
  submitReviewComment: vi.fn(),
}))
vi.mock('../components/preview/PublicToolbar.jsx', () => ({ default: () => null }))
vi.mock('../components/LanguageSwitcher.jsx', () => ({ default: () => null }))
vi.mock('../i18n/useLanguage.js', () => ({
  useLanguage: () => ({ t: (value, params = {}) => value.replace(/\{(\w+)\}/g, (_, key) => params[key] || key) }),
}))

const site = {
  title: 'Security preview',
  slug: 'security-preview',
  published: true,
  schema: {
    pages: [
      { id: 'home', name: 'Home', mode: 'html', html: '<h1>Home page</h1>', components: [] },
      { id: 'contact', name: 'Contact', mode: 'html', html: '<h1>Contact page</h1>', components: [] },
    ],
  },
}

async function mount(review = false) {
  // Flush the resolved API request and page-selection effects before capturing
  // the active frame's WindowProxy for the message tests.
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[review ? '/review/test-token' : '/site/security-preview']}>
        <Routes>
          <Route path="/site/:slug" element={<PreviewPage />} />
          <Route path="/review/:token" element={<ReviewPage />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

function post(source, data) {
  act(() => window.dispatchEvent(new MessageEvent('message', { source, origin: 'null', data })))
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
  sessionStorage.clear()
  getPublicSite.mockResolvedValue(site)
  getReviewSite.mockResolvedValue({ site, comments: [] })
  countSiteView.mockResolvedValue({})
  submitSiteForm.mockResolvedValue({})
})

describe('public preview message authorization', () => {
  it('ignores forged form messages but keeps forms from the displayed site working', async () => {
    await mount()
    const frame = await screen.findByTitle('Security preview')
    const data = { type: 'pwb-form-submit', data: { message: 'Hello' }, page: 'home' }
    post(window, data)
    post(null, data)
    expect(submitSiteForm).not.toHaveBeenCalled()

    post(frame.contentWindow, data)
    await waitFor(() => expect(submitSiteForm).toHaveBeenCalledExactlyOnceWith(
      'security-preview', { message: 'Hello' }, 'home',
    ))
  })

  it('ignores foreign, malformed, and stale-frame navigation while allowing site links', async () => {
    await mount()
    const frame = await screen.findByTitle('Security preview')
    const oldSource = frame.contentWindow
    post(window, { type: 'pwb-navigate', hash: '#contact' })
    post(oldSource, { type: 'pwb-navigate', hash: '#%E0%A4%A' })
    expect(screen.getByTitle('Security preview').srcdoc).toContain('Home page')

    expect(oldSource).toBe(screen.getByTitle('Security preview').contentWindow)
    post(oldSource, { type: 'pwb-navigate', hash: '#contact' })
    expect(window.location.hash).toBe('#contact')
    await waitFor(() => expect(screen.getByTitle('Security preview').srcdoc).toContain('Contact page'))
    post(oldSource, { type: 'pwb-navigate', hash: '#home' })
    expect(screen.getByTitle('Security preview').srcdoc).toContain('Contact page')
  })
})

describe('private review message authorization', () => {
  it('only lets the current preview change the page attached to feedback', async () => {
    await mount(true)
    const frame = await screen.findByTitle('Previewing Home')
    post(window, { type: 'pwb-navigate', hash: '#contact' })
    post(frame.contentWindow, { type: 'pwb-navigate', hash: '#%E0%A4%A' })
    expect(screen.getByRole('combobox', { name: 'Pages' })).toHaveValue('home')
    post(frame.contentWindow, { type: 'pwb-navigate', hash: '#contact' })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Pages' })).toHaveValue('contact'))
  })
})
