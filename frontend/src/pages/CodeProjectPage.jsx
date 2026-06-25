import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore.js'
import {
  chooseTargetFolder,
  detectDevServer,
  ensureReadPermission,
  isPickerCancel,
  loadProjectRoot,
  openProjectFolder,
  pingDevServer,
  readProject,
  supportsProjectFolder,
} from '../utils/projectFs.js'
import { assemblePreviewHtml, needsBuildToRender } from '../utils/htmlFiles.js'
import { DEVICES, isMobileDevice } from '../utils/htmlDevices.js'
import Sidebar from '../components/editor/Sidebar.jsx'
import ProjectFilesPanel from '../components/editor/ProjectFilesPanel.jsx'
import { FolderOpenIcon, CogIcon, LightbulbIcon, PaletteIcon } from '../components/icons.jsx'
import HtmlWorkspace from '../components/editor/HtmlWorkspace.jsx'
import HtmlElementPanel from '../components/editor/HtmlElementPanel.jsx'
import CodeFileEditor from '../components/editor/CodeFileEditor.jsx'

// Slim strip shown when a side rail is collapsed (mirrors the editor's).
function CollapsedRail({ side, label, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Show ${label}`}
      className={`flex w-7 shrink-0 flex-col items-center gap-2 bg-white py-3 text-[#9ca3af] transition hover:bg-[#f3f4f6] hover:text-[#374151] ${
        side === 'left' ? 'border-r border-[#e5e7eb]' : 'border-l border-[#e5e7eb]'
      }`}
    >
      <span className="text-sm font-bold">{side === 'left' ? '»' : '«'}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>
        {label}
      </span>
    </button>
  )
}

// Side-by-side live preview of the real running dev server, shown next to the
// CSS/JS editor — so you tweak source and watch the real app update beside it
// (Vite HMR reflects CSS instantly; a Save bumps reloadKey for full reloads).
function LivePane({ url, reloadKey, onReload, onOpenWindow }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col border-l border-[#e5e7eb] bg-[#0b0b0b]">
      <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-white px-3 py-1.5">
        <span className="shrink-0 text-xs font-semibold text-[#374151]">● Live</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#9ca3af]">{url}</span>
        <button
          type="button"
          onClick={onReload}
          title="Reload the embedded preview"
          className="shrink-0 rounded-lg border border-[#d1d5db] px-2 py-0.5 text-[11px] text-[#374151] hover:bg-[#f3f4f6]"
        >
          ↻
        </button>
        <button
          type="button"
          onClick={() => onOpenWindow?.()}
          title="Open in a real window — works even when embedding is blocked (Django), and auto-reloads on Save"
          className="shrink-0 rounded-lg border border-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 text-[11px] font-medium text-[#4f46e5] hover:bg-[#e0e7ff]"
        >
          Live window ↗
        </button>
      </div>
      <div className="border-b border-[#e5e7eb] bg-[#fffbeb] px-3 py-1 text-[10px] leading-snug text-[#92400e]">
        Blank? Many servers (Django) block embedding — click <strong>Live window</strong>; it auto-reloads on Save.
      </div>
      <iframe key={`livepane-${reloadKey}`} title="live-pane" src={url} className="min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  )
}

// The local "Code project" editor: open a folder from disk, edit its HTML/CSS/JS
// in place, and write the changes back. Shares the main editor's chrome — the
// VS Code-style Files rail, the rich HtmlWorkspace (View/Edit/Source + element
// panel + component placement + device frames), and a right-rail element panel
// — but operates on an in-memory file map (projectStore), not a server Site.
export default function CodeProjectPage() {
  const rootHandle = useProjectStore((s) => s.rootHandle)
  const rootName = useProjectStore((s) => s.rootName)
  const files = useProjectStore((s) => s.files)
  const activePath = useProjectStore((s) => s.activePath)
  const dirty = useProjectStore((s) => s.dirty)
  const saving = useProjectStore((s) => s.saving)
  const storeError = useProjectStore((s) => s.error)
  const setProject = useProjectStore((s) => s.setProject)
  const saveAll = useProjectStore((s) => s.saveAll)
  const saveFile = useProjectStore((s) => s.saveFile)
  const saveCopy = useProjectStore((s) => s.saveCopy)
  const closeProject = useProjectStore((s) => s.closeProject)
  const updateFile = useProjectStore((s) => s.updateFile)
  const setActive = useProjectStore((s) => s.setActive)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastHandle, setLastHandle] = useState(null)
  const [pending, setPending] = useState(null) // { path, type } component to place
  const [sel, setSel] = useState(null) // { path, info } selected element
  const [matchedCss, setMatchedCss] = useState([]) // CSS rules styling the selection
  const [reveal, setReveal] = useState(null) // { path, index, length } for "jump to CSS"
  const [liveReloadKey, setLiveReloadKey] = useState(0) // bump to reload the live preview
  const [htmlDevice, setHtmlDevice] = useState('fit')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [copyMsg, setCopyMsg] = useState('')
  // The running dev server to preview server-rendered apps (Django/Rails/…) in
  // the ● Live tab. Persisted globally (one URL at a time is plenty).
  const [liveUrl, setLiveUrl] = useState(() => {
    try { return localStorage.getItem('pwb_code_liveurl') || '' } catch { return '' }
  })
  const updateLiveUrl = (v) => {
    setLiveUrl(v)
    try { localStorage.setItem('pwb_code_liveurl', v) } catch { /* ignore */ }
  }
  // ● Live setup helper: detected dev-server candidates + whether the URL is up.
  const [detected, setDetected] = useState(null)
  const [detectOpen, setDetectOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [liveUp, setLiveUp] = useState(false)
  // What kind of project this is, so the editor can set expectations up front:
  // { kind: 'static' | 'app', framework }. null until classified.
  const [projectInfo, setProjectInfo] = useState(null)
  const [bannerNonce, setBannerNonce] = useState(0) // re-render after dismiss
  const workspaceRef = useRef(null)
  const supported = supportsProjectFolder()

  const activeFile = activePath ? files.get(activePath) : null
  const isHtml = activeFile?.kind === 'html'

  // When the open page can't be statically rendered (a built SPA, or a
  // server-side template), tell the user why View is blank/partial and send
  // them to the ● Live tab instead of staring at an empty stage.
  const buildKind = isHtml ? needsBuildToRender(activeFile.content || '', activeFile.path, files) : ''
  const viewNotice =
    buildKind === 'bundler'
      ? 'This looks like a bundled app (React / Vue / Vite…). A browser can’t build & run it, so this static View stays blank. Run your dev server (e.g. npm run dev) and use the ● Live tab.'
      : buildKind === 'template'
        ? 'This is a server-rendered template (Django / Jinja…). View shows a static skeleton only — the ● Live tab shows the real page from your running server.'
        : ''

  // Selection + pending placement are tagged with the file they belong to, so
  // switching files drops them automatically — no effect, no cascading render.
  const htmlSelection = sel && sel.path === activePath ? sel.info : null
  const pendingType = pending && pending.path === activePath ? pending.type : null
  const pendingHtml = pending && pending.path === activePath ? pending.html : null

  // Build the View/Edit document for the open html from the LIVE files map, so
  // editing a linked CSS/JS re-renders the preview. Reads files at call time
  // (not via closure) so it never goes stale; stable per active file.
  const assemble = useCallback(
    (htmlText, opts) =>
      assemblePreviewHtml(htmlText, activePath, useProjectStore.getState().files, opts),
    [activePath],
  )

  // Called when the workspace selects an element — record it + which CSS rules
  // style it (computed from the LIVE element via the workspace, against the
  // current CSS files read fresh from the store so edits are reflected).
  const onElementSelect = (info) => {
    setSel(info ? { path: activeFile.path, info } : null)
    if (!info) { setMatchedCss([]); return }
    const css = [...useProjectStore.getState().files.values()]
      .filter((f) => f.kind === 'css')
      .map((f) => ({ path: f.path, content: f.content || '' }))
    setMatchedCss(workspaceRef.current?.matchCssRules?.(css) || [])
  }
  // Open a matched rule: switch to its CSS file and reveal the rule there.
  const openRule = (rule) => {
    setReveal({ path: rule.path, index: rule.index, length: (rule.selector || '').length })
    setActive(rule.path)
  }

  // Saving writes the edits to disk; reload the live preview so the running dev
  // server's latest is shown (Vite HMR already reflects CSS instantly, but a
  // full reload covers template/HTML changes and non-HMR servers like Django).
  const reloadLive = () => setLiveReloadKey((k) => k + 1)
  // A real browser window showing the dev server — the reliable preview when a
  // server blocks iframe embedding (Django). Reused across opens (named window),
  // and re-navigated (= reloaded) on Save without stealing focus.
  const liveWindowRef = useRef(null)
  const openLiveWindow = () => {
    const url = liveUrl.trim()
    if (!url) return
    const w = window.open(url, 'pwb-live-preview')
    if (w) liveWindowRef.current = w
  }
  const refreshLiveWindow = () => {
    const w = liveWindowRef.current
    const url = liveUrl.trim()
    if (!w || w.closed || !url) return
    try { w.location = url } catch { window.open(url, 'pwb-live-preview') }
  }
  const saveActiveFile = async () => { await saveFile(activePath); reloadLive(); refreshLiveWindow() }
  const saveEverything = async () => { await saveAll(); reloadLive(); refreshLiveWindow() }

  // The "what to expect" banner is dismissible per project (so it never nags
  // twice for the same folder). Read from localStorage at render — cheap, and
  // avoids a synchronous setState in an effect.
  const bannerKey = `pwb_code_kindbanner_${rootName}`
  const bannerDismissed = (() => {
    void bannerNonce // re-read after a dismiss
    try { return localStorage.getItem(bannerKey) === '1' } catch { return false }
  })()
  const dismissBanner = () => {
    try { localStorage.setItem(bannerKey, '1') } catch { /* ignore */ }
    setBannerNonce((n) => n + 1)
  }

  // Detect the project's dev server(s) from its marker files (manage.py,
  // package.json…), auto-fill the ● Live URL, and show the exact command to run.
  const runDetect = async () => {
    setDetecting(true)
    setError('')
    try {
      const cands = await detectDevServer(rootHandle)
      setDetected(cands)
      setDetectOpen(true)
      if (!liveUrl.trim() && cands.length) updateLiveUrl(cands[0].url)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setDetecting(false)
    }
  }

  // Offer to reopen the last folder (re-reading needs a user gesture for the
  // permission re-prompt, so we only surface a button — never auto-open).
  useEffect(() => {
    if (rootHandle) return
    loadProjectRoot().then((h) => h?.name && setLastHandle(h))
  }, [rootHandle])

  // Classify the project once it's opened (static site vs a built/served app),
  // so the editor can set expectations instead of letting the user hit a blank
  // View. setState only inside the async body → no cascading-render lint issue.
  useEffect(() => {
    if (!rootHandle) return undefined
    let alive = true
    ;(async () => {
      const cands = await detectDevServer(rootHandle, { probePorts: false })
      const map = useProjectStore.getState().files
      const home =
        [...map.values()].find((f) => /(^|\/)index\.html?$/i.test(f.path)) ||
        [...map.values()].find((f) => f.kind === 'html')
      const build = home ? needsBuildToRender(home.content || '', home.path, map) : ''
      const isApp = cands.length > 0 || build === 'bundler' || build === 'template'
      const framework =
        cands[0]?.label || (build === 'template' ? 'Server template' : build === 'bundler' ? 'Bundled app' : '')
      if (alive) setProjectInfo({ kind: isApp ? 'app' : 'static', framework })
    })()
    return () => { alive = false }
  }, [rootHandle])

  // Poll the Live URL so the dot goes green once the dev server is up (the user
  // started it in their terminal). No synchronous setState in the effect body
  // (only inside the async ping) so it never cascades; the dot shows gray when
  // the field is empty regardless of the last value.
  useEffect(() => {
    const url = liveUrl.trim()
    if (!url) return undefined
    let alive = true
    const check = () => pingDevServer(url).then((up) => alive && setLiveUp(up))
    check()
    const id = setInterval(check, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [liveUrl])

  async function openFolder() {
    setError('')
    setBusy(true)
    try {
      setProject(await openProjectFolder())
    } catch (e) {
      if (!isPickerCancel(e)) setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    if (!lastHandle) return
    setError('')
    setBusy(true)
    try {
      if (!(await ensureReadPermission(lastHandle))) {
        setError('Folder access was declined.')
        return
      }
      setProject(await readProject(lastHandle))
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveCopyToFolder() {
    setError('')
    setCopyMsg('')
    try {
      const target = await chooseTargetFolder()
      if (await saveCopy(target)) {
        setCopyMsg(`Copied to “${target.name}”`)
        setTimeout(() => setCopyMsg(''), 2500)
      }
    } catch (e) {
      if (!isPickerCancel(e)) setError(e?.message || String(e))
    }
  }

  if (!rootHandle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f3f4f6] p-6">
        <div className="ms-card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eef2ff] text-[#4f46e5]"><FolderOpenIcon size={24} /></div>
          <h1 className="text-lg font-bold text-[#111827]">Open a local project</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Pick a folder on your computer. Only its web files (HTML, CSS, JS,
            images) are shown — edit them and save the changes straight back to
            disk.
          </p>
          <p className="mt-2 rounded-lg bg-[#f3f4f6] px-3 py-2 text-xs leading-relaxed text-[#6b7280]">
            <strong className="text-[#374151]">Best for static sites</strong> (plain HTML/CSS/JS) —
            full visual View &amp; Edit. For <strong className="text-[#374151]">React / Django</strong>
            {' '}apps it’s a code editor + live preview: the page renders from your dev server, shown via
            the <strong>● Live</strong> tab / window.
          </p>
          {supported ? (
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={openFolder} disabled={busy} className="ms-btn ms-btn-primary w-full py-2">
                {busy ? 'Opening…' : 'Open folder…'}
              </button>
              {lastHandle && (
                <button onClick={reopen} disabled={busy} className="ms-btn w-full py-2">
                  Reopen “{lastHandle.name}”
                </button>
              )}
            </div>
          ) : (
            <p className="mt-5 rounded-lg bg-[#fff4ce] px-3 py-2 text-xs text-[#5d4a06]">
              This needs the File System Access API — please use a Chromium
              browser (Chrome, Edge).
            </p>
          )}
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>
        <Link to="/" className="text-sm text-[#6b7280] hover:text-[#111827]">
          &larr; Back to Sites
        </Link>
      </div>
    )
  }

  const activeDirty = activePath ? dirty.has(activePath) : false

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-[#e5e7eb] bg-white px-3 py-1.5 shadow-sm">
        <Link to="/" title="Back to Sites" className="flex shrink-0 items-center gap-1 text-sm font-medium text-[#6b7280] hover:text-[#111827]">
          <span className="brand-mark" style={{ width: '1.6rem', height: '1.6rem', fontSize: '0.8rem' }}>S</span>
          <span>&larr;</span>
        </Link>
        <span className="flex shrink-0 items-center gap-1.5 truncate text-sm font-semibold text-[#111827]"><FolderOpenIcon size={15} className="text-[#6b7280]" /> {rootName}</span>
        <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[#475569]">
          Code Project
        </span>
        {dirty.size > 0 && (
          <span className="shrink-0 whitespace-nowrap text-xs text-amber-500">
            {dirty.size} unsaved file{dirty.size > 1 ? 's' : ''}
          </span>
        )}
        {copyMsg && <span className="shrink-0 whitespace-nowrap text-xs text-[#15803d]">{copyMsg}</span>}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {/* Live dev-server URL + setup helper. The dot goes green when the
              server is reachable; Detect reads the project's marker files to
              fill the URL and show the exact command to start it. */}
          <div className="relative flex items-center gap-1">
            <span
              title={liveUrl.trim() && liveUp ? 'Dev server is up' : 'Dev server not reachable'}
              className={`h-2 w-2 shrink-0 rounded-full ${liveUrl.trim() && liveUp ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}
            />
            <input
              value={liveUrl}
              onChange={(e) => updateLiveUrl(e.target.value)}
              placeholder="Live URL — e.g. http://localhost:8000"
              title="Run your dev server, put its URL here, then use the ● Live tab to preview the real page"
              className="w-44 rounded-lg border border-[#d1d5db] px-2 py-1 text-xs text-[#374151] focus:border-[#4f46e5] focus:outline-none"
            />
            <button
              type="button"
              onClick={runDetect}
              disabled={detecting}
              title="Detect this project's dev server and fill the URL"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-[#d1d5db] px-2 py-1 text-xs text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
            >
              {detecting ? '…' : <><CogIcon size={13} /> Detect</>}
            </button>
            {detectOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDetectOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-[#e5e7eb] bg-white p-2 text-left shadow-lg">
                  {detected && detected.length ? (
                    detected.map((c, i) => (
                      <div key={i} className="mb-1.5 rounded-md border border-[#e5e7eb] p-2 last:mb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-semibold text-[#111827]">
                            {c.label}{c.cwd ? ` · ${c.cwd}/` : ''}
                            {c.busy && (
                              <span className="ml-1 rounded bg-[#fef3c7] px-1 py-px text-[10px] font-medium text-[#92400e]">in use</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => { updateLiveUrl(c.url); setDetectOpen(false) }}
                            className="shrink-0 rounded border border-[#4f46e5] px-2 py-0.5 text-[11px] font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
                          >
                            Use {c.url.replace(/^https?:\/\//, '')}
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <code className="min-w-0 flex-1 truncate rounded bg-[#f3f4f6] px-1.5 py-0.5 font-mono text-[11px] text-[#374151]">{c.command}</code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(c.command)}
                            title="Copy command"
                            className="shrink-0 rounded border border-[#d1d5db] px-1.5 py-0.5 text-[11px] text-[#374151] hover:bg-[#f3f4f6]"
                          >
                            Copy
                          </button>
                        </div>
                        {c.busy && c.altUrl && (
                          <div className="mt-1.5 rounded bg-[#fffbeb] p-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#92400e]">Busy — run this project on a free port:</span>
                              <button
                                type="button"
                                onClick={() => { updateLiveUrl(c.altUrl); setDetectOpen(false) }}
                                className="shrink-0 rounded border border-[#fbbf24] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#92400e] hover:bg-[#fef3c7]"
                              >
                                Use {c.altUrl.replace(/^https?:\/\//, '')}
                              </button>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <code className="min-w-0 flex-1 truncate rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#374151]">{c.altCommand}</code>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard?.writeText(c.altCommand)}
                                title="Copy command"
                                className="shrink-0 rounded border border-[#d1d5db] px-1.5 py-0.5 text-[10px] text-[#374151] hover:bg-[#f3f4f6]"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="p-1 text-xs text-[#6b7280]">
                      No dev server detected — looks like a static site. Just open an HTML file in View.
                    </p>
                  )}
                  <p className="mt-1 px-1 text-[10px] leading-snug text-[#9ca3af]">
                    A browser can’t start it for you — run the command in your terminal. The ● dot turns
                    green once it’s up, then the ● Live tab works.
                  </p>
                </div>
              </>
            )}
          </div>
          {/* Device frame — same anatomy as the editor, only meaningful while an
              html file is open. */}
          {isHtml && (
            <>
              <div className="flex items-center rounded-lg border border-[#d1d5db] p-0.5 text-xs font-medium">
                <button
                  onClick={() => setHtmlDevice('fit')}
                  className={!isMobileDevice(htmlDevice) ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white' : 'px-2.5 py-1 text-[#374151]'}
                >
                  PC
                </button>
                <button
                  onClick={() => setHtmlDevice('iphone15')}
                  className={isMobileDevice(htmlDevice) ? 'rounded-lg bg-[#4f46e5] px-2.5 py-1 text-white' : 'px-2.5 py-1 text-[#374151]'}
                >
                  Mobile
                </button>
              </div>
              <select
                value={htmlDevice}
                onChange={(e) => setHtmlDevice(e.target.value)}
                title="Screen / device width"
                className="max-w-[140px] truncate rounded-lg border border-[#d1d5db] px-2 py-1 text-xs font-medium text-[#374151] focus:border-[#4f46e5] focus:outline-none"
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button onClick={openFolder} className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]">
            Open folder…
          </button>
          <button onClick={closeProject} className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]">
            Close
          </button>
          <button
            onClick={saveCopyToFolder}
            title="Write a copy of the whole project (with your edits) into a folder you pick — the original is left untouched"
            className="rounded-lg px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6]"
          >
            Save a copy…
          </button>
          <button
            onClick={saveActiveFile}
            disabled={saving || !activeDirty}
            title="Write just the open file back to disk"
            className="rounded-lg border border-[#d1d5db] px-3 py-1.5 text-sm text-[#374151] hover:bg-[#f3f4f6] disabled:opacity-50"
          >
            Save file
          </button>
          <button
            onClick={saveEverything}
            disabled={saving || dirty.size === 0}
            title="Write every changed file back to its folder on disk"
            className="rounded-lg bg-[#16a34a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to folder'}
          </button>
        </div>
      </header>

      {(error || storeError) && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-600">{error || storeError}</div>
      )}

      {/* Set expectations up front: app projects can't be statically rendered,
          so point the user at the real workflow before they hit a blank View. */}
      {projectInfo?.kind === 'app' && !bannerDismissed && (
        <div className="flex items-start gap-2 border-b border-[#fde68a] bg-[#fffbeb] px-4 py-2 text-xs text-[#92400e]">
          <LightbulbIcon size={14} aria-hidden className="mt-px shrink-0" />
          <div className="min-w-0 flex-1 leading-relaxed">
            <strong>{projectInfo.framework || 'App'} project.</strong>{' '}
            Its pages are built/served at runtime, so the static <em>View</em> stays blank or partial —
            here <strong>/code is a code editor + live preview</strong>. To see the real page: start your
            dev server, click <strong>Detect</strong> to fill the URL, then <strong>Open live window</strong>
            {' '}(it auto-reloads every Save). Editing CSS/JS &amp; the template markup still works great.
          </div>
          <button
            type="button"
            onClick={runDetect}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[#fbbf24] bg-white px-2 py-1 font-medium text-[#92400e] hover:bg-[#fef3c7]"
          >
            <CogIcon size={13} /> Detect
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            className="shrink-0 rounded-lg px-2 py-1 font-medium text-[#92400e] hover:bg-[#fef3c7]"
          >
            Got it
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left rail: the VS Code-style Files explorer + (for html files) the
            component palette, whose picks splice a block into the document. */}
        {leftOpen ? (
          <Sidebar
            onPickComponent={isHtml ? (t, html) => setPending({ path: activePath, type: t, html }) : undefined}
            onCollapse={() => setLeftOpen(false)}
            filesPanel={<ProjectFilesPanel />}
          />
        ) : (
          <CollapsedRail side="left" label="Files" onOpen={() => setLeftOpen(true)} />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {!activeFile ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#9ca3af]">
              Select a file from the explorer to open it.
            </div>
          ) : isHtml ? (
            <HtmlWorkspace
              key={activeFile.path}
              ref={workspaceRef}
              persistKey={`code:${activeFile.path}`}
              html={activeFile.content ?? ''}
              fileName={activeFile.path.split('/').pop()}
              deviceId={htmlDevice}
              liveUrl={liveUrl.trim()}
              liveReloadKey={liveReloadKey}
              onOpenLiveWindow={openLiveWindow}
              viewNotice={viewNotice}
              assemble={assemble}
              assembleDeps={files}
              onCommit={(h) => updateFile(activeFile.path, h)}
              onRequestSave={() => saveFile(activeFile.path)}
              onElementSelect={onElementSelect}
              pendingType={pendingType}
              pendingHtml={pendingHtml}
              onPlaced={() => setPending(null)}
              onCancelPlacement={() => setPending(null)}
            />
          ) : (
            <CodeFileEditor
              key={activeFile.path}
              file={activeFile}
              onChange={(c) => updateFile(activeFile.path, c)}
              reveal={reveal && reveal.path === activeFile.path ? reveal : null}
            />
          )}
        </div>

        {/* Right rail (html only): element properties when something is selected
            in the edit iframe, a hint otherwise. */}
        {isHtml &&
          (rightOpen ? (
            <div className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  {htmlSelection ? 'Element' : 'Properties'}
                </span>
                <button
                  type="button"
                  onClick={() => setRightOpen(false)}
                  title="Hide panel"
                  className="rounded-md px-1.5 py-0.5 text-xs text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                >
                  »
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {htmlSelection ? (
                  <>
                    {/* "Jump to CSS": the stylesheet rules that style this
                        element — click to open the file at that rule, so you
                        edit the real CSS instead of inline-styling the template. */}
                    {matchedCss.length > 0 && (
                      <div className="border-b border-[#e5e7eb] bg-[#f9fafb] p-3">
                        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                          <PaletteIcon size={11} /> Styled by — open the CSS rule
                        </div>
                        <div className="space-y-1">
                          {matchedCss.map((r) => (
                            <button
                              key={r.path + ':' + r.index}
                              type="button"
                              onClick={() => openRule(r)}
                              title={`${r.path} — open this rule in the CSS editor`}
                              className="flex w-full items-center justify-between gap-2 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-left hover:border-[#4f46e5] hover:bg-[#eef2ff]"
                            >
                              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#4f46e5]">{r.selector}</span>
                              <span className="shrink-0 truncate font-mono text-[10px] text-[#9ca3af]">{r.path.split('/').pop()}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <HtmlElementPanel
                      info={htmlSelection}
                      pages={[]}
                      onChange={(patch) => workspaceRef.current?.updateSelectedElement?.(patch)}
                      onSelectParent={() => workspaceRef.current?.selectParent?.()}
                      onDuplicate={() => workspaceRef.current?.duplicateSelected?.()}
                      onMoveUp={() => workspaceRef.current?.moveSelected?.('up')}
                      onMoveDown={() => workspaceRef.current?.moveSelected?.('down')}
                      onDelete={() => workspaceRef.current?.deleteSelected?.()}
                      onClose={() => workspaceRef.current?.clearSelection?.()}
                    />
                  </>
                ) : (
                  <p className="p-4 text-sm leading-relaxed text-[#9ca3af]">
                    Switch to <span className="font-semibold text-[#6b7280]">Edit</span> and click any
                    element in the page to change its text, link, colors, border, spacing and layout
                    here. Or drag a component from the left onto the page.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <CollapsedRail side="right" label={htmlSelection ? 'Element' : 'Properties'} onOpen={() => setRightOpen(true)} />
          ))}

        {/* Editing a CSS/JS source file with a dev server set → show the real
            running app right beside the code, so changes are visible live. */}
        {!isHtml && activeFile && liveUrl.trim() && (
          <LivePane url={liveUrl.trim()} reloadKey={liveReloadKey} onReload={reloadLive} onOpenWindow={openLiveWindow} />
        )}
      </div>
    </div>
  )
}
