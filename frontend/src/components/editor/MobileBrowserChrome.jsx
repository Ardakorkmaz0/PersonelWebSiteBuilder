// The browser INSIDE the phone.
//
// The desktop preview has had a window frame for a while — tab strip, address
// bar, reload — but the phone preview handed the page the entire screen, which
// no real phone does. Safari and Chrome eat a status bar, an address bar and a
// toolbar; a hero sized to the device height is taller than what the visitor
// actually sees, and a button pinned to the bottom sits under the toolbar. That
// only shows up in a frame that takes the same pixels the real browser takes.
//
// This draws that chrome and hands the page what is left. It lives INSIDE
// PhoneFrame's screen, so the caller grows (or shrinks) the screen accordingly —
// see the two comments at the call sites, which size it differently on purpose:
// a fixed device viewport gives the chrome its own pixels, a content-height
// artboard grows so nothing is clipped.
//
// The controls are real, not decoration: the address is editable, reload
// remounts the page, the tab button lists the site's pages and opens one for
// editing. Back and forward are the exception — there is no history to walk, so
// they are drawn dimmed, exactly as a real browser draws them.

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'
import { ArrowLeftIcon, ArrowRightIcon, MoreHorizontalIcon } from '../icons.jsx'
import Favicon from './BrowserFavicon.jsx'
import { pageTitle, visiblePageAddress } from './browserPageAddress.js'
import {
  MOBILE_BROWSER_BAR,
  MOBILE_BROWSER_GESTURE,
  MOBILE_BROWSER_STATUS,
  MOBILE_BROWSER_TOOLBAR,
  mobileBrowserChromeH,
  mobileBrowserSkin,
} from './browserFrameMetrics.js'

