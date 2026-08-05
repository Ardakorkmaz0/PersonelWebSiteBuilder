// "Use this" — the moment a shared block becomes part of your own site.
//
// The picker exists because the answer is never obvious: most people have more
// than one site, and putting a pricing card on the wrong one is the kind of
// mistake that is annoying to undo. So it asks, shows the block it is about to
// add, and then takes you to the site it landed on rather than leaving you to
// go and find it.
//
// A brand-new site is one of the answers. Somebody who came here from a block
// they liked may have nothing to put it in yet, and "create one first" would
// send them away mid-decision — so the destination list ends with a new site
// they can name on the spot.
//
// Mounted only while it is open, so every choice starts clean and no effect
// has to reset anything. What the pickers show is DERIVED from what has
// loaded — a fetched-but-stale page list belongs to the site it came from, and
// is simply not used once a different site is chosen.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSites, getSite, createSite } from '../../api/sites.js'
import { takeComponent } from '../../api/community.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { sharedBlockHtml } from '../../utils/componentExport.js'
import { STATIC_HTML_SANDBOX } from '../../utils/htmlRuntime.js'
import { SPOTLIGHT_Z } from '../editor/spotlight.js'

const NEW_SITE = '__new__'

export default function UseComponentDialog({ component, onClose, onUsed }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [sites, setSites] = useState(null)
  const [chosenSite, setChosenSite] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [pageData, setPageData] = useState({ siteId: '', list: [] })
  const [chosenPage, setChosenPage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // No sites yet → the new-site option IS the default, not a dead end.
  const siteId = chosenSite || (sites?.[0] ? String(sites[0].id) : sites ? NEW_SITE : '')
  const makingNew = siteId === NEW_SITE
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
    if (!siteId || siteId === NEW_SITE) return undefined
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
      // A fresh site already comes with one empty Home page, so the block has
      // somewhere to land the moment it exists.
      const targetId = makingNew
        ? (await createSite(newTitle.trim() || t('My new site'))).id
        : Number(siteId)
      const result = await takeComponent(component.id, {
        siteId: targetId,
        pageId: makingNew ? '' : pageId,
      })
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

        {/* What is about to be added, not just its name. */}
        <iframe
          title={t('What you are adding')}
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:12px;font-family:system-ui}</style></head><body>${sharedBlockHtml(component)}</body></html>`}
          sandbox={STATIC_HTML_SANDBOX}
          className="block h-32 w-full border-0 border-b border-[var(--studio-border)] bg-white"
        />

        <div className="space-y-3 p-4">
          {sites === null ? (
            <p className="text-xs text-[var(--studio-text-muted)]">{t('Loading…')}</p>
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
                  <option value={NEW_SITE}>{t('+ A new site')}</option>
                </select>
              </label>

              {makingNew && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--studio-text-muted)]">{t('Name the new site')}</span>
                  <input
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder={t('My new site')}
                    maxLength={120}
                    className="studio-input w-full px-3 py-2 text-sm"
                  />
                </label>
              )}

              {!makingNew && pages.length > 1 && (
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
                {makingNew
                  ? t('A new draft site is created with this block on its home page.')
                  : t('A copy is added below whatever is already on the page. It is yours to edit — later changes by the author do not reach it.')}
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
            {busy ? t('Adding…') : makingNew ? t('Create site and add') : t('Add to my site')}
          </button>
        </div>
      </div>
    </div>
  )
}
