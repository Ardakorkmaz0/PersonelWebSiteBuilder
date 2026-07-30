// The phone browser has one job the phone bezel cannot do: take the pixels a
// real browser takes. If the page box ever silently gets the whole screen back,
// the frame is lying about how much of the design is above the fold — so that
// arithmetic is asserted here, per skin.
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import MobileBrowserChrome from './MobileBrowserChrome.jsx'
import { PHONE_MODELS } from './phoneFrameMetrics.js'
import { mobileBrowserChromeH, mobileBrowserSkin } from './browserFrameMetrics.js'

const PAGE_W = 393
const PAGE_H = 700

const pages = [
  { id: 'home', name: 'Home', seoTitle: 'Acme Home' },
  { id: 'about', name: 'About us' },
]

function renderChrome(props = {}, language = 'en') {
  localStorage.setItem('pwb_language', language)
  return render(
    <LanguageProvider>
      <MobileBrowserChrome
        screenWidth={PAGE_W}
        screenHeight={PAGE_H}
        model={PHONE_MODELS['iphone-island']}
        siteTitle="Acme"
        pages={pages}
        currentPageId="about"
        {...props}
      >
        <div data-testid="page">Page</div>
      </MobileBrowserChrome>
    </LanguageProvider>,
  )
}

const chromeRoot = () => document.querySelector('[data-builder-browser-frame="mobile"]')
const pageBox = () => document.querySelector('[data-browser-reload]')

describe('MobileBrowserChrome sizing', () => {
  it('adds its chrome around the page instead of stealing from it', () => {
    renderChrome()
    const chrome = mobileBrowserChromeH(PHONE_MODELS['iphone-island'])
    expect(chromeRoot()).toHaveStyle({ height: `${PAGE_H + chrome}px`, width: `${PAGE_W}px` })
    // The caller decides where those pixels come from; the page box always gets
    // exactly what it was promised.
    expect(pageBox()).toHaveStyle({ height: `${PAGE_H}px`, width: `${PAGE_W}px` })
    expect(screen.getByTestId('page')).toBeInTheDocument()
  })

  it('reserves more room on iOS than on Android, because the toolbar is real', () => {
    const ios = mobileBrowserChromeH(PHONE_MODELS['iphone-island'])
    const android = mobileBrowserChromeH(PHONE_MODELS['galaxy-s24'])
    expect(mobileBrowserSkin(PHONE_MODELS['iphone-island'])).toBe('ios')
    expect(mobileBrowserSkin(PHONE_MODELS['galaxy-s24'])).toBe('android')
    expect(mobileBrowserSkin(PHONE_MODELS['pixel-7'])).toBe('android')
    expect(mobileBrowserSkin(PHONE_MODELS['iphone-classic'])).toBe('ios')
    expect(ios).toBeGreaterThan(android)
  })

  it('follows the device the user picked', () => {
    const { unmount } = renderChrome()
    expect(chromeRoot()).toHaveAttribute('data-builder-mobile-browser', 'ios')
    unmount()

    renderChrome({ model: PHONE_MODELS['galaxy-s24'] })
    expect(chromeRoot()).toHaveAttribute('data-builder-mobile-browser', 'android')
    expect(chromeRoot()).toHaveStyle({
      height: `${PAGE_H + mobileBrowserChromeH(PHONE_MODELS['galaxy-s24'])}px`,
    })
  })
})

