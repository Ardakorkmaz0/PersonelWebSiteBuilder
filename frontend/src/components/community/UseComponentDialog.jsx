// "Use this" — the moment a shared block becomes part of your own site.
//
// The picker exists because the answer is never obvious: most people have more
// than one site, and putting a pricing card on the wrong one is the kind of
// mistake that is annoying to undo. So it asks, shows what it is about to do,
// and then takes you to the block it just added rather than leaving you to go
// and find it.
//
// Mounted only while it is open, so every choice starts clean and no effect
// has to reset anything. What the pickers show is DERIVED from what has
// loaded — a fetched-but-stale page list belongs to the site it came from, and
// is simply not used once a different site is chosen.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSites, getSite } from '../../api/sites.js'
import { takeComponent } from '../../api/community.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { SPOTLIGHT_Z } from '../editor/spotlight.js'

export default function UseComponentDialog({ component, onClose, onUsed }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [sites, setSites] = useState(null)
  const [chosenSite, setChosenSite] = useState('')
  const [pageData, setPageData] = useState({ siteId: '', list: [] })
  const [chosenPage, setChosenPage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const siteId = chosenSite || (sites?.[0] ? String(sites[0].id) : '')
  const pages = pageData.siteId === siteId ? pageData.list : []
  const pageId = pages.some((page) => page.id === chosenPage) ? chosenPage : pages[0]?.id || ''

  useEffect(() => {
    let cancelled = false
    listSites()
      .then((data) => {
        if (!cancelled) setSites(Array.isArray(data) ? data : data?.results || [])
      })
      .catch(() => {
        if (cancelled) return
        setSites([])
        setError(t('Could not load your sites.'))
      })
    return () => { cancelled = true }
  }, [t])

  // The page list belongs to the chosen site, so it is fetched per choice
  // rather than up front — most people pick the first site and never see the
  // rest of their pages loaded for nothing.
  useEffect(() => {
    if (!siteId) return undefined
    let cancelled = false
    getSite(siteId)
      .then((site) => {
        if (!cancelled) setPageData({ siteId, list: site?.schema?.pages || [] })
      })
      .catch(() => {
        if (!cancelled) setPageData({ siteId, list: [] })
      })
    return () => { cancelled = true }
  }, [siteId])

  if (!component) return null

  const add = async () => {
    if (busy || !siteId) return
    setBusy(true)
    setError('')
    try {
      const result = await takeComponent(component.id, { siteId: Number(siteId), pageId })
      onUsed?.(result)
      onClose?.()
      // Straight to the site it landed on — being dropped back on the grid
      // with a silent "done" is how people lose track of what happened.
      navigate(`/editor/${result.site_id}`)
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not add this component.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="studio-theme-surface fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: SPOTLIGHT_Z }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Add to one of your sites')}
    >
      <button
        type="button"
        aria-label={t('Close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-[color-mix(in_srgb,var(--studio-shell)_72%,transparent)] backdrop-blur-md"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-panel)] shadow-[var(--studio-shadow-menu)]">
        <div className="border-b border-[var(--studio-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--studio-text)]">{t('Add to one of your sites')}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--studio-text-muted)]">{component.title}</p>
        </div>

        <div className="space-y-3 p-4">
          {sites === null ? (
            <p className="text-xs text-[var(--studio-text-muted)]">{t('Loading…')}</p>
          ) : sites.length === 0 ? (
            <p className="text-xs text-[var(--studio-text-muted)]">
              {t('You have no sites yet — create one first.')}
            </p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Site')}</span>
                <select
                  value={siteId}
                  onChange={(event) => setChosenSite(event.target.value)}
                  className="studio-input w-full px-3 py-2 text-sm"
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.title}</option>
                  ))}
                </select>
              </label>

              {pages.length > 1 && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Page')}</span>
                  <select
                    value={pageId}
                    onChange={(event) => setChosenPage(event.target.value)}
                    className="studio-input w-full px-3 py-2 text-sm"
                  >
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>{page.name || page.id}</option>
                    ))}
                  </select>
                </label>
              )}

              <p className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] px-3 py-2 text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
                {t('A copy is added below whatever is already on the page. It is yours to edit — later changes by the author do not reach it.')}
              </p>
            </>
          )}

          {error && <p role="alert" className="studio-status-danger rounded-lg border px-3 py-2 text-xs">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-[var(--studio-border)] p-3">
          <button type="button" onClick={onClose} className="studio-btn studio-btn-secondary px-4 py-2 text-sm">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={add}
            disabled={busy || !siteId}
            className="studio-btn studio-btn-accent ms-auto px-4 py-2 text-sm disabled:opacity-40"
          >
            {busy ? t('Adding…') : t('Add to my site')}
          </button>
        </div>
      </div>
    </div>
  )
}
