import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { serializeDocument } from '../../utils/htmlPlacement.js'
import HtmlWorkspace, { installSelectionResizeChrome } from './HtmlWorkspace.jsx'
import { hasUnsavedSourceDraft } from '../../utils/htmlSourceDraft.js'

describe('HTML source save state', () => {
  it('marks only changed source drafts as unsaved', () => {
    expect(hasUnsavedSourceDraft('source', '<p>new</p>', '<p>old</p>')).toBe(true)
    expect(hasUnsavedSourceDraft('source', '<p>same</p>', '<p>same</p>')).toBe(false)
    expect(hasUnsavedSourceDraft('view', '<p>new</p>', '<p>old</p>')).toBe(false)
  })
})

describe('HTML workspace device chrome', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    }
  })

  it('uses a transient real-mobile viewport in Edit mode', () => {
    localStorage.setItem('pwb_htmlmode_viewport-test', 'edit')
    render(
      <LanguageProvider>
        <HtmlWorkspace
          persistKey="viewport-test"
          html="<html><head><title>Test</title></head><body><header>Wide header</header></body></html>"
          deviceId="iphone15pro"
        />
      </LanguageProvider>,
    )

    const source = screen.getByTitle('site').getAttribute('srcdoc') || ''
    expect(source).toContain('name="viewport"')
    expect(source).toContain('data-pwb-injected')
  })

  it('frames the page as a window on desktop and as a phone browser on mobile', () => {
    const { unmount } = render(
      <LanguageProvider>
        <HtmlWorkspace
          persistKey="browser-desktop"
          html="<html><body><main>Desktop</main></body></html>"
          deviceId="desktop-16-9"
          browserFrame
          onBrowserFrameToggle={vi.fn()}
        />
      </LanguageProvider>,
    )
    expect(document.querySelector('[data-builder-browser-frame]')).not.toBeNull()
    expect(document.querySelector('[data-builder-mobile-browser]')).toBeNull()
    unmount()

    // A phone runs a browser too: the bezel stays and the chrome goes INSIDE
    // it, taking the same screen the real browser takes.
    render(
      <LanguageProvider>
        <HtmlWorkspace
          persistKey="browser-mobile"
          html="<html><body><main>Mobile</main></body></html>"
          deviceId="iphone15pro"
          browserFrame
          onBrowserFrameToggle={vi.fn()}
        />
      </LanguageProvider>,
    )
    expect(document.querySelector('[data-builder-phone-frame]')).not.toBeNull()
    expect(document.querySelector('[data-builder-mobile-browser]')).toHaveAttribute(
      'data-builder-mobile-browser',
      'ios',
    )
  })

  it('leaves the phone bare when the browser frame is off', () => {
    render(
      <LanguageProvider>
        <HtmlWorkspace
          persistKey="browser-mobile-off"
          html="<html><body><main>Mobile</main></body></html>"
          deviceId="iphone15pro"
          onBrowserFrameToggle={vi.fn()}
        />
      </LanguageProvider>,
    )
    expect(document.querySelector('[data-builder-phone-frame]')).not.toBeNull()
    expect(document.querySelector('[data-builder-browser-frame]')).toBeNull()
  })

  it('snapshots the live edit document before a device frame remount', () => {
    localStorage.setItem('pwb_htmlmode-frame-snapshot', 'edit')
    const workspaceRef = createRef()
    const onCommit = vi.fn()
    const html = '<html><head></head><body><h1>Original</h1></body></html>'
    const renderWorkspace = (deviceId) => (
      <LanguageProvider>
        <HtmlWorkspace
          ref={workspaceRef}
          persistKey="frame-snapshot"
          html={html}
          deviceId={deviceId}
          onCommit={onCommit}
        />
      </LanguageProvider>
    )
    const { rerender } = render(renderWorkspace('iphone15pro'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const iframe = screen.getByTitle('site')
    iframe.contentDocument.head.innerHTML = '<style data-pwb-responsive-overrides>@media (max-width:767px){[data-pwb-mobile-font-size]{font-size:var(--pwb-mobile-font-size)!important}}</style>'
    iframe.contentDocument.body.innerHTML = '<h1 data-pwb-mobile-font-size style="--pwb-mobile-font-size: 30px">Changed</h1>'

    act(() => workspaceRef.current.prepareFrameChange())
    expect(onCommit).toHaveBeenCalledWith(expect.stringContaining('Changed'))

    rerender(renderWorkspace('desktop-16-9'))
    const remountedSource = screen.getByTitle('site').getAttribute('srcdoc') || ''
    expect(remountedSource).toContain('data-pwb-mobile-font-size')
    expect(remountedSource).toContain('--pwb-mobile-font-size: 30px')
    expect(remountedSource).toContain('Changed')
  })
})

