// Motion: scroll-reveal entrances + hover effects for any component.
//
// ONE source of truth, because the bar/section/etc. is drawn by three renderers
// and every time a rule was written out more than once in this codebase it
// drifted, so the editor promised something the published page didn't do. Motion
// lives entirely in the EXPORT layer: the stylesheet + observer below are
// injected by builderInteractiveTags, and the two exporters tag elements with
// the classes/attrs these helpers produce. The edit canvas stays still (no
// hover jiggle while dragging); the in-app View and the published page both
// render the export, so switching to "View" is how you preview the animation.

export const REVEAL_TYPES = ['none', 'fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'zoom']
export const HOVER_TYPES = ['none', 'lift', 'grow', 'glow']
export const SPEED_TYPES = ['fast', 'normal', 'slow']

const SPEED_MS = { fast: 450, normal: 750, slow: 1150 }
const MAX_DELAY = 3000

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

// The normalized motion for a component, or null when it has none — or when it
// is pinned. A fixed/sticky bar is positioned by the runtime through an inline
// transform, which would fight a reveal/hover transform and win, so motion is
// simply not offered there (and "a navbar that fades in on scroll" is nonsense).
export function resolveMotion(props) {
  if (!props || props.scrollBehavior === 'fixed' || props.scrollBehavior === 'sticky') return null
  const reveal = oneOf(props.animIn, REVEAL_TYPES, 'none')
  const hover = oneOf(props.animHover, HOVER_TYPES, 'none')
  if (reveal === 'none' && hover === 'none') return null
  const speed = oneOf(props.animSpeed, SPEED_TYPES, 'normal')
  const delayRaw = Number(props.animDelay)
  const delay = Number.isFinite(delayRaw) ? Math.min(MAX_DELAY, Math.max(0, Math.round(delayRaw))) : 0
  return { reveal, hover, durationMs: SPEED_MS[speed], delayMs: delay }
}

// Classes appended to the element's class attribute (leading space, so it can be
// concatenated straight onto an existing class). Hover only — reveal is driven
// by the data attribute + observer, not a class.
export function motionClassSuffix(props) {
  const m = resolveMotion(props)
  if (!m || m.hover === 'none') return ''
  return ` pwb-hover pwb-hover-${m.hover}`
}

// The reveal attribute for the observer (leading space), e.g. ` data-anim-in="fade-up"`.
export function motionRevealAttr(props) {
  const m = resolveMotion(props)
  return m && m.reveal !== 'none' ? ` data-anim-in="${m.reveal}"` : ''
}

// Per-component CSS custom properties folded into the element's own `.c-<id>`
// rule, so the reveal transition reads the chosen speed and delay.
export function motionCssVars(props) {
  const m = resolveMotion(props)
  if (!m || m.reveal === 'none') return {}
  return { '--pwb-anim-dur': `${m.durationMs}ms`, '--pwb-anim-delay': `${m.delayMs}ms` }
}

// True when a page carries ANY motion (reveal or hover), so the in-app View and
// the published page route through the export iframe — where both the motion
// stylesheet and the reveal observer live — instead of the plain React
// renderer, which carries neither. That routing is what makes motion play.
export function pageHasMotion(page) {
  const walk = (arr) =>
    (arr || []).some((c) => resolveMotion(c?.props) || (Array.isArray(c?.children) && walk(c.children)))
  return walk(page?.components)
}

export const MOTION_CSS = `
[data-anim-in]{opacity:0;transition:opacity var(--pwb-anim-dur,750ms) cubic-bezier(.16,.84,.44,1),transform var(--pwb-anim-dur,750ms) cubic-bezier(.16,.84,.44,1);transition-delay:var(--pwb-anim-delay,0ms);will-change:opacity,transform}
[data-anim-in="fade-up"]{transform:translateY(28px)}
[data-anim-in="fade-down"]{transform:translateY(-28px)}
[data-anim-in="slide-left"]{transform:translateX(32px)}
[data-anim-in="slide-right"]{transform:translateX(-32px)}
[data-anim-in="zoom"]{transform:scale(.92)}
[data-anim-in].pwb-in{opacity:1;transform:none}
.pwb-hover{transition:transform .28s ease,box-shadow .28s ease,filter .28s ease}
.pwb-hover-lift:hover{transform:translateY(-6px);box-shadow:0 16px 34px rgba(15,23,42,.18)}
.pwb-hover-grow:hover{transform:scale(1.035)}
.pwb-hover-glow:hover{box-shadow:0 0 0 3px rgba(79,70,229,.35),0 12px 30px rgba(79,70,229,.25)}
@media (prefers-reduced-motion:reduce){[data-anim-in]{opacity:1 !important;transform:none !important;transition:none !important}.pwb-hover:hover{transform:none !important}}
`.trim()

// Reveals each tagged element the first time it scrolls into view. Idempotent
// and dependency-free; degrades to "show everything" without IntersectionObserver.
export const MOTION_OBSERVER_JS = `
(function(){
  var els=document.querySelectorAll('[data-anim-in]');
  if(!els.length)return;
  if(!('IntersectionObserver' in window)){for(var i=0;i<els.length;i++)els[i].classList.add('pwb-in');return;}
  var io=new IntersectionObserver(function(entries){
    for(var i=0;i<entries.length;i++){if(entries[i].isIntersecting){entries[i].target.classList.add('pwb-in');io.unobserve(entries[i].target);}}
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  for(var j=0;j<els.length;j++)io.observe(els[j]);
})();
`.trim()
