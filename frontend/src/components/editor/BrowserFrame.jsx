import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage.js'
import { sanitizeImageSrc } from '../../utils/sanitize.js'
import {
  BROWSER_FRAME_BOTTOM,
  BROWSER_FRAME_SIDE,
  BROWSER_FRAME_TOP,
  browserFrameH,
  browserFrameW,
} from './browserFrameMetrics.js'

const BROWSER_ZOOM_KEY = 'pwb_browser_preview_zoom'
const ZOOM_STEPS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200]

function readBrowserZoom() {
  try {
    const value = localStorage.getItem(BROWSER_ZOOM_KEY)
    if (value === 'fit') return 'fit'
    const number = Number(value)
    return ZOOM_STEPS.includes(number) ? number : 'fit'
  } catch {
    return 'fit'
  }
}

function pageTitle(page, fallback) {
  return String(page?.seoTitle || page?.name || fallback || 'Untitled page').trim()
}

function pagePath(page, index) {
  if (index === 0) return '/'
  const source = String(page?.slug || page?.name || `page-${index + 1}`)
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return `/${source || `page-${index + 1}`}`
}

function visiblePageAddress(address, page, index) {
  const raw = String(address || 'preview.sitebuilder.local')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
  // A canonical URL already has a path. A bare domain receives the path of the
  // selected design page so the address bar behaves like a real browser.
  return raw.includes('/') ? raw : `${raw}${pagePath(page, index)}`
}

function Favicon({ src, title }) {
  const safeSrc = sanitizeImageSrc(src)
  if (safeSrc) {
    return <img src={safeSrc} alt="" className="h-4 w-4 shrink-0 rounded-[4px] object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-[var(--studio-accent)] text-[9px] font-bold text-white"
    >
      {(String(title || 'S').trim()[0] || 'S').toLocaleUpperCase()}
    </span>
  )
}

