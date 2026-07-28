import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import BrowserFrame from './BrowserFrame.jsx'
import { browserFrameH, browserFrameW } from './browserFrameMetrics.js'

const pages = [
  { id: 'home', name: 'Home', seoTitle: 'Acme Home' },
  { id: 'about', name: 'About us' },
]

function renderFrame(props = {}, children = <div data-testid="artboard">Page</div>) {
  localStorage.setItem('pwb_language', 'en')
  localStorage.removeItem('pwb_browser_preview_zoom')
  return render(
    <LanguageProvider>
      <BrowserFrame
        screenWidth={1000}
        screenHeight={700}
        siteTitle="Acme"
        pages={pages}
        currentPageId="about"
        {...props}
      >
        {children}
      </BrowserFrame>
    </LanguageProvider>,
  )
}

describe('BrowserFrame', () => {
  it('shows page titles, the selected URL and keeps the artboard dimensions intact', () => {
    const { container } = renderFrame({ address: 'https://acme.test' })

    expect(screen.getByRole('tab', { name: 'Acme Home' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'About us' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('acme.test/about-us')).toBeInTheDocument()
    expect(container.querySelector('[data-builder-browser-frame]')).toHaveStyle({
      width: `${1000 + browserFrameW()}px`,
      height: `${700 + browserFrameH()}px`,
    })
  })

  it('opens a page in Edit and opens favicon settings from the site icon', async () => {
    const user = userEvent.setup()
    const onEditPage = vi.fn()
    const onEditFavicon = vi.fn()
    renderFrame({ onEditPage, onEditFavicon })

    await user.click(screen.getByRole('button', { name: 'Edit Acme Home' }))
    expect(onEditPage).toHaveBeenCalledWith('home')
    await user.click(screen.getAllByRole('button', { name: 'Edit site icon' })[0])
    expect(onEditFavicon).toHaveBeenCalledTimes(1)
  })

  it('turns the address into an editor and remounts the page on reload', async () => {
    const user = userEvent.setup()
    const onAddressChange = vi.fn()
    const { container } = renderFrame({ address: 'acme.test', onAddressChange })

    await user.click(screen.getByTitle('Edit page link'))
    const input = screen.getByRole('textbox', { name: 'Page link' })
    await user.clear(input)
    await user.type(input, 'portfolio.test/work{Enter}')
    expect(onAddressChange).toHaveBeenCalledWith('portfolio.test/work')

    expect(container.querySelector('[data-browser-reload]')).toHaveAttribute('data-browser-reload', '0')
    await user.click(screen.getByRole('button', { name: 'Reload preview' }))
    expect(container.querySelector('[data-browser-reload]')).toHaveAttribute('data-browser-reload', '1')
  })

  it('collapses pages after six into an overflow picker', async () => {
    const user = userEvent.setup()
    const manyPages = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Page ${index + 1}`,
    }))
    const onEditPage = vi.fn()
    renderFrame({ pages: manyPages, currentPageId: 'p1', onEditPage })

    expect(screen.getAllByRole('tab')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 'More pages' }))
    await user.click(screen.getByRole('menuitem', { name: 'Page 8' }))
    expect(onEditPage).toHaveBeenCalledWith('p8')
  })

  it('offers real fullscreen from the browser menu', async () => {
    const user = userEvent.setup()
    let fullscreenElement = null
    const previousDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    })
    const requestFullscreen = vi.fn(function requestFullscreen() {
      fullscreenElement = this
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })
    const { container } = renderFrame()

    await user.click(screen.getByRole('button', { name: 'Browser menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Enter full screen' }))
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-browser-fullscreen-viewport]')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Browser menu' }))
    expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Browser zoom out' }))
    expect(container.querySelector('[data-browser-zoom]')).toHaveAttribute('data-browser-zoom', '90')

    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
    if (previousDescriptor) Object.defineProperty(document, 'fullscreenElement', previousDescriptor)
    else delete document.fullscreenElement
  })
})
