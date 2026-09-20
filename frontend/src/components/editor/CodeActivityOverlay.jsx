import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { schemaToFiles } from '../../utils/schemaToFiles.js'
import { changedCodeLines } from '../../utils/codeDiff.js'
import { useLanguage } from '../../i18n/useLanguage.js'

// Shows what an edit just did to the page's code: the settings change lands,
// the lines it rewrote type themselves out over the canvas, then the card goes
// away. The document is the real one the exporter writes, so this is the file,
// not a mock-up of it.

const REBUILD_MS = 140 // trailing throttle — one rebuild per burst of edits
const TYPE_MS = 430 // how long the whole snippet takes to type itself out
const TICK_MS = 24 // one reveal step — fast enough to read as typing
const HOLD_MS = 1500 // how long it stays up once written
const FADE_MS = 280
const MAX_LINES = 5
const MAX_CHARS = 116 // per line, so a long line cannot span the whole canvas

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
  catch { return false }
}

function trim(text) {
  const flat = text.replace(/\t/g, '  ')
  return flat.length > MAX_CHARS ? `${flat.slice(0, MAX_CHARS - 1)}…` : flat
}

// The files a component page is actually made of, in the order they are worth
// reporting. Moving a block or restyling it rewrites the STYLESHEET, not the
// markup — reading only the page's html is why dragging something across the
// canvas used to produce no line at all.
function watchedFiles(schema, pageId) {
  const files = schemaToFiles(schema)
  const htmlFiles = files.filter((file) => file.lang === 'html')
  const index = (schema?.pages || []).findIndex((page) => page.id === pageId)
  const pageFile = htmlFiles[index >= 0 ? index : 0]
  return [pageFile, ...['styles.css', 'custom.css', 'custom.js'].map((name) => files.find((file) => file.name === name))]
    .filter(Boolean)
    .map((file) => ({ name: file.name, content: file.content }))
}

// The code block, as a button when there is somewhere to go and a plain block
// when there is not — same markup either way, so the card looks identical.
function Body({ as, onClick, label, children }) {
  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} title={label} aria-label={label} className="code-activity-body code-activity-body-link">
        {children}
      </button>
    )
  }
  return <pre className="code-activity-body">{children}</pre>
}

