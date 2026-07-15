import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditIcon, EyeIcon, GlobeIcon, LayersIcon } from '../icons.jsx'
import LanguageSwitcher from '../LanguageSwitcher.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import { HTML_ALLOW, PUBLIC_HTML_SANDBOX, withBuilderInteractiveHtml, withViewportMeta } from '../../utils/htmlRuntime.js'
import { schemaToSingleHtml } from '../../utils/schemaToFiles.js'

function htmlForPage(page, pages, pageHtmlMap) {
  const live = pageHtmlMap?.[page?.id]
  if (typeof live === 'string') return live
  if (typeof page?.html === 'string') return page.html
  return pages[0]?.id === page?.id ? pageHtmlMap?.[pages[0]?.id] || '' : ''
}

export default function MobileEditorPreview({
  title,
  slug,
  published,
  pages,
  currentPageId,
  pageHtmlMap,
  theme,
  customCss,
  customJs,
  error,
  onSelectPage,
  onBack,
}) {
  const { t } = useLanguage()
  const [sheet, setSheet] = useState(null)
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState(false)
  const currentPage = useMemo(
    () => pages.find((page) => page.id === currentPageId) || pages[0] || {},
    [currentPageId, pages],
  )
  const currentHtml = htmlForPage(currentPage, pages, pageHtmlMap)
  const currentIsHtml = currentPage.mode === 'html' || !!currentHtml.trim()

  const previewHtml = useMemo(() => {
    if (currentIsHtml) return withViewportMeta(withBuilderInteractiveHtml(currentHtml))
    return withViewportMeta(schemaToSingleHtml({
      theme,
      customCss,
      customJs,
      pages: [currentPage],
    }, title || currentPage.name || 'My Site'))
  }, [currentHtml, currentIsHtml, currentPage, customCss, customJs, theme, title])

  async function copyEditorLink() {
    try {
      await navigator.clipboard?.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const frame = (
    <iframe
      key={`${currentPage.id || 'page'}-${currentIsHtml ? 'html' : 'components'}`}
      title={t('Previewing {page}', { page: currentPage.name || title || t('Preview') })}
      srcDoc={previewHtml}
      sandbox={PUBLIC_HTML_SANDBOX}
      allow={HTML_ALLOW}
      allowFullScreen
      className="block h-full w-full border-0 bg-white"
    />
  )

  if (focused) {
    return (
      <main className="relative h-[100dvh] overflow-hidden bg-white" aria-label={t('Mobile site preview')} data-testid="mobile-editor-preview">
        {frame}
        <button
          type="button"
          onClick={() => setFocused(false)}
          aria-label={t('Exit focused preview')}
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/90 text-lg font-bold text-[#111827] shadow-lg backdrop-blur"
        >
          ×
        </button>
      </main>
    )
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#f3f4f6]" aria-label={t('Mobile site preview')} data-testid="mobile-editor-preview">
      <header className="shrink-0 border-b border-[#e5e7eb] bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="flex h-14 items-center gap-2 px-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('Go back')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl text-[#374151] hover:bg-[#f3f4f6]"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#111827]">{title || t('Untitled site')}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
              <span className={`h-1.5 w-1.5 rounded-full ${published ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
              <span>{t(published ? 'Published' : 'Draft')}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{currentPage.name || t('Preview')}</span>
            </div>
          </div>
          <LanguageSwitcher className="[&_span[aria-hidden]]:hidden" />
        </div>
      </header>

      {error && <div role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}

      <section className="relative min-h-0 flex-1 bg-white" aria-label={t('Preview')}>
        {frame}
      </section>

      <nav className="shrink-0 border-t border-[#e5e7eb] bg-white pb-[env(safe-area-inset-bottom)]" aria-label={t('Mobile preview navigation')}>
        <div className="grid h-16 grid-cols-4">
          <button type="button" onClick={() => setFocused(true)} aria-label={t('Focus preview')} className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[#4f46e5]">
            <EyeIcon size={19} aria-hidden />
            <span>{t('Preview')}</span>
          </button>
          <button type="button" onClick={() => setSheet('pages')} className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-[#4b5563]">
            <LayersIcon size={19} aria-hidden />
            <span>{t('Pages')}</span>
          </button>
          {published && slug ? (
            <Link to={`/site/${slug}`} target="_blank" rel="noreferrer" aria-label={t('Open live site')} className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-[#4b5563]">
              <GlobeIcon size={19} aria-hidden />
              <span>{t('Live')}</span>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-[#9ca3af]" aria-label={t('Draft')}>
              <GlobeIcon size={19} aria-hidden />
              <span>{t('Draft')}</span>
            </div>
          )}
          <button type="button" onClick={() => setSheet('desktop')} className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-[#4b5563]">
            <EditIcon size={19} aria-hidden />
            <span className="truncate">{t('Desktop')}</span>
          </button>
        </div>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/40" onClick={() => setSheet(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`mobile-${sheet}-sheet-title`}
            className="max-h-[75dvh] w-full overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#d1d5db]" aria-hidden />
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
              <h2 id={`mobile-${sheet}-sheet-title`} className="text-base font-semibold text-[#111827]">{t(sheet === 'pages' ? 'Site pages' : 'Desktop editing')}</h2>
              <button type="button" onClick={() => setSheet(null)} className="grid h-9 w-9 place-items-center rounded-full bg-[#f3f4f6] text-lg" aria-label={t('Close')}>×</button>
            </div>
            {sheet === 'pages' ? (
              <div className="max-h-[55dvh] overflow-y-auto p-3">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    aria-label={page.name || `${t('Pages')} ${index + 1}`}
                    onClick={() => { onSelectPage(page.id); setSheet(null) }}
                    aria-current={page.id === currentPage.id ? 'page' : undefined}
                    className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${page.id === currentPage.id ? 'bg-[#eef2ff] text-[#3730a3]' : 'text-[#374151] hover:bg-[#f9fafb]'}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold shadow-sm">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{page.name || `${t('Pages')} ${index + 1}`}</span>
                    {page.id === currentPage.id && <span className="text-[#4f46e5]" aria-hidden>✓</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]"><EditIcon size={23} aria-hidden /></div>
                <p className="text-sm leading-6 text-[#4b5563]">{t('Mobile keeps the site preview-first. Open this link on a desktop computer to make changes.')}</p>
                <button type="button" onClick={copyEditorLink} className="w-full rounded-xl bg-[#4f46e5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4338ca]">
                  {t(copied ? 'Editor link copied' : 'Copy editor link')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