// The status-bar clock, showing the real time in the editor's language: 24-hour
// in Turkish, 12-hour in English, exactly like the phone would.
//
// It ticks on the minute BOUNDARY rather than every 60s from mount, so the
// minute on screen is never stale, and only this strip re-renders.
// Its OWN component, deliberately: the minute state lives here, so a tick
// re-renders this one span and nothing else. The page being previewed — an
// iframe, or the edit canvas — is never touched, which is the whole point. A
// preview that blinked once a minute would be worse than no clock at all.
function StatusClock() {
  const { language } = useLanguage()
  // The instant is state; the formatting is derived at render, so switching the
  // editor's language reformats the clock without another effect.
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer = 0
    // On the minute BOUNDARY, not every 60s from mount, so the minute on
    // screen is never stale.
    const tick = () => {
      timer = setTimeout(() => {
        setNow(new Date())
        tick()
      }, 60000 - (Date.now() % 60000) + 50)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  return (
    <span>
      {now.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}
    </span>
  )
}

function StatusIndicators() {
  return (
    <span aria-hidden="true" className="flex items-center gap-1.5 opacity-80">
      <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" focusable="false">
        <rect x="0" y="7" width="3" height="4" rx="1" />
        <rect x="4.5" y="5" width="3" height="6" rx="1" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
        <rect x="13.5" y="0" width="3" height="11" rx="1" />
      </svg>
      <svg width="15" height="11" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" focusable="false">
        <path d="M1 4.2a10 10 0 0 1 14 0" />
        <path d="M3.6 7a6.4 6.4 0 0 1 8.8 0" />
        <path d="M6.4 9.7a2.4 2.4 0 0 1 3.2 0" />
      </svg>
      <svg width="24" height="11" viewBox="0 0 25 12" fill="none" focusable="false">
        <rect x="0.6" y="0.6" width="20" height="10.8" rx="3" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
        <rect x="2.2" y="2.2" width="14" height="7.6" rx="1.8" fill="currentColor" />
        <path d="M22.4 4.2v3.6a2.6 2.6 0 0 0 0-3.6Z" fill="currentColor" opacity="0.55" />
      </svg>
    </span>
  )
}

// A control that looks like a browser button but has nothing to do: history in
// a preview. Dimmed and inert, the way a real browser shows an empty stack.
function DeadControl({ children }) {
  return (
    <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full text-[var(--studio-text-faint)] opacity-45">
      {children}
    </span>
  )
}

export default function MobileBrowserChrome({
  screenWidth,
  screenHeight,
  model,
  siteTitle = 'My Site',
  favicon = '',
  address = 'preview.sitebuilder.local',
  pages = [],
  currentPageId = '',
  onSelectPage,
  onEditPage,
  onEditFavicon,
  onAddressChange,
  onBeforeReload,
  children,
}) {
  const { t } = useLanguage()
  const addressInputRef = useRef(null)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressDraft, setAddressDraft] = useState('')
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [browserMenuOpen, setBrowserMenuOpen] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  const skin = mobileBrowserSkin(model)
  const android = skin === 'android'
  const tabs = pages.length ? pages : [{ id: currentPageId || 'page', name: siteTitle }]
  const activeIndex = Math.max(0, tabs.findIndex((page) => page.id === currentPageId))
  const activePage = tabs[activeIndex] || tabs[0]
  const visibleAddress = visiblePageAddress(address, activePage, activeIndex)

  useEffect(() => {
    if (!editingAddress) return undefined
    const frame = requestAnimationFrame(() => {
      addressInputRef.current?.focus()
      addressInputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [editingAddress, visibleAddress])

  function beginAddressEdit() {
    setBrowserMenuOpen(false)
    setAddressDraft(visibleAddress)
    setEditingAddress(true)
  }

  function commitAddress() {
    const next = addressDraft.trim()
    setEditingAddress(false)
    if (next !== visibleAddress) onAddressChange?.(next)
  }

  function openPage(pageId) {
    setPageMenuOpen(false)
    if (onEditPage) onEditPage(pageId)
    else onSelectPage?.(pageId)
  }

  function reload() {
    onBeforeReload?.()
    setReloadNonce((value) => value + 1)
  }

  const menuSurface = 'overflow-hidden rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] py-1 shadow-2xl'
  const menuItem = 'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]'
  // Menus drop from the row that owns the buttons: down from the top bar on
  // Android, up from the toolbar on iOS.
  const menuAnchor = android
    ? { top: MOBILE_BROWSER_STATUS + MOBILE_BROWSER_BAR + 4 }
    : { bottom: MOBILE_BROWSER_TOOLBAR + 4 }

  const pagesMenu = pageMenuOpen && (
    <div
      role="menu"
      aria-label={t('Open site pages')}
      style={menuAnchor}
      className={`absolute right-3 z-[120] max-h-56 w-[calc(100%-24px)] overflow-auto ${menuSurface}`}
    >
      {tabs.map((page) => {
        const label = pageTitle(page, siteTitle)
        return (
          <button
            key={page.id}
            type="button"
            role="menuitem"
            onClick={() => openPage(page.id)}
            aria-current={page.id === activePage?.id}
            className={`${menuItem} ${page.id === activePage?.id ? 'text-[var(--studio-accent-hover)]' : ''}`}
            title={t('Edit {name}', { name: label })}
          >
            <Favicon src={favicon} title={siteTitle} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )

  const browserMenu = browserMenuOpen && (
    <div
      role="menu"
      style={menuAnchor}
      className={`absolute right-3 z-[120] w-56 ${menuSurface}`}
    >
      <button type="button" role="menuitem" onClick={() => { setBrowserMenuOpen(false); onEditFavicon?.() }} className={menuItem}>
        <Favicon src={favicon} title={siteTitle} />
        {t('Edit site icon')}
      </button>
      <button type="button" role="menuitem" onClick={beginAddressEdit} className={menuItem}>
        <span aria-hidden>&#128279;</span>
        {t('Edit page link')}
      </button>
    </div>
  )

  const tabsButton = (
    <button
      type="button"
      onClick={() => { setPageMenuOpen((open) => !open); setBrowserMenuOpen(false) }}
      aria-label={t('Open site pages')}
      aria-expanded={pageMenuOpen}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
    >
      <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.6px] border-current text-[10px] font-bold leading-none">
        {tabs.length}
      </span>
    </button>
  )

  const menuButton = (
    <button
      type="button"
      onClick={() => { setBrowserMenuOpen((open) => !open); setPageMenuOpen(false) }}
      aria-label={t('Browser menu')}
      aria-expanded={browserMenuOpen}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)] ${
        android ? 'rotate-90' : ''
      }`}
    >
      <MoreHorizontalIcon size={18} />
    </button>
  )

  return (
    <div
      data-builder-browser-frame="mobile"
      data-builder-mobile-browser={skin}
      aria-label={t('Browser preview')}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: screenWidth,
        height: screenHeight + mobileBrowserChromeH(model),
        background: 'var(--studio-panel-raised)',
        color: 'var(--studio-text)',
      }}
    >
      {/* Status bar. The camera cutout is drawn by PhoneFrame on top of this
          strip, which is exactly where it sits on the real device. */}
      <div
        className="flex shrink-0 items-center justify-between px-5 text-[11px] font-semibold text-[var(--studio-text)]"
        style={{ height: MOBILE_BROWSER_STATUS }}
      >
        <StatusClock />
        <StatusIndicators />
      </div>

      {/* Address row. On Android the tab and menu buttons share this row —
          Chrome has no bottom toolbar — while iOS keeps them at the bottom. */}
      <div
        className="flex shrink-0 items-center gap-1 px-3"
        style={{ height: MOBILE_BROWSER_BAR }}
      >
        <div className="flex h-9 min-w-0 flex-1 items-center gap-1 rounded-full border border-[var(--studio-border)] bg-[var(--studio-control)] px-2 text-[12px] text-[var(--studio-text-muted)] focus-within:border-[var(--studio-accent)]">
          <button
            type="button"
            onClick={onEditFavicon}
            title={t('Edit site icon')}
            aria-label={t('Edit site icon')}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-[var(--studio-control-hover)]"
          >
            <Favicon src={favicon} title={siteTitle} />
          </button>
          {editingAddress ? (
            <input
              ref={addressInputRef}
              value={addressDraft}
              onChange={(event) => setAddressDraft(event.target.value)}
              onBlur={commitAddress}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitAddress()
                if (event.key === 'Escape') setEditingAddress(false)
              }}
              aria-label={t('Page link')}
              className="min-w-0 flex-1 bg-transparent py-1 text-[12px] text-[var(--studio-text)] outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={beginAddressEdit}
              title={t('Edit page link')}
              className="min-w-0 flex-1 truncate py-1 text-center"
            >
              {visibleAddress}
            </button>
          )}
          <button
            type="button"
            onClick={reload}
            title={t('Reload preview')}
            aria-label={t('Reload preview')}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
          >
            &#8635;
          </button>
        </div>
        {android && tabsButton}
        {android && menuButton}
      </div>

      {/* What is left is the page: exactly the viewport a visitor gets. */}
      <div
        key={reloadNonce}
        data-browser-reload={reloadNonce}
        className="relative overflow-hidden bg-white"
        style={{ width: screenWidth, height: screenHeight }}
      >
        {children}
      </div>

      {/* iOS toolbar, or Android's system gesture strip. */}
      {android ? (
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ height: MOBILE_BROWSER_GESTURE }}
        >
          <span aria-hidden="true" className="h-1 w-28 rounded-full bg-[var(--studio-text-faint)] opacity-60" />
        </div>
      ) : (
        <div
          className="flex shrink-0 items-center justify-around border-t border-[var(--studio-border)] px-4"
          style={{ height: MOBILE_BROWSER_TOOLBAR }}
        >
          <DeadControl><ArrowLeftIcon size={18} /></DeadControl>
          <DeadControl><ArrowRightIcon size={18} /></DeadControl>
          {tabsButton}
          {menuButton}
        </div>
      )}

      {pagesMenu}
      {browserMenu}
    </div>
  )
}