// `document` is for the HTML workspace, where the page IS a file and the edit
// already produced it. Without it the builder's page is rendered through the
// exporter on every change.
export default function CodeActivityOverlay({
  pageId,
  title,
  document: source,
  fileName = 'index.html',
  // 0 keeps the card up until it is dismissed or the next edit replaces it.
  holdMs = HOLD_MS,
  // Given, the card becomes a button that opens this change in the source.
  onOpenSource,
}) {
  const { t } = useLanguage()
  const [hovered, setHovered] = useState(false)
  const schema = useEditorStore((state) => state.schema)
  const authored = source !== undefined
  const page = useMemo(
    () => (schema.pages || []).find((item) => item.id === pageId) || null,
    [schema, pageId],
  )

  // name -> last seen content, so a change is reported against the file it
  // happened in rather than against one document that may not hold it.
  const lastFiles = useRef(new Map())
  const nextId = useRef(0)
  // One piece of state, so a new edit replaces the whole card — how much of it
  // is typed and whether it is on its way out travel with the change itself.
  const [change, setChange] = useState(null)

  // A different page is a different file: start its baseline from scratch so
  // switching pages never reads as an edit. The card left over from the page
  // we came from is dropped at render, below.
  useEffect(() => {
    lastFiles.current = new Map()
  }, [pageId])

  useEffect(() => {
    if (!authored && !page) return undefined
    const timer = window.setTimeout(() => {
      let files
      if (authored) files = [{ name: fileName, content: String(source ?? '') }]
      else {
        try {
          files = watchedFiles(schema, pageId)
        } catch {
          return // a half-finished edit that the writers cannot render yet
        }
      }
      const seen = lastFiles.current
      const first = seen.size === 0
      let found = null
      for (const file of files) {
        const previous = seen.get(file.name)
        seen.set(file.name, file.content)
        if (first || previous === undefined || previous === file.content || found) continue
        const diff = changedCodeLines(previous, file.content, MAX_LINES)
        if (diff) found = { ...diff, file: file.name }
      }
      if (!found) return
      nextId.current += 1
      setChange({ ...found, id: nextId.current, pageId, typed: 0, leaving: false })
    }, REBUILD_MS)
    return () => window.clearTimeout(timer)
  }, [authored, source, fileName, page, pageId, schema, title])

  const id = change?.id
  const done = !!change?.done
  const total = useMemo(
    () => (change ? change.lines.reduce((sum, line) => sum + trim(line.text).length, 0) : 0),
    [change],
  )

  // Type it out. Each update checks the id, so a timer that outlives its card
  // does nothing, and the next edit simply replaces the whole thing.
  useEffect(() => {
    if (!id) return undefined
    const mine = (updater) => setChange((current) => (current && current.id === id ? updater(current) : current))
    const finish = () => mine((current) => ({ ...current, typed: total, done: true }))
    if (prefersReducedMotion() || total === 0) {
      const settle = window.setTimeout(finish, 0)
      return () => window.clearTimeout(settle)
    }
    // A timer rather than rAF: a background tab pauses animation frames, and a
    // ticker frozen half-written would never retire itself.
    const started = Date.now()
    const tick = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / TYPE_MS)
      if (progress < 1) mine((current) => ({ ...current, typed: Math.ceil(progress * total) }))
      else {
        window.clearInterval(tick)
        finish()
      }
    }, TICK_MS)
    return () => window.clearInterval(tick)
  }, [id, total])

  // Then hold it and fade it. `holdMs` 0 means "until dismissed": the card is
  // written out and stays, waiting for the × or the next edit. Hovering holds
  // it too, so a line you are still reading cannot vanish under the pointer.
  useEffect(() => {
    if (!id || !done || hovered || !holdMs) return undefined
    const mine = (updater) => setChange((current) => (current && current.id === id ? updater(current) : current))
    const timers = [
      window.setTimeout(() => mine((current) => ({ ...current, leaving: true })), holdMs),
      window.setTimeout(() => mine(() => null), holdMs + FADE_MS),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [id, done, hovered, holdMs])

  // A card belongs to the page it was written for; switching pages drops it.
  if (!change || change.pageId !== pageId) return null

  const leaving = change.leaving
  const texts = change.lines.map((line) => trim(line.text))
  const before = texts.reduce((acc, text) => [...acc, acc[acc.length - 1] + text.length], [0])
  const lines = change.lines.map((line, index) => {
    const text = texts[index]
    const shown = Math.max(0, Math.min(text.length, change.typed - before[index]))
    return { ...line, text, shown: text.slice(0, shown), typing: shown < text.length }
  })
  const writing = lines.some((line) => line.typing)
  const caretLine = lines.findIndex((line) => line.typing)

  const first = change.lines[0]
  const span = change.span || { start: first.number, end: first.number, count: 1 }
  // The whole region goes to the source, not just the line the card had room
  // for: what was changed is what should light up there.
  const openSource = onOpenSource
    ? () => onOpenSource({
      file: change.file,
      line: span.start,
      endLine: span.end,
      text: first.text,
      removed: first.removed,
    })
    : null

  return (
    <div className="code-activity-layer">
      <div
        className={`code-activity ${leaving ? 'code-activity-leaving' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="code-activity-head">
          <span className={`code-activity-dot ${writing ? 'code-activity-dot-live' : ''}`} aria-hidden="true" />
          <span className="code-activity-label">{t('Live code')}</span>
          <span className="code-activity-file">
            {change.file || fileName}:{span.start}{span.count > 1 ? `-${span.end}` : ''}
          </span>
          <button
            type="button"
            onClick={() => setChange(null)}
            title={t('Close')}
            aria-label={t('Close')}
            className="code-activity-close"
          >
            ×
          </button>
        </div>
        {/* The body is the button: clicking the code opens it in Source, which
            is where you go next when a line surprises you. */}
        <Body as={openSource ? 'button' : 'div'} onClick={openSource} label={openSource ? t('Open in Source') : undefined}>
          {lines.map((line, index) => (
            <span key={line.number} className={`code-activity-line ${line.removed ? 'code-activity-line-removed' : ''}`}>
              <span className="code-activity-number">{line.number}</span>
              <span className="code-activity-sign">{line.removed ? '-' : '+'}</span>
              <span className="code-activity-text">
                {line.shown}
                {index === caretLine && <span className="code-activity-caret" aria-hidden="true" />}
              </span>
            </span>
          ))}
        </Body>
        {(change.hiddenCount > 0 || change.otherHunks > 0) && !writing && (
          <div className="code-activity-more">
            {[
              change.hiddenCount > 0 && t('+{count} more lines', { count: change.hiddenCount }),
              change.otherHunks > 0 && t('{count} more places in this file', { count: change.otherHunks }),
            ].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