describe('looking at a page in Edit mode', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  })

  // Hand-written markup with the three things a DOM round-trip rewrites: the
  // newline after <html>, a self-closed SVG tag, and a bare boolean attribute.
  const NL = String.fromCharCode(10)
  const AUTHORED = [
    '<!DOCTYPE html>',
    '<html lang="tr">',
    '<head><title>Ada</title></head>',
    '<body>',
    '<svg viewBox="0 0 24 24"><path d="M4 4h16"/></svg>',
    '<details open><summary>S</summary></details>',
    '</body>',
    '</html>',
  ].join(NL)

  // jsdom never parses an iframe's srcdoc, so the edit document would sit
  // empty and the comparison under test would never run. Writing the same
  // markup in by hand stands in for the browser and puts the real DOM there.
  function openEdit() {
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const doc = screen.getByTitle('site').contentDocument
    doc.open()
    doc.write(AUTHORED)
    doc.close()
    return doc
  }

  function mount(onCommit) {
    render(
      <LanguageProvider>
        <HtmlWorkspace persistKey="roundtrip" html={AUTHORED} onCommit={onCommit} />
      </LanguageProvider>,
    )
  }

  it('hands the author their own text back, byte for byte', () => {
    // The bug: Edit parsed the document and View serialized it, and those are
    // not inverses — the page came back reformatted and the editor called it
    // unsaved work. Opening a page and closing it again must change nothing.
    const onCommit = vi.fn()
    mount(onCommit)
    openEdit()

    fireEvent.click(screen.getByRole('button', { name: 'View' }))

    for (const call of onCommit.mock.calls) expect(call[0]).toBe(AUTHORED)
  })

  it('does not quietly rewrite the svg or the boolean attribute', () => {
    const onCommit = vi.fn()
    mount(onCommit)
    openEdit()

    fireEvent.click(screen.getByRole('button', { name: 'View' }))

    const last = onCommit.mock.calls.at(-1)?.[0] ?? AUTHORED
    expect(last).toContain('<path d="M4 4h16"/>')
    expect(last).toContain('<details open>')
    expect(last).not.toContain('open=""')
  })

  it('still reports a real edit', () => {
    // The other half: keeping the author's text must not swallow actual work.
    const onCommit = vi.fn()
    mount(onCommit)
    const doc = openEdit()
    doc.querySelector('summary').textContent = 'Yeni'

    fireEvent.click(screen.getByRole('button', { name: 'View' }))

    expect(onCommit).toHaveBeenCalledWith(expect.stringContaining('Yeni'))
  })
})

describe('HTML selection quick actions', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main><p id="selected">Hello</p></main>'
  })

  it('shows the common actions next to the selected element', () => {
    const selected = document.getElementById('selected')
    selected.getBoundingClientRect = () => ({
      left: 20,
      top: 80,
      right: 220,
      bottom: 120,
      width: 200,
      height: 40,
    })
    const onAction = vi.fn()

    installSelectionResizeChrome(document, selected, vi.fn(), onAction, {
      toolbar: 'Düzenle',
      parent: 'Üst öğeyi seç',
      duplicate: 'Çoğalt',
      up: 'Yukarı taşı',
      down: 'Aşağı taşı',
      spotlight: 'Büyük aç',
      delete: 'Bileşeni sil',
    })

    const toolbar = document.querySelector('[data-pwb-selection-toolbar]')
    expect(toolbar).toHaveAttribute('role', 'toolbar')
    expect(toolbar).toHaveAttribute('aria-label', 'Düzenle')
    expect(toolbar.style.top).toBe('-40px')
    // Which actions, not how many — a count says nothing about what is missing.
    expect([...toolbar.querySelectorAll('[data-pwb-selection-action]')]
      .map((button) => button.getAttribute('data-pwb-selection-action')))
      .toEqual(['parent', 'duplicate', 'up', 'down', 'spotlight', 'share', 'delete'])

    fireEvent.click(toolbar.querySelector('[data-pwb-selection-action="delete"]'))
    expect(onAction).toHaveBeenCalledWith('delete')
  })

  it('opens the spotlight from the toolbar, and labels it in the user’s language', () => {
    const selected = document.getElementById('selected')
    selected.getBoundingClientRect = () => ({ left: 20, top: 80, right: 220, bottom: 120, width: 200, height: 40 })
    const onAction = vi.fn()

    installSelectionResizeChrome(document, selected, vi.fn(), onAction, { spotlight: 'Büyük aç' })

    const button = document.querySelector('[data-pwb-selection-action="spotlight"]')
    expect(button).toHaveAttribute('title', 'Büyük aç')
    expect(button).toHaveAttribute('aria-label', 'Büyük aç')

    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledWith('spotlight')
  })

  it('flips below top-edge selections and never leaks into saved HTML', () => {
    const selected = document.getElementById('selected')
    selected.getBoundingClientRect = () => ({
      left: 4,
      top: 6,
      right: 204,
      bottom: 46,
      width: 200,
      height: 40,
    })

    installSelectionResizeChrome(document, selected, vi.fn(), vi.fn())

    expect(document.querySelector('[data-pwb-selection-toolbar]').style.top).toBe('48px')
    expect(serializeDocument(document)).not.toContain('data-pwb-selection-toolbar')
    expect(serializeDocument(document)).not.toContain('data-pwb-selection-action')
  })
})