describe('MobileBrowserChrome controls', () => {
  it('shows the page path in the address bar and lets you rewrite it', async () => {
    const user = userEvent.setup()
    const onAddressChange = vi.fn()
    renderChrome({ address: 'acme.test', onAddressChange })

    expect(screen.getByText('acme.test/about-us')).toBeInTheDocument()
    await user.click(screen.getByTitle('Edit page link'))
    const input = screen.getByRole('textbox', { name: 'Page link' })
    await user.clear(input)
    await user.type(input, 'acme.test/team{Enter}')
    expect(onAddressChange).toHaveBeenCalledWith('acme.test/team')
  })

  it('remounts the page on reload, after letting the caller save first', async () => {
    const user = userEvent.setup()
    const onBeforeReload = vi.fn()
    renderChrome({ onBeforeReload })

    expect(pageBox()).toHaveAttribute('data-browser-reload', '0')
    await user.click(screen.getByRole('button', { name: 'Reload preview' }))
    expect(onBeforeReload).toHaveBeenCalledTimes(1)
    expect(pageBox()).toHaveAttribute('data-browser-reload', '1')
  })

  it('opens a page from the tab button', async () => {
    const user = userEvent.setup()
    const onEditPage = vi.fn()
    renderChrome({ onEditPage })

    await user.click(screen.getByRole('button', { name: 'Open site pages' }))
    await user.click(screen.getByRole('menuitem', { name: 'Acme Home' }))
    expect(onEditPage).toHaveBeenCalledWith('home')
  })

  it('keeps a long page list inside the phone and scrolls the list itself', async () => {
    const user = userEvent.setup()
    const onEditPage = vi.fn()
    const manyPages = Array.from({ length: 24 }, (_, index) => ({
      id: `page-${index + 1}`,
      name: `Page ${index + 1}`,
    }))
    renderChrome({ pages: manyPages, currentPageId: 'page-1', onEditPage })

    await user.click(screen.getByRole('button', { name: 'Open site pages' }))
    const menu = screen.getByRole('menu', { name: 'Open site pages' })
    expect(menu).toHaveAttribute('data-browser-page-menu', 'mobile')
    expect(menu).toHaveClass('overflow-y-auto', 'overscroll-contain')
    expect(menu).toHaveStyle({ maxHeight: '384px', overscrollBehavior: 'contain' })

    await user.click(screen.getByRole('menuitem', { name: 'Page 24' }))
    expect(onEditPage).toHaveBeenCalledWith('page-24')
  })

  it('reaches the site icon from the address bar and from the menu', async () => {
    const user = userEvent.setup()
    const onEditFavicon = vi.fn()
    renderChrome({ onEditFavicon })

    await user.click(screen.getAllByRole('button', { name: 'Edit site icon' })[0])
    expect(onEditFavicon).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Browser menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit site icon' }))
    expect(onEditFavicon).toHaveBeenCalledTimes(2)
  })

  it('shows the real clock, in the editor\'s language', () => {
    const expected = (locale) =>
      new Date().toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })

    const { unmount } = renderChrome({}, 'en')
    // 12-hour with a meridiem in English…
    expect(screen.getByText(expected('en-US'))).toBeInTheDocument()
    expect(expected('en-US')).toMatch(/\d{1,2}:\d{2}/)
    unmount()

    // …24-hour in Turkish, the way the phone itself would show it.
    renderChrome({}, 'tr')
    expect(screen.getByText(expected('tr-TR'))).toBeInTheDocument()
  })

  it('ticks the minute without re-rendering the page it frames', () => {
    // A preview that blinked once a minute would be worse than no clock, so the
    // tick must stay inside the clock: same page element, no remount, no reload.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 1, 10, 30, 5))
    let pageRenders = 0
    function Page() {
      pageRenders += 1
      return <div data-testid="page">Page</div>
    }
    localStorage.setItem('pwb_language', 'tr')
    render(
      <LanguageProvider>
        <MobileBrowserChrome
          screenWidth={PAGE_W}
          screenHeight={PAGE_H}
          model={PHONE_MODELS['iphone-island']}
          siteTitle="Acme"
          pages={pages}
          currentPageId="about"
        >
          <Page />
        </MobileBrowserChrome>
      </LanguageProvider>,
    )
    const before = screen.getByTestId('page')
    expect(screen.getByText('10:30')).toBeInTheDocument()
    expect(pageRenders).toBe(1)

    act(() => { vi.advanceTimersByTime(60000) })

    expect(screen.getByText('10:31')).toBeInTheDocument()
    expect(pageRenders).toBe(1)
    expect(screen.getByTestId('page')).toBe(before)
    vi.useRealTimers()
  })

  it('does not offer back and forward as buttons — there is no history here', () => {
    renderChrome()
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') || b.title)
    expect(labels.some((label) => /back|forward/i.test(label || ''))).toBe(false)
  })
})
