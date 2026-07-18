// Measures an HTML embed's REAL rendered size so its layout box can hug the
// content instead of keeping the palette's guessed width/height (the "selection
// frame is way bigger than the block" complaint). The snippet renders in a
// hidden same-origin iframe — safe because every executable script is stripped
// first; only markup + CSS participate in layout.
import { htmlEmbedDocument } from './htmlEmbedDocument.js'
import { htmlEmbedDocumentOptions } from './htmlSnippetSizing.js'
import { withoutExecutableScripts } from './htmlRuntime.js'

const MIN_W = 80
const MIN_H = 36
const MAX_H = 2400
const PAD = 6

// Render `component`'s snippet at `width` and report { h, naturalW }:
// h = content height at that width, naturalW = the content's max-content
// width (what a button/badge/card actually needs — paragraphs report wider
// than the box and are ignored by the caller). Resolves null on failure.
export function measureHtmlSnippet(component, width, { timeout = 2500 } = {}) {
  return new Promise((resolve) => {
    let frame
    let settled = false
    const done = (result) => {
      if (settled) return
      settled = true
      try { frame?.remove() } catch { /* already gone */ }
      resolve(result)
    }
    try {
      const doc = withoutExecutableScripts(
        htmlEmbedDocument(component?.props?.code || '', htmlEmbedDocumentOptions(component, 1)),
      )
      frame = document.createElement('iframe')
      frame.setAttribute('aria-hidden', 'true')
      frame.setAttribute('tabindex', '-1')
      frame.style.cssText = [
        'position:fixed', 'left:-10000px', 'top:0',
        `width:${Math.max(MIN_W, Math.round(width))}px`, 'height:10px',
        'visibility:hidden', 'pointer-events:none', 'border:0',
      ].join(';')
      const timer = window.setTimeout(() => done(null), timeout)
      const read = () => {
        window.clearTimeout(timer)
        try {
          const cd = frame.contentDocument
          const body = cd?.body
          if (!body) return done(null)
          const root = cd.documentElement
          // Height takes the max of body and root so absolutely-positioned
          // decorations (corner badges, ribbons) hanging past the flow count.
          const h = Math.ceil(Math.max(body.scrollHeight, root?.scrollHeight || 0))
          // Second read: how wide the content WANTS to be. max-content makes
          // fixed-width things (buttons, cards, icons) report their true box
          // while flowing text reports wider-than-frame and gets ignored.
          // Body only — the root always spans the full iframe width, so
          // including it would make the box never tighten.
          body.style.width = 'max-content'
          const naturalW = Math.ceil(body.scrollWidth)
          body.style.width = ''
          done(h > 0 ? { h, naturalW } : null)
        } catch {
          done(null)
        }
      }
      frame.onload = () => {
        // Custom fonts change metrics (a serif headline wraps differently than
        // its fallback), so wait for them — capped so a hanging CDN font can't
        // stall the fit. The scroll reads in read() force a synchronous
        // reflow, and the settle timer runs in the PARENT window: an offscreen
        // iframe may never get an animation frame of its own.
        const fontsReady = frame.contentWindow?.document?.fonts?.ready
        const settle = () => window.setTimeout(read, 30)
        if (fontsReady?.then) {
          let waited = false
          const go = () => {
            if (waited) return
            waited = true
            settle()
          }
          fontsReady.then(go, go)
          window.setTimeout(go, Math.max(200, timeout - 500))
        } else {
          settle()
        }
      }
      frame.srcdoc = doc
      document.body.appendChild(frame)
    } catch {
      done(null)
    }
  })
}

// Pure sizing decision — unit-testable without layout. Width only tightens
// when the content is clearly narrower than the box (cards, containers,
// images); text blocks keep the designed width, and so does anything whose
// max-content collapses far below the box (a flex/grid section reports the
// width of ONE column — tightening would stack its columns vertically).
// Height always follows the content.
const MIN_TIGHTEN_RATIO = 0.45

export function decideFitSize({ boxW, measuredH, naturalW, allowTighten = true, minRatio = MIN_TIGHTEN_RATIO }) {
  const w = Math.max(MIN_W, Math.round(boxW))
  const wanted = Number(naturalW) > 0 ? naturalW + PAD : 0
  const tightW = allowTighten && wanted > 0 && wanted < w * 0.92 && wanted >= w * minRatio
    ? Math.max(MIN_W, Math.round(wanted))
    : w
  const h = Math.max(MIN_H, Math.min(MAX_H, Math.round((Number(measuredH) || 0) + PAD)))
  return { w: tightW, h }
}

// Measure + apply: snaps the ACTIVE breakpoint's layout box onto the embed's
// real content. `apply(patch)` is the caller's setLayout binding. Re-measures
// once when the width tightened, since height changes with width.
// Sections are designed full-width — only their height ever adjusts.
export async function fitHtmlEmbedLayout(component, width, apply) {
  const first = await measureHtmlSnippet(component, width)
  if (!first) return false
  const paletteType = component?.props?._paletteType
  const allowTighten = paletteType !== 'section'
  // A lone image IS its content — hug it fully; the stacking-collapse guard
  // only protects multi-column layouts, which an image block can't be.
  const minRatio = paletteType === 'image' ? 0 : undefined
  let { w, h } = decideFitSize({ boxW: width, measuredH: first.h, naturalW: first.naturalW, allowTighten, minRatio })
  if (w !== Math.round(width)) {
    const second = await measureHtmlSnippet(component, w)
    if (second) h = decideFitSize({ boxW: w, measuredH: second.h, naturalW: 0 }).h
  }
  apply({ w, h })
  return true
}
