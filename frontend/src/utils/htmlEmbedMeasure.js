// Measures an HTML embed's REAL rendered size so its layout box can hug the
// content instead of keeping the palette's guessed width/height (the "selection
// frame is way bigger than the block" complaint). The snippet renders in a
// hidden same-origin iframe — safe because every executable script is stripped
// first; only markup + CSS participate in layout.
import { htmlEmbedDocument } from './htmlEmbedDocument.js'
import { embedAspectLock, htmlEmbedDocumentOptions } from './htmlSnippetSizing.js'
import { withoutExecutableScripts } from './htmlRuntime.js'

// Width the snippet is given room to lay out in while being measured.
const MIN_W = 80
// Floor for the RESULTING box. Much smaller than the measuring width: a badge
// is ~42px of ink and an icon ~24px, and clamping those up to 80 would leave
// the selection frame twice the size of the block — the thing this whole file
// exists to prevent. 20px still leaves a comfortably grabbable box (the resize
// edge hit zones are 14px).
const MIN_FIT_W = 20
const MIN_H = 20
const MAX_H = 2400
const PAD = 6

// Render `component`'s snippet at `width` and report { h, naturalW, paintedW }:
// h = content height at that width, naturalW = the content's max-content
// width (what a button/badge/card actually needs — paragraphs report wider
// than the box and are ignored by the caller), paintedW = how much room the
// content ACTUALLY takes up at this box width. Resolves null on failure.
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
      // Measure the snippet's INTRINSIC size — never its fill-mode or shape
      // size. Both stretch the content to 100% of a box that, in the 10px-tall
      // measure iframe, collapses to ~0. Strip them so we read the true content
      // box; scale + the other appearance tweaks (which change real size) stay.
      const base = htmlEmbedDocumentOptions(component, 1)
      const opts = {
        ...base,
        fill: '',
        tweaks: base.tweaks ? { ...base.tweaks, shape: undefined } : base.tweaks,
      }
      const doc = withoutExecutableScripts(
        htmlEmbedDocument(component?.props?.code || '', opts),
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
          // How much room the content actually occupies AT THIS WIDTH — the
          // union of the top-level elements' painted boxes. This is the honest
          // hug target: it respects a snippet's own `max-width` (a list-group
          // capped at 420px stays 420 no matter how wide the box is) and an
          // inline-flex button reports its real 89px instead of the palette's
          // guessed 220. Read BEFORE the max-content probe below, which
          // relayouts the body.
          let paintedW = 0
          for (const el of body.children) {
            const r = el.getBoundingClientRect()
            if (r.width > 0) paintedW = Math.max(paintedW, Math.ceil(r.right))
          }
          // Second read: how wide the content WANTS to be. max-content makes
          // fixed-width things (buttons, cards, icons) report their true box
          // while flowing text reports wider-than-frame and gets ignored.
          // Body only — the root always spans the full iframe width, so
          // including it would make the box never tighten.
          body.style.width = 'max-content'
          const naturalW = Math.ceil(body.scrollWidth)
          body.style.width = ''
          done(h > 0 ? { h, naturalW, paintedW } : null)
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

export function decideFitSize({
  boxW,
  measuredH,
  naturalW,
  paintedW,
  allowTighten = true,
  minRatio = MIN_TIGHTEN_RATIO,
}) {
  const w = Math.max(MIN_FIT_W, Math.round(boxW))
  const painted = Number(paintedW) > 0 ? Math.ceil(paintedW) + PAD : 0
  let tightW
  if (allowTighten && painted > 0 && painted < w) {
    // The content does not fill the box: we measured exactly how much room it
    // takes, so hug that. No ratio guard here — the guard below exists only for
    // the max-content GUESS, which can collapse a multi-column layout to one
    // column. A painted width can't do that: a grid that fills its box reports
    // the full box width and lands in the branch below instead.
    tightW = Math.max(MIN_FIT_W, painted)
  } else {
    const wanted = Number(naturalW) > 0 ? naturalW + PAD : 0
    tightW = allowTighten && wanted > 0 && wanted < w * 0.92 && wanted >= w * minRatio
      ? Math.max(MIN_FIT_W, Math.round(wanted))
      : w
  }
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
  // Sections and form fields are designed at a chosen width (you type into an
  // input; a section spans the page), so only their height ever adjusts.
  const allowTighten = !['section', 'input', 'select'].includes(paletteType)
  // A lone image IS its content — hug it fully; the stacking-collapse guard
  // only protects multi-column layouts, which an image block can't be.
  const minRatio = paletteType === 'image' ? 0 : undefined
  let { w, h } = decideFitSize({
    boxW: width,
    measuredH: first.h,
    naturalW: first.naturalW,
    paintedW: first.paintedW,
    allowTighten,
    minRatio,
  })
  // Aspect-locked embeds (profile photos, icons, shape=square/circle) get a box
  // matching the lock, driven off the measured content WIDTH — so the box can
  // never end up a rectangle that follows the source image's dimensions.
  const aspect = embedAspectLock(component)
  if (aspect) {
    apply({ w, h: Math.max(MIN_H, Math.round(w / aspect)) })
    return true
  }
  if (w !== Math.round(width)) {
    const second = await measureHtmlSnippet(component, w)
    if (second) h = decideFitSize({ boxW: w, measuredH: second.h, naturalW: 0 }).h
  }
  apply({ w, h })
  return true
}
