import { useEffect, useMemo, useState } from 'react'
import {
  configureDomain,
  deleteSiteSubmission,
  getDomainSetup,
  getSiteAnalytics,
  listSiteComments,
  listSiteSubmissions,
  patchSite,
  regenerateReviewLink,
  resolveSiteComment,
  updateSiteSubmission,
} from '../../api/sites.js'
import { apiError } from '../../utils/errors.js'
import { extractSiteContent, updateHtmlContent, updateSchemaContent } from '../../utils/contentManager.js'
import { analyzeSiteReadiness } from '../../utils/siteReadiness.js'
import { useLanguage } from '../../i18n/useLanguage.js'

const TABS = [
  ['readiness', 'Readiness'],
  ['inbox', 'Inbox'],
  ['analytics', 'Analytics'],
  ['content', 'Content'],
  ['feedback', 'Feedback'],
  ['domain', 'Domain'],
]

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-[#d1d5db] px-5 py-10 text-center text-sm text-[#6b7280]">{children}</div>
}

export default function SiteControlCenter({
  open,
  onClose,
  site,
  schema,
  pageHtmlMap,
  onSitePatch,
  onHtmlContentChange,
  onSchemaContentChange,
}) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('readiness')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [comments, setComments] = useState([])
  const [domainSetup, setDomainSetup] = useState(null)
  const [domain, setDomain] = useState(site.custom_domain || '')
  const [copied, setCopied] = useState('')
  const [seo, setSeo] = useState({
    title: '', description: '', socialImage: '', favicon: '',
    ...(site.site_options?.seo || {}),
  })

  useEffect(() => {
    if (!open || !site.id || !['inbox', 'analytics', 'feedback', 'domain'].includes(tab)) return
    let active = true
    const request = tab === 'inbox'
      ? listSiteSubmissions(site.id)
      : tab === 'analytics'
        ? getSiteAnalytics(site.id)
        : tab === 'feedback'
          ? listSiteComments(site.id)
          : getDomainSetup(site.id)
    request.then((data) => {
      if (!active) return
      if (tab === 'inbox') setSubmissions(data)
      if (tab === 'analytics') setAnalytics(data)
      if (tab === 'feedback') setComments(data)
      if (tab === 'domain') { setDomainSetup(data); setDomain(data.domain || '') }
    }).catch((err) => active && setError(apiError(err))).finally(() => active && setBusy(false))
    return () => { active = false }
  }, [open, site.id, tab])

  const readiness = useMemo(() => analyzeSiteReadiness({
    title: site.title,
    pages: schema.pages || [],
    pageHtmlMap,
    siteOptions: { ...(site.site_options || {}), seo },
  }), [pageHtmlMap, schema.pages, seo, site.site_options, site.title])
  const contentEntries = useMemo(() => extractSiteContent(schema, pageHtmlMap), [schema, pageHtmlMap])
  const reviewUrl = site.review_token ? `${window.location.origin}/review/${site.review_token}` : ''

  if (!open) return null

  async function saveSeo() {
    setBusy(true); setError('')
    try {
      const data = await patchSite(site.id, { site_options: { ...(site.site_options || {}), seo } })
      onSitePatch(data)
    } catch (err) { setError(apiError(err)) } finally { setBusy(false) }
  }

  async function copy(value, key) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    } catch { setError(t('Could not copy the link.')) }
  }

  async function markSubmission(row, isRead = true) {
    const next = await updateSiteSubmission(site.id, row.id, isRead)
    setSubmissions((items) => items.map((item) => item.id === next.id ? next : item))
  }

  async function removeSubmission(row) {
    await deleteSiteSubmission(site.id, row.id)
    setSubmissions((items) => items.filter((item) => item.id !== row.id))
  }

  async function toggleComment(row) {
    const next = await resolveSiteComment(site.id, row.id, !row.resolved)
    setComments((items) => items.map((item) => item.id === next.id ? next : item))
  }

  async function resetReviewLink() {
    if (!window.confirm(t('Create a new review link? The previous link will stop working.'))) return
    const data = await regenerateReviewLink(site.id)
    onSitePatch({ ...site, review_token: data.review_token })
  }

  async function saveDomain() {
    setBusy(true); setError('')
    try {
      const data = await configureDomain(site.id, domain)
      setDomainSetup(data)
      onSitePatch({ ...site, custom_domain: data.domain, domain_status: data.status })
    } catch (err) { setError(apiError(err)) } finally { setBusy(false) }
  }

  function editContent(entry, value) {
    if (entry.source === 'html') {
      const page = schema.pages.find((item) => item.id === entry.pageId)
      const html = pageHtmlMap[entry.pageId] ?? page?.html ?? ''
      onHtmlContentChange(entry.pageId, updateHtmlContent(html, entry, value))
    } else {
      onSchemaContentChange(updateSchemaContent(schema, entry, value))
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-0 md:p-5" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={t('Site control center')} className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[#f8fafc] shadow-2xl md:h-[90vh] md:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-[#e5e7eb] bg-white px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-[#111827]">{t('Site control center')}</h2>
            <p className="truncate text-xs text-[#6b7280]">{site.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Close')} className="grid h-10 w-10 place-items-center rounded-full bg-[#f3f4f6] text-xl">×</button>
        </header>
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e5e7eb] bg-white px-3 py-2 md:px-6" aria-label={t('Site tools')}>
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setBusy(['inbox', 'analytics', 'feedback', 'domain'].includes(id)); setError(''); setTab(id) }} aria-pressed={tab === id} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${tab === id ? 'bg-[#4f46e5] text-white' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}`}>{t(label)}</button>
          ))}
        </nav>
        {error && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">{error}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {busy && <div role="status" className="mb-4 text-sm text-[#6b7280]">{t('Loading…')}</div>}

          {tab === 'readiness' && (
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="rounded-3xl bg-[#111827] p-6 text-white">
                <div className="text-sm text-white/65">{t('Site health score')}</div>
                <div className="mt-2 text-6xl font-black">{readiness.score}</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-emerald-400" style={{ width: `${readiness.score}%` }} /></div>
                <p className="mt-4 text-sm leading-6 text-white/70">{readiness.score >= 80 ? t('Your site is close to launch-ready.') : t('Complete the checks before publishing.')}</p>
              </div>
              <div className="space-y-2">
                {readiness.checks.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.ok ? '✓' : '!'}</span>
                    <div><div className="text-sm font-semibold text-[#111827]">{t(item.label)}</div>{!item.ok && <div className="mt-0.5 text-xs text-[#6b7280]">{t(item.action, item.params)}</div>}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-4 rounded-3xl border border-[#e5e7eb] bg-white p-5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-[#111827]">{t('Search and sharing')}</h3><button type="button" onClick={() => setSeo((value) => ({ ...value, title: `${site.title} | Official Site`.slice(0, 60), description: `${site.title} presents its work, services and latest updates. Explore the site and get in touch for more information.`.slice(0, 160) }))} className="rounded-xl border border-[#c7d2fe] px-3 py-2 text-xs font-semibold text-[#4f46e5]">{t('Suggest SEO text')}</button></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-[#374151]">{t('SEO title')}<input className="ms-input mt-1" value={seo.title} maxLength={60} onChange={(e) => setSeo({ ...seo, title: e.target.value })} /></label>
                  <label className="text-sm font-medium text-[#374151]">{t('Social image URL')}<input className="ms-input mt-1" value={seo.socialImage} onChange={(e) => setSeo({ ...seo, socialImage: e.target.value })} /></label>
                  <label className="text-sm font-medium text-[#374151] md:col-span-2">{t('SEO description')}<textarea className="ms-input mt-1 min-h-24" value={seo.description} maxLength={160} onChange={(e) => setSeo({ ...seo, description: e.target.value })} /></label>
                  <label className="text-sm font-medium text-[#374151]">{t('Favicon URL')}<input className="ms-input mt-1" value={seo.favicon} onChange={(e) => setSeo({ ...seo, favicon: e.target.value })} /></label>
                </div>
                <button type="button" disabled={busy} onClick={saveSeo} className="ms-btn ms-btn-primary px-5 py-2.5">{t('Save SEO settings')}</button>
              </div>
            </div>
          )}

          {tab === 'inbox' && (
            <div className="space-y-3">
              {!submissions.length ? <EmptyState>{t('No form submissions yet.')}</EmptyState> : submissions.map((row) => (
                <article key={row.id} className={`rounded-2xl border p-4 ${row.is_read ? 'border-[#e5e7eb] bg-white' : 'border-[#a5b4fc] bg-[#eef2ff]'}`}>
                  <div className="flex items-center justify-between gap-3"><div className="text-xs font-semibold text-[#6b7280]">{row.page || t('Site form')} · {new Date(row.created_at).toLocaleString()}</div><div className="flex gap-2"><button type="button" onClick={() => markSubmission(row, !row.is_read)} className="text-xs font-semibold text-[#4f46e5]">{t(row.is_read ? 'Mark unread' : 'Mark read')}</button><button type="button" onClick={() => removeSubmission(row)} className="text-xs font-semibold text-red-600">{t('Delete')}</button></div></div>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(row.data || {}).map(([key, value]) => <div key={key} className="rounded-xl bg-white/80 p-3"><dt className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{key}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-[#374151]">{String(value)}</dd></div>)}</dl>
                </article>
              ))}
            </div>
          )}

          {tab === 'analytics' && (
            analytics ? <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl bg-[#111827] p-6 text-white"><div className="text-sm text-white/60">{t('Total views')}</div><div className="mt-2 text-4xl font-black">{analytics.total_views}</div></div><div className="rounded-3xl bg-[#4f46e5] p-6 text-white"><div className="text-sm text-white/70">{t('Last 30 days')}</div><div className="mt-2 text-4xl font-black">{analytics.last_30_days}</div></div></div>
              <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5"><h3 className="font-bold">{t('Daily visits')}</h3><div className="mt-4 flex h-44 items-end gap-1">{(analytics.daily || []).map((day) => { const max = Math.max(...analytics.daily.map((item) => item.views), 1); return <div key={day.day} title={`${day.day}: ${day.views}`} className="min-w-2 flex-1 rounded-t bg-[#818cf8]" style={{ height: `${Math.max(8, day.views / max * 100)}%` }} /> })}</div></div>
              <div className="grid gap-5 md:grid-cols-2"><div className="rounded-3xl border border-[#e5e7eb] bg-white p-5"><h3 className="font-bold">{t('Devices')}</h3><div className="mt-3 space-y-2">{(analytics.devices || []).map((item) => <div key={item.device} className="flex justify-between text-sm"><span>{t(item.device.charAt(0).toUpperCase() + item.device.slice(1))}</span><strong>{item.views}</strong></div>)}</div></div><div className="rounded-3xl border border-[#e5e7eb] bg-white p-5"><h3 className="font-bold">{t('Top referrers')}</h3><div className="mt-3 space-y-2">{(analytics.referrers || []).map((item) => <div key={item.referrer} className="flex justify-between gap-3 text-sm"><span className="truncate">{item.referrer}</span><strong>{item.views}</strong></div>)}</div></div></div>
            </div> : <EmptyState>{t('Analytics will appear after the first public visit.')}</EmptyState>
          )}

          {tab === 'content' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#eef2ff] p-4 text-sm text-[#3730a3]">{t('Edit text and image descriptions without opening the design canvas. Changes remain undoable and are saved with the site.')}</div>
              {!contentEntries.length ? <EmptyState>{t('No editable content found.')}</EmptyState> : contentEntries.map((entry) => (
                <label key={entry.id} className="block rounded-2xl border border-[#e5e7eb] bg-white p-4"><span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[#6b7280]"><span>{entry.pageName}</span><span>{entry.label}</span></span>{entry.value.length > 90 ? <textarea className="ms-input min-h-24" defaultValue={entry.value} onBlur={(e) => editContent(entry, e.target.value)} /> : <input className="ms-input" defaultValue={entry.value} onBlur={(e) => editContent(entry, e.target.value)} />}</label>
              ))}
            </div>
          )}

          {tab === 'feedback' && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5"><h3 className="font-bold">{t('Client review link')}</h3><p className="mt-1 text-sm text-[#6b7280]">{t('Anyone with this private link can preview the draft and leave comments.')}</p><div className="mt-4 flex gap-2"><input readOnly value={reviewUrl} className="ms-input min-w-0 flex-1" /><button type="button" onClick={() => copy(reviewUrl, 'review')} className="ms-btn ms-btn-primary shrink-0 px-4">{t(copied === 'review' ? 'Copied' : 'Copy')}</button></div><button type="button" onClick={resetReviewLink} className="mt-3 text-xs font-semibold text-red-600">{t('Replace review link')}</button></div>
              {!comments.length ? <EmptyState>{t('No client comments yet.')}</EmptyState> : comments.map((row) => <article key={row.id} className={`rounded-2xl border bg-white p-4 ${row.resolved ? 'opacity-60' : ''}`}><div className="flex justify-between gap-3"><div><strong className="text-sm">{row.author_name}</strong><div className="text-xs text-[#9ca3af]">{row.author_email} · {row.page_id || t('General')}</div></div><button type="button" onClick={() => toggleComment(row)} className="text-xs font-semibold text-[#4f46e5]">{t(row.resolved ? 'Reopen' : 'Resolve')}</button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#374151]">{row.body}</p></article>)}
            </div>
          )}

          {tab === 'domain' && (
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5"><h3 className="font-bold">{t('Connect a custom domain')}</h3><p className="mt-1 text-sm text-[#6b7280]">{t('Enter the domain without http:// or a path.')}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.example.com" className="ms-input flex-1" /><button type="button" disabled={busy} onClick={saveDomain} className="ms-btn ms-btn-primary px-5">{t(domain ? 'Save domain' : 'Disconnect domain')}</button></div></div>
              {domainSetup?.domain && <div className="rounded-3xl border border-[#e5e7eb] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-bold">{t('DNS records')}</h3><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{t(domainSetup.status === 'connected' ? 'Connected' : 'Waiting for DNS')}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-[#9ca3af]"><tr><th className="py-2">{t('Type')}</th><th>{t('Name')}</th><th>{t('Value')}</th></tr></thead><tbody>{domainSetup.records.map((record) => <tr key={`${record.type}-${record.name}`} className="border-t border-[#e5e7eb]"><td className="py-3 font-bold">{record.type}</td><td>{record.name}</td><td className="font-mono text-xs">{record.value}</td></tr>)}</tbody></table></div><div className="mt-4 rounded-xl bg-[#f3f4f6] p-3 text-xs text-[#4b5563]">{t('SSL will be provisioned automatically after DNS ownership is verified by the hosting provider.')}</div></div>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