export default function BrowserFrame({
  screenWidth,
  screenHeight,
  siteTitle = 'My Site',
  favicon = '',
  address = 'preview.sitebuilder.local',
  pages = [],
  currentPageId = '',
  onSelectPage,
  onEditPage,
  onEditFavicon,
  onAddressChange,
  children,
}) {
  const { t } = useLanguage()
  const frameRef = useRef(null)
  const addressInputRef = useRef(null)
  const fullscreenViewportRef = useRef(null)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [browserMenuOpen, setBrowserMenuOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressDraft, setAddressDraft] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenWidth, setFullscreenWidth] = useState(
    typeof window === 'undefined' ? screenWidth : window.innerWidth,
  )
  const [zoom, setZoomState] = useState(readBrowserZoom)
  const tabs = useMemo(
    () => pages.length ? pages : [{ id: currentPageId || 'page', name: siteTitle }],
    [currentPageId, pages, siteTitle],
  )
  const activeIndex = Math.max(0, tabs.findIndex((page) => page.id === currentPageId))
  const activePage = tabs[activeIndex] || tabs[0]
  const visibleAddress = visiblePageAddress(address, activePage, activeIndex)

  const { shownTabs, hiddenTabs } = useMemo(() => {
    if (tabs.length <= 6) return { shownTabs: tabs, hiddenTabs: [] }
    const shown = tabs.slice(0, 5)
    if (!shown.some((page) => page.id === activePage?.id)) shown[4] = activePage
    const ids = new Set(shown.map((page) => page.id))
    return { shownTabs: shown, hiddenTabs: tabs.filter((page) => !ids.has(page.id)) }
  }, [activePage, tabs])

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    if (!fullscreen) return undefined
    const update = () => {
      setFullscreenWidth(fullscreenViewportRef.current?.clientWidth || window.innerWidth)
    }
    const frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(update)
    if (fullscreenViewportRef.current) observer?.observe(fullscreenViewportRef.current)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [fullscreen])

  useEffect(() => {
    if (!editingAddress) return undefined
    const frame = requestAnimationFrame(() => {
      addressInputRef.current?.focus()
      addressInputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [editingAddress, visibleAddress])

  function beginAddressEdit() {
    setAddressDraft(visibleAddress)
    setEditingAddress(true)
  }

  function setZoom(next) {
    const normalized = next === 'fit'
      ? 'fit'
      : ZOOM_STEPS.includes(Number(next)) ? Number(next) : 100
    setZoomState(normalized)
    try { localStorage.setItem(BROWSER_ZOOM_KEY, String(normalized)) } catch { /* ignore */ }
  }

  const fitScale = Math.max(0.25, Math.min(2, (fullscreenWidth - 24) / screenWidth))
  const zoomPercent = zoom === 'fit' ? Math.round(fitScale * 100) : zoom
  const fullscreenScale = zoom === 'fit' ? fitScale : zoom / 100

  function adjustZoom(direction) {
    const current = zoomPercent
    if (direction < 0) {
      setZoom([...ZOOM_STEPS].reverse().find((step) => step < current) || ZOOM_STEPS[0])
      return
    }
    setZoom(ZOOM_STEPS.find((step) => step > current) || ZOOM_STEPS[ZOOM_STEPS.length - 1])
  }

  function openPage(pageId) {
    setPageMenuOpen(false)
    if (onEditPage) onEditPage(pageId)
    else onSelectPage?.(pageId)
  }

  function commitAddress() {
    const next = addressDraft.trim()
    setEditingAddress(false)
    if (next !== visibleAddress) onAddressChange?.(next)
  }

  async function toggleFullscreen() {
    setBrowserMenuOpen(false)
    try {
      if (document.fullscreenElement === frameRef.current) await document.exitFullscreen?.()
      else await frameRef.current?.requestFullscreen?.()
    } catch {
      // The browser may deny fullscreen without a user gesture. The menu remains
      // usable and a later direct click can try again.
    }
  }

  return (
    <section
      ref={frameRef}
      data-builder-browser-frame
      aria-label={t('Browser preview')}
      style={{
        width: fullscreen ? '100vw' : screenWidth + browserFrameW(),
        height: fullscreen ? '100vh' : screenHeight + browserFrameH(),
        boxSizing: 'border-box',
        padding: fullscreen
          ? `${BROWSER_FRAME_TOP}px 0 0`
          : `${BROWSER_FRAME_TOP}px ${BROWSER_FRAME_SIDE}px ${BROWSER_FRAME_BOTTOM}px`,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--studio-border-strong)',
        borderRadius: fullscreen ? 0 : 16,
        background: 'var(--studio-control)',
        boxShadow: fullscreen ? 'none' : '0 26px 70px rgba(0,0,0,.28), inset 0 1px rgba(255,255,255,.05)',
      }}
    >
      <div className="absolute inset-x-2 top-0 h-[39px]">
        <div className="flex h-full min-w-0 items-end gap-2">
          <div aria-hidden="true" className="mb-3 flex shrink-0 gap-1.5 px-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div role="tablist" aria-label={t('Open site pages')} className="flex min-w-0 flex-1 items-end gap-1">
            {shownTabs.map((page, index) => {
              const active = page.id === activePage?.id
              const label = pageTitle(page, siteTitle)
              return (
                <div
                  key={page.id || index}
                  role="tab"
                  aria-label={label}
                  aria-selected={active}
                  className={`flex h-8 min-w-0 max-w-[220px] flex-1 items-center rounded-t-[10px] border px-2 text-[11px] transition-colors ${
                    active
                      ? 'border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-text)]'
                      : 'border-transparent bg-transparent text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onEditFavicon?.() }}
                    title={t('Edit site icon')}
                    aria-label={t('Edit site icon')}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-[var(--studio-control-hover)]"
                  >
                    <Favicon src={favicon} title={siteTitle} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openPage(page.id)}
                    title={t('Edit {name}', { name: label })}
                    aria-label={t('Edit {name}', { name: label })}
                    className="h-full min-w-0 flex-1 truncate px-1.5 text-left"
                  >
                    {label}
                  </button>
                </div>
              )
            })}
            {hiddenTabs.length > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label={t('More pages')}
                  aria-expanded={pageMenuOpen}
                  onClick={() => { setPageMenuOpen((open) => !open); setBrowserMenuOpen(false) }}
                  className="mb-0.5 grid h-8 w-10 place-items-center rounded-t-lg text-sm font-bold text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)]"
                >
                  &#8230;
                </button>
                {pageMenuOpen && (
                  <div role="menu" className="absolute right-0 top-full z-[120] mt-1 w-56 overflow-hidden rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] py-1 shadow-2xl">
                    {hiddenTabs.map((page) => {
                      const label = pageTitle(page, siteTitle)
                      return (
                        <button key={page.id} type="button" role="menuitem" onClick={() => openPage(page.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">
                          <Favicon src={favicon} title={siteTitle} />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-2 top-[39px] flex h-[39px] items-center gap-1.5 border-t border-[var(--studio-border)]">
        <button
          type="button"
          onClick={() => setReloadNonce((value) => value + 1)}
          title={t('Reload preview')}
          aria-label={t('Reload preview')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
        >
          &#8635;
        </button>
        <div className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface)] px-1.5 text-[11px] text-[var(--studio-text-muted)] focus-within:border-[var(--studio-accent)]">
          <button type="button" onClick={onEditFavicon} title={t('Edit site icon')} aria-label={t('Edit site icon')} className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-[var(--studio-control-hover)]">
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
              className="min-w-0 flex-1 bg-transparent py-1 text-[11px] text-[var(--studio-text)] outline-none"
            />
          ) : (
            <button type="button" onClick={beginAddressEdit} title={t('Edit page link')} className="min-w-0 flex-1 truncate py-1 text-left">
              {visibleAddress}
            </button>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => { setBrowserMenuOpen((open) => !open); setPageMenuOpen(false) }}
            aria-label={t('Browser menu')}
            aria-expanded={browserMenuOpen}
            className="grid h-7 w-7 place-items-center rounded-md text-base text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]"
          >
            &#8942;
          </button>
          {browserMenuOpen && (
            <div role="menu" className="absolute right-0 top-full z-[120] mt-1 w-60 overflow-hidden rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel)] py-1 shadow-2xl">
              {fullscreen && (
                <>
                  <div role="group" aria-label={t('Zoom')} className="flex items-center gap-1 border-b border-[var(--studio-border)] px-3 py-2">
                    <span className="mr-auto text-xs font-medium text-[var(--studio-text)]">{t('Zoom')}</span>
                    <button type="button" onClick={() => adjustZoom(-1)} aria-label={t('Browser zoom out')} className="grid h-7 w-7 place-items-center rounded-md text-base text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">&#8722;</button>
                    <button type="button" onClick={() => setZoom(100)} title={t('Reset zoom')} className="min-w-12 rounded-md px-1.5 py-1 text-center text-[11px] font-semibold text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">{zoomPercent}%</button>
                    <button type="button" onClick={() => adjustZoom(1)} aria-label={t('Browser zoom in')} className="grid h-7 w-7 place-items-center rounded-md text-base text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">+</button>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { setZoom('fit'); setBrowserMenuOpen(false) }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--studio-control-hover)] ${zoom === 'fit' ? 'text-[var(--studio-accent-hover)]' : 'text-[var(--studio-text)]'}`}>
                    <span aria-hidden>&#8644;</span>
                    <span className="flex-1">{t('Fit to browser window')}</span>
                    {zoom === 'fit' && <span aria-hidden>&#10003;</span>}
                  </button>
                </>
              )}
              <button type="button" role="menuitem" onClick={toggleFullscreen} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">
                <span aria-hidden>&#9974;</span>
                {t(fullscreen ? 'Exit full screen' : 'Enter full screen')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setBrowserMenuOpen(false); onEditFavicon?.() }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">
                <Favicon src={favicon} title={siteTitle} />
                {t('Edit site icon')}
              </button>
              <button type="button" role="menuitem" onClick={() => { setBrowserMenuOpen(false); beginAddressEdit() }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--studio-text)] hover:bg-[var(--studio-control-hover)]">
                <span aria-hidden>&#128279;</span>
                {t('Edit page link')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={fullscreenViewportRef}
        data-browser-fullscreen-viewport={fullscreen ? '' : undefined}
        className={fullscreen ? 'absolute inset-x-0 bottom-0 top-[78px] overflow-auto bg-white' : 'overflow-hidden'}
        style={fullscreen ? undefined : { width: screenWidth, height: screenHeight }}
      >
        <div
          className={fullscreen ? 'mx-auto' : ''}
          data-browser-zoom={fullscreen ? zoomPercent : 100}
          style={fullscreen ? {
            width: screenWidth * fullscreenScale,
            height: screenHeight * fullscreenScale,
            minHeight: '100%',
          } : { width: screenWidth, height: screenHeight }}
        >
          <div
            key={reloadNonce}
            data-browser-reload={reloadNonce}
            className="overflow-hidden bg-white"
            style={{
              width: screenWidth,
              height: screenHeight,
              transform: fullscreenScale !== 1 && fullscreen ? `scale(${fullscreenScale})` : undefined,
              transformOrigin: 'top left',
              borderRadius: fullscreen ? 0 : '0 0 8px 8px',
              boxShadow: fullscreen ? 'none' : '0 0 0 1px rgba(0,0,0,.28)',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}
