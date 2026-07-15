import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getReviewSite, submitReviewComment } from '../api/sites.js'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { useLanguage } from '../i18n/useLanguage.js'
import { apiError } from '../utils/errors.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX, withBuilderInteractiveHtml, withViewportMeta } from '../utils/htmlRuntime.js'
import { schemaToSingleHtml } from '../utils/schemaToFiles.js'

export default function ReviewPage() {
  const { token } = useParams()
  const { t } = useLanguage()
  const [payload, setPayload] = useState(null)
  const [activeId, setActiveId] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ author_name: '', author_email: '', body: '' })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getReviewSite(token).then((data) => {
      setPayload(data)
      setActiveId(data.site?.schema?.pages?.[0]?.id || '')
      setStatus('ok')
    }).catch(() => setStatus('error'))
  }, [token])

  const site = payload?.site
  const pages = useMemo(() => site?.schema?.pages || [], [site?.schema?.pages])
  const page = useMemo(
    () => pages.find((item) => item.id === activeId) || pages[0] || {},
    [activeId, pages],
  )
  const html = page.html || (page.id === pages[0]?.id ? site?.html || '' : '')
  const isHtml = page.mode === 'html' || !!html.trim()
  const previewHtml = useMemo(() => {
    if (!site) return ''
    if (isHtml) return withViewportMeta(withBuilderInteractiveHtml(html))
    return withViewportMeta(schemaToSingleHtml({
      theme: site.schema?.theme,
      customCss: site.schema?.customCss,
      customJs: site.schema?.customJs,
      pages: [page],
    }, site.title || page.name || 'Site'))
  }, [html, isHtml, page, site])

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type !== 'pwb-navigate') return
      const id = decodeURIComponent(String(event.data.hash || '').replace(/^#/, ''))
      if (pages.some((item) => item.id === id)) setActiveId(id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [pages])

  async function submit(event) {
    event.preventDefault()
    setSending(true); setError('')
    try {
      const row = await submitReviewComment(token, { ...form, page_id: page.id || '' })
      setPayload((value) => ({ ...value, comments: [row, ...(value.comments || [])] }))
      setForm((value) => ({ ...value, body: '' }))
    } catch (err) { setError(apiError(err)) } finally { setSending(false) }
  }

  if (status === 'loading') return <div className="grid min-h-screen place-items-center text-sm text-[#6b7280]">{t('Loading…')}</div>
  if (status === 'error') return <div className="grid min-h-screen place-items-center bg-[#f8fafc] p-6 text-center"><div><h1 className="text-xl font-bold">{t('Review link not available')}</h1><p className="mt-2 text-sm text-[#6b7280]">{t('Ask the site owner for a new review link.')}</p></div></div>

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#e5e7eb] lg:flex-row">
      <section className="relative min-h-0 flex-1 bg-white" aria-label={t('Site preview')}>
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-black/5 bg-white/90 px-3 py-2 backdrop-blur">
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{site.title}</div><div className="text-[11px] text-amber-700">{t('Private client review')}</div></div>
          {pages.length > 1 && <select value={page.id || ''} onChange={(event) => setActiveId(event.target.value)} aria-label={t('Pages')} className="max-w-32 rounded-lg border border-[#d1d5db] px-2 py-1 text-xs">{pages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
          <LanguageSwitcher />
        </div>
        <iframe key={page.id} title={t('Previewing {page}', { page: page.name || site.title })} srcDoc={previewHtml} sandbox={PUBLIC_HTML_SANDBOX} allow={HTML_ALLOW} allowFullScreen className="h-full w-full border-0 pt-14" />
      </section>
      <aside className="flex h-[46dvh] shrink-0 flex-col border-t border-[#d1d5db] bg-[#f8fafc] lg:h-full lg:w-[380px] lg:border-l lg:border-t-0">
        <div className="border-b border-[#e5e7eb] bg-white px-5 py-4"><h1 className="font-bold text-[#111827]">{t('Client feedback')}</h1><p className="mt-1 text-xs text-[#6b7280]">{t('Comments are attached to the page currently shown.')}</p></div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!(payload.comments || []).length && <p className="rounded-xl border border-dashed border-[#d1d5db] p-5 text-center text-sm text-[#6b7280]">{t('No comments yet.')}</p>}
          {(payload.comments || []).map((comment) => <article key={comment.id} className={`rounded-2xl border border-[#e5e7eb] bg-white p-3 ${comment.resolved ? 'opacity-55' : ''}`}><div className="flex justify-between gap-2"><strong className="text-sm">{comment.author_name}</strong>{comment.resolved && <span className="text-[10px] font-bold uppercase text-emerald-700">{t('Resolved')}</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-[#4b5563]">{comment.body}</p><div className="mt-2 text-[10px] text-[#9ca3af]">{pages.find((item) => item.id === comment.page_id)?.name || t('General')}</div></article>)}
        </div>
        <form onSubmit={submit} className="space-y-2 border-t border-[#e5e7eb] bg-white p-4">
          {error && <div role="alert" className="text-xs text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-2"><input required maxLength={80} value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} placeholder={t('Your name')} aria-label={t('Your name')} className="ms-input" /><input type="email" value={form.author_email} onChange={(e) => setForm({ ...form, author_email: e.target.value })} placeholder={t('Email (optional)')} aria-label={t('Email (optional)')} className="ms-input" /></div>
          <textarea required minLength={2} maxLength={1200} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t('Write a comment…')} aria-label={t('Write a comment…')} className="ms-input min-h-20" />
          <button type="submit" disabled={sending} className="ms-btn ms-btn-primary w-full py-2.5">{sending ? t('Sending…') : t('Send comment')}</button>
        </form>
      </aside>
    </main>
  )
}
