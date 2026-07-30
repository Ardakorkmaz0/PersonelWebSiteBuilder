import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { inlineProjectHtml, minifyGeneratedHtml } from '../../utils/exportFiles.js'
import { schemaToFiles, schemaToSingleHtml } from '../../utils/schemaToFiles.js'
import { schemaToResponsiveHtml } from '../../utils/responsiveHtml.js'
import { appendSnippet, cssSnippets, groupSnippets, jsSnippets } from '../../utils/snippets.js'
import { zipFiles } from '../../utils/zip.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import {
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  FileCodeIcon,
  FileIcon,
  FolderIcon,
} from '../icons.jsx'

function pageToResponsiveHtml(page, title, schema = {}) {
  const pageSchema = { ...schema, pages: [page] }
  return page?.flowMode
    ? schemaToSingleHtml(pageSchema, title)
    : schemaToResponsiveHtml(pageSchema, title)
}

const ICON = { html: 'HTML', css: 'CSS', js: 'JS', json: '{ }' }
const MIME = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
}
const CSS_SNIPPET_GROUPS = groupSnippets(cssSnippets)
const JS_SNIPPET_GROUPS = groupSnippets(jsSnippets)

function slugName(value) {
  return (
    String(value || 'site')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'site'
  )
}

function saveAs(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function SnippetSelect({ groups, snippets, onPick }) {
  const { t } = useLanguage()
  return (
    <select
      aria-label={t('Insert snippet')}
      value=""
      onChange={(event) => {
        const snippet = snippets.find((item) => item.id === event.target.value)
        if (snippet) onPick(snippet)
      }}
      className="studio-input max-w-[230px] px-2 py-1.5 text-xs"
    >
      <option value="">{t('Insert snippet…')}</option>
      {groups.map((group) => (
        <optgroup key={group.category} label={t(group.category)}>
          {group.items.map((snippet) => (
            <option key={snippet.id} value={snippet.id}>
              {t(snippet.name)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function CodePanel({ currentPageId, onApplyHtml, onDraftDirtyChange }, ref) {
  const { t } = useLanguage()
  const schema = useEditorStore((state) => state.schema)
  const setCustomCss = useEditorStore((state) => state.setCustomCss)
  const setCustomJs = useEditorStore((state) => state.setCustomJs)
  const rawGeneratedFiles = useMemo(() => schemaToFiles(schema), [schema])
  const [htmlDrafts, setHtmlDrafts] = useState({})
  const generatedFiles = useMemo(() => {
    let pageIndex = 0
    return rawGeneratedFiles.map((item) => {
      if (item.lang === 'html') {
        const page = schema?.pages?.[pageIndex++]
        const hasDraft = Object.prototype.hasOwnProperty.call(htmlDrafts, item.name)
        return {
          ...item,
          pageId: page?.id,
          editable: true,
          editableKind: 'html',
          generatedContent: item.content,
          content: hasDraft ? htmlDrafts[item.name] : item.content,
        }
      }
      if (item.name === 'custom.css') return {
        ...item,
        content: schema.customCss || '',
        editable: true,
        editableKind: 'css',
        description: 'Custom CSS',
      }
      if (item.name === 'custom.js') return {
        ...item,
        content: schema.customJs || '',
        editable: true,
        editableKind: 'js',
        description: 'Custom JavaScript',
      }
      return item
    })
  }, [htmlDrafts, rawGeneratedFiles, schema.customCss, schema.customJs, schema.pages])
  const base = slugName(schema?.pages?.[0]?.name)
  const exportPreviewFiles = useMemo(() => {
    const page = schema?.pages?.[0] || {}
    const standalone = pageToResponsiveHtml(page, page?.name || 'My Site', schema)
    return [
      {
        name: `${base}.single.html`,
        lang: 'html',
        content: standalone,
        exportPreview: true,
      },
      {
        name: `${base}.optimized.min.html`,
        lang: 'html',
        content: minifyGeneratedHtml(standalone),
        exportPreview: true,
      },
    ]
  }, [base, schema])
  const files = [...generatedFiles, ...exportPreviewFiles]
  const [activeSelection, setActiveSelection] = useState({
    pageId: currentPageId,
    name: null,
  })
  const [copied, setCopied] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)

  const htmlFiles = generatedFiles.filter((item) => item.lang === 'html')
  const projectFiles = generatedFiles.filter((item) => item.lang !== 'html' && !item.editable)
  const customFiles = files.filter((item) => ['css', 'js'].includes(item.editableKind))
  const currentPageFileName = generatedFiles.find((item) => item.pageId === currentPageId)?.name
  const active = activeSelection.pageId === currentPageId
    ? activeSelection.name || currentPageFileName || 'index.html'
    : currentPageFileName || 'index.html'
  const selectFile = (name) => setActiveSelection({ pageId: currentPageId, name })
  const file = files.find((item) => item.name === active) || files[0]
  const lines = file?.content ? file.content.split('\n').length : 1
  const dirtyHtmlFiles = generatedFiles.filter((item) => (
    item.editableKind === 'html' && item.content !== item.generatedContent
  ))
  useEffect(() => {
    onDraftDirtyChange?.(dirtyHtmlFiles.length > 0)
    return () => onDraftDirtyChange?.(false)
  }, [dirtyHtmlFiles.length, onDraftDirtyChange])

  useEffect(() => {
    if (!exportMenuOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!exportMenuRef.current?.contains(event.target)) setExportMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [exportMenuOpen])

  const applyPendingHtml = useCallback((nextMode = 'source') => {
    if (!onApplyHtml || dirtyHtmlFiles.length === 0) return 0
    for (const item of dirtyHtmlFiles) {
      onApplyHtml({
        pageId: item.pageId,
        html: inlineProjectHtml(item.content, rawGeneratedFiles),
        nextMode,
      })
    }
    setHtmlDrafts({})
    return dirtyHtmlFiles.length
  }, [dirtyHtmlFiles, onApplyHtml, rawGeneratedFiles])

  useImperativeHandle(ref, () => ({
    applyPendingHtml,
    hasPendingHtml: () => dirtyHtmlFiles.length > 0,
  }), [applyPendingHtml, dirtyHtmlFiles.length])

  const FileButton = ({ item, indent = false }) => (
    <button
      type="button"
      onClick={() => selectFile(item.name)}
      className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
        file?.name === item.name
          ? 'bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]'
          : 'text-[var(--studio-text-muted)] hover:bg-[var(--studio-control-hover)] hover:text-[var(--studio-text)]'
      } ${indent ? 'pl-5' : ''}`}
    >
      <span className={`grid h-6 w-8 shrink-0 place-items-center rounded-md font-mono text-[9px] font-bold ${
        file?.name === item.name
          ? 'bg-[var(--studio-panel-raised)] text-[var(--studio-accent-hover)]'
          : 'bg-[var(--studio-control)] text-[var(--studio-text-faint)]'
      }`}>
        {ICON[item.lang] || 'FILE'}
      </span>
      <span className="min-w-0 truncate font-medium">{item.name}</span>
      {item.editable && (
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--studio-success)]" />
      )}
    </button>
  )

  function copy() {
    if (!file || !navigator.clipboard?.writeText) return
    navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  function downloadCleanProject() {
    setExportMenuOpen(false)
    const htmlByName = new Map(htmlFiles.map((item) => [item.name, item.content]))
    const output = rawGeneratedFiles.map((item) => (
      item.lang === 'html' && htmlByName.has(item.name)
        ? { ...item, content: htmlByName.get(item.name) }
        : item
    ))
    saveAs(`${base}-project.zip`, zipFiles(output))
  }

  function downloadSingleHtml() {
    setExportMenuOpen(false)
    saveAs(
      `${base}.html`,
      pageToResponsiveHtml(
        schema?.pages?.[0] || {},
        schema?.pages?.[0]?.name || 'My Site',
        schema,
      ),
      'text/html',
    )
  }

  function downloadOptimizedHtml() {
    setExportMenuOpen(false)
    const pages = schema?.pages || []
    const used = new Set()
    const output = pages.map((page, index) => {
      const baseName = index === 0 ? 'index' : slugName(page.name)
      let name = `${baseName}.html`
      let suffix = 2
      while (used.has(name)) name = `${baseName}-${suffix++}.html`
      used.add(name)
      return {
        name,
        content: minifyGeneratedHtml(pageToResponsiveHtml(page, page.name || 'My Site', schema)),
      }
    })
    if (output.length <= 1) {
      saveAs(`${base}.min.html`, output[0]?.content || '', 'text/html')
      return
    }
    saveAs(`${base}-optimized.zip`, zipFiles(output))
  }

  function downloadCurrentFile() {
    if (file) saveAs(file.name, file.content, MIME[file.lang] || 'text/plain')
  }

  function updateFile(value) {
    if (file?.editableKind === 'html') {
      setHtmlDrafts((drafts) => ({ ...drafts, [file.name]: value }))
    }
    if (file?.editableKind === 'css') setCustomCss(value)
    if (file?.editableKind === 'js') setCustomJs(value)
  }

  function applyCurrentHtml() {
    if (!onApplyHtml || file?.editableKind !== 'html') return
    onApplyHtml({
      pageId: file.pageId,
      html: inlineProjectHtml(file.content, rawGeneratedFiles),
      nextMode: 'source',
    })
    setHtmlDrafts((drafts) => {
      const next = { ...drafts }
      delete next[file.name]
      return next
    })
  }

  const snippetConfig = file?.name === 'custom.css'
    ? { groups: CSS_SNIPPET_GROUPS, snippets: cssSnippets, language: 'css' }
    : file?.name === 'custom.js'
      ? { groups: JS_SNIPPET_GROUPS, snippets: jsSnippets, language: 'js' }
      : null

  return (
    <div className="studio-panel flex h-full min-h-0 flex-col bg-[var(--studio-panel)]">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--studio-border)] px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]">
          <CodeIcon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--studio-text)]">{t('Source workspace')}</h2>
          <p className="truncate text-xs text-[var(--studio-text-muted)]">
            {t('HTML, custom CSS and JavaScript are editable. Shared assets are generated read-only.')}
          </p>
        </div>
        <div ref={exportMenuRef} className="relative ml-auto">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            onClick={() => setExportMenuOpen((open) => !open)}
            className="studio-btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
          >
            {t('Export')}
            <ChevronDownIcon
              size={13}
              className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              aria-label={t('Choose an export format')}
              className="absolute right-0 top-[calc(100%+8px)] z-40 w-[370px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-2 shadow-2xl"
            >
              <div className="px-2 pb-2 pt-1">
                <p className="text-xs font-semibold text-[var(--studio-text)]">
                  {t('What do you want to download?')}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--studio-text-muted)]">
                  {t('Choose by how you plan to use the site.')}
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={downloadSingleHtml}
                className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[var(--studio-control-hover)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--studio-control)] text-[var(--studio-text-muted)]">
                  <FileIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--studio-text)]">
                    {t('Single website file')}
                    <span className="rounded-full bg-[var(--studio-control)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--studio-success)]">
                      {t('Recommended')}
                    </span>
                    <span className="ml-auto font-mono text-[10px] font-medium text-[var(--studio-text-faint)]">.html</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
                    {t('Everything in one file. Best for previewing, sharing or simple hosting.')}
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={downloadCleanProject}
                className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[var(--studio-control-hover)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--studio-control)] text-[var(--studio-text-muted)]">
                  <FolderIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-semibold text-[var(--studio-text)]">
                    {t('Editable code project')}
                    <span className="ml-auto font-mono text-[10px] font-medium text-[var(--studio-text-faint)]">.zip</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
                    {t('Separate HTML, CSS and JavaScript files. Best for developers.')}
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={downloadOptimizedHtml}
                className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[var(--studio-control-hover)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--studio-control)] text-[var(--studio-text-muted)]">
                  <FileCodeIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-semibold text-[var(--studio-text)]">
                    {t('Optimized publication')}
                    <span className="ml-auto font-mono text-[10px] font-medium text-[var(--studio-text-faint)]">.html / .zip</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--studio-text-muted)]">
                    {t('Smaller files for publishing. Harder to read and edit afterward.')}
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-[var(--studio-border)] bg-[var(--studio-control)]/50 p-3 sm:block">
          <div className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold text-[var(--studio-text)]">
            <FolderIcon size={14} />
            <span className="truncate">{base}</span>
          </div>

          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--studio-text-faint)]">
            {t('Pages')}
          </p>
          <div className="space-y-0.5">
            {htmlFiles.map((item) => <FileButton key={item.name} item={item} indent />)}
          </div>

          <p className="mb-1.5 mt-4 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--studio-text-faint)]">
            {t('Generated')}
          </p>
          <div className="space-y-0.5">
            {projectFiles.map((item) => <FileButton key={item.name} item={item} />)}
          </div>

          <p className="mb-1.5 mt-4 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--studio-text-faint)]">
            {t('Custom code')}
          </p>
          <div className="space-y-0.5">
            {customFiles.map((item) => <FileButton key={item.name} item={item} />)}
          </div>

          <p className="mb-1.5 mt-4 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--studio-text-faint)]">
            {t('Export previews')}
          </p>
          <div className="space-y-0.5">
            {exportPreviewFiles.map((item) => <FileButton key={item.name} item={item} />)}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel-raised)] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--studio-text)]">
              <CheckIcon size={13} className="text-[var(--studio-success)]" />
              {t('Included in exports')}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--studio-text-muted)]">
              {t('Code project keeps HTML, CSS and runtime separate. Single website file embeds them.')}
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[#0d1117]">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#151a23] px-3 py-2">
            <select
              aria-label={t('Source file')}
              value={file?.name || ''}
              onChange={(event) => selectFile(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#202631] px-2 py-1.5 font-mono text-xs text-gray-200 outline-none sm:hidden"
            >
              {files.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            <div className="hidden min-w-0 items-center gap-2 text-gray-200 sm:flex">
              <FileCodeIcon size={14} />
              <span className="truncate font-mono text-xs">{file?.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                file?.editable ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-gray-400'
              }`}>
                {t(
                  file?.editableKind === 'html'
                    ? 'Editable HTML'
                    : file?.editable
                      ? 'Editable'
                      : file?.exportPreview
                        ? 'Export preview'
                        : 'Generated read-only',
                )}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {snippetConfig && (
                <SnippetSelect
                  groups={snippetConfig.groups}
                  snippets={snippetConfig.snippets}
                  onPick={(snippet) => updateFile(
                    appendSnippet(file.content, snippet, snippetConfig.language),
                  )}
                />
              )}
              {file?.editableKind === 'html' && (
                <button
                  type="button"
                  onClick={applyCurrentHtml}
                  disabled={!onApplyHtml || file.content === file.generatedContent}
                  className="rounded-lg bg-[var(--studio-accent)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--studio-accent-fill-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('Apply HTML')}
                </button>
              )}
              <button
                type="button"
                onClick={downloadCurrentFile}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white"
              >
                {t('Download')}
              </button>
              <button
                type="button"
                onClick={copy}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white"
              >
                {copied ? t('Copied') : t('Copy')}
              </button>
            </div>
          </div>

          {file?.editable ? (
            <textarea
              aria-label={t(
                file.editableKind === 'html'
                  ? 'HTML source editor'
                  : file.name === 'custom.css'
                    ? 'Custom CSS editor'
                    : 'Custom JavaScript editor',
              )}
              value={file.content}
              onChange={(event) => updateFile(event.target.value)}
              spellCheck={false}
              placeholder={file.editableKind === 'html'
                ? '<!DOCTYPE html>\n<html>…</html>'
                : file.name === 'custom.css'
                  ? '/* Add project-wide CSS here */'
                  : '// Add project-wide JavaScript here'}
              className="min-h-0 flex-1 resize-none border-0 bg-[#0d1117] p-5 font-mono text-[13px] leading-6 text-gray-100 outline-none placeholder:text-gray-600"
            />
          ) : (
            <pre
              aria-label={t('Generated source preview')}
              className="min-h-0 flex-1 overflow-auto bg-[#0d1117] p-5 font-mono text-[13px] leading-6 text-gray-100"
            >
              <code>{file?.content}</code>
            </pre>
          )}

          <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[#151a23] px-3 py-1.5 text-[10px] text-gray-500">
            <span>{String(file?.lang || '').toUpperCase()}</span>
            <span>{t('{count} lines', { count: lines })}</span>
            <span>{t('{count} characters', { count: file?.content?.length || 0 })}</span>
            {file?.name === 'custom.js' && (
              <span className="ml-auto hidden text-amber-300/80 md:inline">
                {t('Runs only inside the published-site sandbox')}
              </span>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default forwardRef(CodePanel)
