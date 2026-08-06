// Uploaded pages that animate themselves into view, seen from the editor.
//
// The edit iframe runs no scripts. That is deliberate — designMode and a page's
// own JavaScript fight over the same DOM, and every class or inline style a
// library adds would be saved back into the user's file as if they had written
// it. But nearly every scroll-reveal library works the same way: CSS hides the
// element (opacity:0), JavaScript adds a class that shows it. With no JS, the
// hiding half runs and the showing half never does, so whole sections of an
// uploaded page are simply *not there* in the editor.
//
// Measured, not assumed: in a frame sandboxed with allow-same-origin only, CSS
// @keyframes keep running (1 running animation, non-identity transform) while
// both an on-load reveal and a scroll reveal stay at opacity 0.
//
// So the editor shows those elements at REST — the state they end the animation
// in, which is also the state you want to edit them in. Nothing is written to
// the document that a save could keep: one editor-only stylesheet, one marker
// attribute, both stripped by serializeDocument.

export const MOTION_REST_ATTR = 'data-pwb-motion-rest'
export const MOTION_REST_STYLE_ATTR = 'data-pwb-motion-style'

// The final state of every reveal shape at once. `!important` because the rule
// it is overriding is the author's own, often written with the same weapon.
export const MOTION_REST_CSS = `
[${MOTION_REST_ATTR}]{
  opacity:1 !important;
  visibility:visible !important;
  transform:none !important;
  filter:none !important;
  clip-path:none !important;
  animation:none !important;
  transition:none !important;
}
`.trim()

// Markers that mean "a library will reveal this", used by AOS, WOW.js,
// ScrollReveal, Animate-on-scroll forks and the hand-rolled versions everyone
// writes. Matching one is enough on its own: these attributes exist for no
// other reason.
const REVEAL_MARKERS = [
  '[data-aos]',
  '[data-sr]',
  '[data-sr-id]',
  '[data-scroll]',
  '[data-animate]',
  '[data-anim]',
  '.wow',
  '.reveal',
  '.js-reveal',
  '.scroll-reveal',
  '.animate-on-scroll',
  '.fade-in',
  '.fadeIn',
].join(',')

// Things that are invisible because they are SUPPOSED to be, right now. A modal,
// a dropdown, a tooltip, a closed disclosure — forcing those open would be a
// worse bug than the one being fixed, and they are invisible in exactly the same
// computed way a reveal is.
const INTENTIONALLY_HIDDEN = [
  '[hidden]',
  '[aria-hidden="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="tooltip"]',
  '[role="menu"]',
  'dialog:not([open])',
  'details:not([open])',
  '.modal',
  '.popup',
  '.dropdown-menu',
  '.tooltip',
  '.toast',
  '.offcanvas',
  '.lightbox',
  '.overlay',
].join(',')

function animatedLooking(style) {
  const duration = String(style.transitionDuration || '')
  const animating = String(style.animationName || 'none') !== 'none'
  // A transition only counts when it actually lasts: `transition: all 0s` is
  // how people disable one, not how they build a reveal.
  const transitions = /[1-9]/.test(duration)
    && /opacity|transform|filter|clip-path|all/.test(String(style.transitionProperty || ''))
  return animating || transitions
}

/** True when this element is invisible only because its reveal never ran.
 *
 * Deliberately narrow. Opacity is the signal because it is what reveals use and
 * what nothing else is; a displaced-but-visible element (a carousel slide mid
 * -track) is left alone, and so is anything positioned like an overlay. */
export function hiddenByMotion(el, win) {
  if (!el || !win || el.nodeType !== 1) return false
  if (el.closest?.(INTENTIONALLY_HIDDEN)) return false
  const style = win.getComputedStyle(el)
  // display:none is a different kind of hidden — it has no box, forcing opacity
  // would show nothing, and it is how real "not now" content is written.
  if (style.display === 'none') return false
  // Overlays, sticky bars and back-to-top buttons live here and are invisible
  // on purpose far more often than they are mid-reveal.
  if (style.position === 'fixed') return false
  const invisible = Number(style.opacity) < 0.05 || style.visibility === 'hidden'
  if (!invisible) return false
  return animatedLooking(style) || !!el.matches?.(REVEAL_MARKERS)
}

