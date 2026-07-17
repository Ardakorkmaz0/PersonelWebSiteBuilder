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
export function measureHtmlSnippet(component, width, { timeout = 1500 } = {}) {
  return new Promise((resolve) => {
    let frame
    const done = (result) => {
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
      frame.onload = () => {
        window.clearTimeout(timer)
        try {
          const body = frame.contentDocument?.body
          if (!body) return done(null)
          const h = Math.ceil(body.scrollHeight)
          // Second read: how wide the content WANTS to be. max-content makes
          // fixed-width things (buttons, cards, icons) report their true box
          // while flowing text reports wider-than-frame and gets ignored.
          body.style.width = 'max-content'
          const naturalW = Math.ceil(body.scrollWidth)
          body.style.width = ''
          done(h > 0 ? { h, naturalW } : null)
        } catch {
          done(null)
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
// when the content is clearly narrower than the box (buttons, badges, cards);
// text blocks keep the designed width. Height always follows the content.
export function decideFitSize({ boxW, measuredH, naturalW }) {
  const w = Math.max(MIN_W, Math.round(boxW))
  const tightW = Number(naturalW) > 0 && naturalW + PAD < w * 0.92
    ? Math.max(MIN_W, Math.round(naturalW + PAD))
    : w
  const h = Math.max(MIN_H, Math.min(MAX_H, Math.round((Number(measuredH) || 0) + PAD)))
  return { w: tightW, h }
}

// Measure + apply: snaps the ACTIVE breakpoint's layout box onto the embed's
// real content. `apply(patch)` is the caller's setLayout binding. Re-measures
// once when the width tightened, since height changes with width.
export async function fitHtmlEmbedLayout(component, width, apply) {
  const first = await measureHtmlSnippet(component, width)
  if (!first) return false
  let { w, h } = decideFitSize({ boxW: width, measuredH: first.h, naturalW: first.naturalW })
  if (w !== Math.round(width)) {
    const second = await measureHtmlSnippet(component, w)
    if (second) h = decideFitSize({ boxW: w, measuredH: second.h, naturalW: 0 }).h
  }
  apply({ w, h })
  return true
}
