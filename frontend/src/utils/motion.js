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

export const REVEAL_TYPES = [
  'none',
  'fade', 'fade-up', 'fade-down',
  'slide-left', 'slide-right',
  'zoom', 'zoom-out',
  'flip', 'rotate', 'blur', 'bounce', 'wipe',
]
export const HOVER_TYPES = ['none', 'lift', 'grow', 'glow', 'sink', 'tilt']
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
[data-anim-in]{transition:opacity var(--pwb-anim-dur,750ms) var(--pwb-anim-ease,cubic-bezier(.16,.84,.44,1)),transform var(--pwb-anim-dur,750ms) var(--pwb-anim-ease,cubic-bezier(.16,.84,.44,1)),filter var(--pwb-anim-dur,750ms) ease,clip-path var(--pwb-anim-dur,750ms) ease;transition-delay:var(--pwb-anim-delay,0ms);will-change:opacity,transform}
.pwb-anim-armed [data-anim-in]{opacity:0}
.pwb-anim-armed [data-anim-in="fade-up"]{transform:translateY(28px)}
.pwb-anim-armed [data-anim-in="fade-down"]{transform:translateY(-28px)}
.pwb-anim-armed [data-anim-in="slide-left"]{transform:translateX(32px)}
.pwb-anim-armed [data-anim-in="slide-right"]{transform:translateX(-32px)}
.pwb-anim-armed [data-anim-in="zoom"]{transform:scale(.92)}
.pwb-anim-armed [data-anim-in="zoom-out"]{transform:scale(1.09)}
.pwb-anim-armed [data-anim-in="flip"]{transform:perspective(900px) rotateX(16deg);transform-origin:top center}
.pwb-anim-armed [data-anim-in="rotate"]{transform:rotate(-5deg) scale(.94)}
.pwb-anim-armed [data-anim-in="blur"]{filter:blur(12px)}
.pwb-anim-armed [data-anim-in="bounce"]{transform:translateY(30px)}
[data-anim-in="bounce"]{--pwb-anim-ease:cubic-bezier(.22,1.4,.36,1)}
/* Wipe reveals by uncovering, so it stays opaque and only its clip animates. */
.pwb-anim-armed [data-anim-in="wipe"]{opacity:1;clip-path:inset(0 100% 0 0)}
[data-anim-in].pwb-in{opacity:1;transform:none;filter:none}
[data-anim-in="wipe"].pwb-in{clip-path:inset(0)}
.pwb-hover{transition:transform .28s ease,box-shadow .28s ease,filter .28s ease}
.pwb-hover-lift:hover{transform:translateY(-6px);box-shadow:0 16px 34px rgba(15,23,42,.18)}
.pwb-hover-grow:hover{transform:scale(1.035)}
.pwb-hover-glow:hover{box-shadow:0 0 0 3px rgba(79,70,229,.35),0 12px 30px rgba(79,70,229,.25)}
.pwb-hover-sink:hover{transform:translateY(4px) scale(.985);box-shadow:0 4px 10px rgba(15,23,42,.14)}
.pwb-hover-tilt:hover{transform:perspective(900px) rotateX(6deg) rotateY(-6deg)}
@media (prefers-reduced-motion:reduce){[data-anim-in]{opacity:1 !important;transform:none !important;filter:none !important;clip-path:none !important;transition:none !important}.pwb-hover:hover{transform:none !important}}
`.trim()

// Reveals each tagged element the first time it scrolls into view.
//
// SAFETY FIRST: an element that starts at opacity:0 and never gets revealed is
// content the visitor simply cannot see, so the hidden start state is opt-in —
// it only applies under `.pwb-anim-armed`, which this script adds. If the script
// never runs (no JS, a CSP block, a parse error), nothing is ever hidden and the
// page reads exactly as it would without motion.
//
// Arming happens synchronously before first paint (this script is parser-blocking
// at the end of <body>), so there is no flash of un-animated content.
//
// The observer's first callback reports EVERY observed element, so silence means
// the observer can never fire here (a clipped or zero-size scroll context — which
// is how a preview pane can differ from a real page). In that case we disarm and
// show everything rather than leave the page blank.
export const MOTION_OBSERVER_JS = `
(function(){
  var els=[].slice.call(document.querySelectorAll('[data-anim-in]'));
  if(!els.length)return;
  var root=document.documentElement;
  function show(el){el.classList.add('pwb-in');}
  function showAll(){for(var i=0;i<els.length;i++)show(els[i]);}
  if(!('IntersectionObserver' in window)){showAll();return;}
  root.classList.add('pwb-anim-armed');
  var io=new IntersectionObserver(function(entries){
    for(var i=0;i<entries.length;i++){var e=entries[i];if(e.isIntersecting){show(e.target);io.unobserve(e.target);}}
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  for(var j=0;j<els.length;j++)io.observe(els[j]);
  // Safety sweep. The observer evaluates once, immediately — and inside a
  // preview pane that is still sizing itself (or a host that scales the page
  // after load) that first look can happen against a layout where nothing
  // intersects. The observer then has no reason to fire again and the element
  // stays invisible: content the visitor cannot see. So re-check by hand once
  // the layout has settled, and reveal anything that either IS on screen or
  // could never be scrolled to because the page does not scroll at all.
  function sweep(){
    var vh=window.innerHeight||root.clientHeight||0;
    var docH=Math.max(root.scrollHeight||0,(document.body&&document.body.scrollHeight)||0);
    var scrollable=docH>vh+4;
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el.className.indexOf('pwb-in')>-1)continue;
      var r=el.getBoundingClientRect();
      var onScreen=r.top<vh&&r.bottom>0&&(r.width>0||r.height>0);
      if(onScreen||!scrollable){show(el);io.unobserve(el);}
    }
  }
  if(document.readyState==='complete')setTimeout(sweep,120);
  else window.addEventListener('load',function(){setTimeout(sweep,120);});
  window.addEventListener('resize',sweep);
  setTimeout(sweep,900);
})();
`.trim()