function ensureRestStyle(doc) {
  if (doc.querySelector(`style[${MOTION_REST_STYLE_ATTR}]`)) return
  const style = doc.createElement('style')
  style.setAttribute(MOTION_REST_STYLE_ATTR, '')
  // Both markers: one is what serializeDocument already strips, the other is
  // what this module looks itself up by.
  style.setAttribute('data-pwb-chrome', '')
  style.textContent = MOTION_REST_CSS
  doc.head?.appendChild(style)
}

/** Show every element an unrun reveal left invisible. Returns how many, so the
 * editor can say what it did instead of silently changing the page. */
export function applyMotionRest(doc) {
  if (!doc?.body) return 0
  const win = doc.defaultView
  if (!win) return 0
  ensureRestStyle(doc)
  let count = 0
  for (const el of doc.body.querySelectorAll('*')) {
    if (el.hasAttribute(MOTION_REST_ATTR)) { count += 1; continue }
    if (!hiddenByMotion(el, win)) continue
    el.setAttribute(MOTION_REST_ATTR, '')
    count += 1
  }
  return count
}

/** Put the page back the way the file describes it — the raw truth, including
 * whatever stays invisible without its script. */
export function clearMotionRest(doc) {
  if (!doc) return
  doc.querySelectorAll(`style[${MOTION_REST_STYLE_ATTR}]`).forEach((el) => el.remove())
  doc.querySelectorAll(`[${MOTION_REST_ATTR}]`).forEach((el) => el.removeAttribute(MOTION_REST_ATTR))
}

// ---------------------------------------------------------------------------
// Giving an element in an uploaded page one of the builder's own animations
// ---------------------------------------------------------------------------
//
// Nothing is injected into the document to make this play. Both places an HTML
// page is actually shown already carry the motion stylesheet and the reveal
// observer — the editor's View mode through withBuilderRuntimeHtml, the
// published page through withBuilderInteractiveHtml. So the whole job is to
// write the contract those two read: `data-anim-in` for the entrance,
// `pwb-hover pwb-hover-*` for the hover, and the two custom properties for
// speed. That is also why nothing here needs stripping on save: the attribute
// IS the user's choice, and it belongs in their file.

const HOVER_CLASS_PREFIX = 'pwb-hover-'
const SPEED_MS = { fast: 450, normal: 750, slow: 1150 }

/** What motion this element already carries, in the same shape the panel uses. */
export function readElementMotion(el) {
  if (!el || el.nodeType !== 1) return { animIn: 'none', animHover: 'none', animSpeed: 'normal' }
  const hover = [...el.classList].find((name) => name.startsWith(HOVER_CLASS_PREFIX))
  const duration = Number.parseInt(el.style.getPropertyValue('--pwb-anim-dur'), 10)
  const speed = Object.keys(SPEED_MS).find((key) => SPEED_MS[key] === duration) || 'normal'
  return {
    animIn: el.getAttribute('data-anim-in') || 'none',
    animHover: hover ? hover.slice(HOVER_CLASS_PREFIX.length) : 'none',
    animSpeed: speed,
  }
}

/** Apply (or clear, with 'none') an entrance and/or a hover effect. Only the
 * keys present in the patch are touched, so setting a hover never disturbs an
 * entrance that is already there. */
export function applyElementMotion(el, patch = {}) {
  if (!el || el.nodeType !== 1) return
  if ('animIn' in patch) {
    const reveal = patch.animIn
    if (!reveal || reveal === 'none') {
      el.removeAttribute('data-anim-in')
      el.style.removeProperty('--pwb-anim-dur')
      el.style.removeProperty('--pwb-anim-delay')
    } else {
      el.setAttribute('data-anim-in', reveal)
    }
  }
  if ('animSpeed' in patch && el.hasAttribute('data-anim-in')) {
    const ms = SPEED_MS[patch.animSpeed] || SPEED_MS.normal
    el.style.setProperty('--pwb-anim-dur', `${ms}ms`)
  }
  if ('animHover' in patch) {
    for (const name of [...el.classList]) {
      if (name.startsWith(HOVER_CLASS_PREFIX)) el.classList.remove(name)
    }
    const hover = patch.animHover
    if (!hover || hover === 'none') el.classList.remove('pwb-hover')
    else el.classList.add('pwb-hover', `${HOVER_CLASS_PREFIX}${hover}`)
  }
  // An empty style attribute left behind reads as a change in the saved file.
  if (el.getAttribute('style') === '') el.removeAttribute('style')
  if (el.getAttribute('class') === '') el.removeAttribute('class')
}
