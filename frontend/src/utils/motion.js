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
// SAFETY FIRST: an element stuck at opacity:0 is content the visitor cannot see,
// so the hidden start state is opt-in — it only applies under `.pwb-anim-armed`.
// With no JS at all nothing is ever hidden and the page reads exactly as it would
// without motion.
//
// Arms the hidden start state, in <head>, BEFORE the body paints.
//
// This has to run early. If the page first paints with the content visible and
// only then gets hidden, you see a flash; worse, if the hidden state and the
// reveal land in the same frame the browser has no "from" frame to animate from
// and skips the transition entirely — the element simply appears, which reads as
// "the animation does nothing".
//
// It also carries its own failsafe: if the observer script never runs (blocked,
// stripped, a parse error further down the page) nothing would ever reveal the
// content, so after 3s an unclaimed arm disarms itself and the page shows.
export const MOTION_ARM_JS = `
(function(){
  var d=document.documentElement;
  d.className+=' pwb-anim-armed';
  setTimeout(function(){
    if(!window.__pwbMotion)d.className=d.className.replace(' pwb-anim-armed','');
  },3000);
})();
`.trim()

export const MOTION_OBSERVER_JS = `
(function(){
  window.__pwbMotion=1;
  var els=[].slice.call(document.querySelectorAll('[data-anim-in]'));
  var root=document.documentElement;
  function disarm(){root.className=root.className.replace(' pwb-anim-armed','');}
  if(!els.length){disarm();return;}
  // Reveal on a LATER frame than the one that painted the armed state, so the
  // browser has two distinct frames to interpolate between. Adding both in one
  // frame is exactly what makes a transition silently not play.
  function show(el){
    if(el.__pwbShown)return;
    el.__pwbShown=1;
    var done=false;
    function add(){if(done)return;done=true;el.classList.add('pwb-in');}
    if(window.requestAnimationFrame){
      requestAnimationFrame(function(){requestAnimationFrame(add);});
      // requestAnimationFrame is throttled to a standstill in a background tab
      // or a hidden frame, and content that never reveals is worse than content
      // that reveals without animating. The timer is only a failsafe: a visible
      // page paints its next frame in ~16ms, long before this fires.
      setTimeout(add,400);
    } else add();
  }
  if(!('IntersectionObserver' in window)){disarm();return;}
  if(root.className.indexOf('pwb-anim-armed')<0)root.className+=' pwb-anim-armed';
  var io=new IntersectionObserver(function(entries){
    for(var i=0;i<entries.length;i++){var e=entries[i];if(e.isIntersecting){show(e.target);io.unobserve(e.target);}}
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  for(var j=0;j<els.length;j++)io.observe(els[j]);
  // Safety sweep — the observer is not trusted on its own.
  //
  // It evaluates once, immediately, and inside a preview pane that is still
  // sizing itself (or a host that rescales the page after load) that first look
  // can land on a layout where nothing intersects; it then has no reason to fire
  // again and the element stays invisible. Some embedding contexts never deliver
  // its callbacks at all. So the same check runs by hand on load, on scroll and
  // on resize: reveal whatever is on screen, plus anything on a page that cannot
  // scroll, since scrolling could never bring it into view.
  var pending=els.slice();
  function sweep(){
    if(!pending.length)return;
    var vh=window.innerHeight||root.clientHeight||0;
    var docH=Math.max(root.scrollHeight||0,(document.body&&document.body.scrollHeight)||0);
    var scrollable=docH>vh+4;
    var rest=[];
    for(var i=0;i<pending.length;i++){
      var el=pending[i];
      var r=el.getBoundingClientRect();
      var onScreen=r.top<vh&&r.bottom>0&&(r.width>0||r.height>0);
      if(onScreen||!scrollable){show(el);io.unobserve(el);}
      else rest.push(el);
    }
    pending=rest;
    if(!pending.length)detach();
  }
  function detach(){
    window.removeEventListener('scroll',sweep,true);
    window.removeEventListener('resize',sweep);
  }
  if(document.readyState==='complete')setTimeout(sweep,120);
  else window.addEventListener('load',function(){setTimeout(sweep,120);});
  // Capture phase so a page that scrolls an inner container, not the window,
  // still reports — the export wraps its page in its own scrolling viewport.
  window.addEventListener('scroll',sweep,true);
  window.addEventListener('resize',sweep);
  setTimeout(sweep,900);
})();
`.trim()

// Head payload: the motion stylesheet plus the arming script, so the hidden
// start state exists and is painted before any content appears. The observer
// itself still ships at the end of <body>, where the elements exist.
export function motionHeadTags() {
  return `<style data-builder-motion-style>${MOTION_CSS}</style><script data-builder-motion-arm>${MOTION_ARM_JS}</scr` + `ipt>`
}
