// Auto-layout for containers: instead of the free mini-canvas (children pinned
// by x/y), a container can FLOW its children as a flex column/row or a grid —
// so they reflow responsively on any screen instead of overflowing a fixed
// absolute layout. Opt-in via props.flow; absent/'free' keeps the classic
// absolute container, so existing saved projects are untouched.
//
// One source of truth for the container box style AND each child's wrapper
// style, shared by the renderer, the editor canvas and the HTML export.

const FLOW_MODES = new Set(['column', 'row', 'grid'])

// Content types hug their own height (auto + min-height) so nothing clips when
// text wraps or a control opens; the rest keep their designed height.
const FIXED_HEIGHT_TYPES = new Set([
  'image', 'divider', 'spacer', 'button', 'linkbutton', 'badge', 'icon',
])

const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
}
const ALIGN = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

function num(value, def, lo, hi) {
  const n = Number(value)
  if (!Number.isFinite(n)) return def
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function isAutoLayout(props) {
  return !!props && FLOW_MODES.has(props.flow)
}

// Container box style (React camelCase). Null when the container is free.
export function autoLayoutContainerStyle(props) {
  if (!isAutoLayout(props)) return null
  const gap = `${num(props.gap, 16, 0, 200)}px`
  const align = ALIGN[props.align] || 'stretch'
  if (props.flow === 'grid') {
    const cols = num(props.cols, 3, 1, 12)
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap,
      alignItems: align,
    }
  }
  return {
    display: 'flex',
    flexDirection: props.flow === 'row' ? 'row' : 'column',
    gap,
    justifyContent: JUSTIFY[props.justify] || 'flex-start',
    alignItems: align,
    flexWrap: props.wrap ? 'wrap' : 'nowrap',
  }
}

// Per-child wrapper style so a child sizes sensibly in the flow. Null when free.
export function autoLayoutChildStyle(child, props) {
  if (!isAutoLayout(props)) return null
  const l = child?.layout || {}
  const w = Math.max(1, Math.round(l.w || 200))
  const h = Math.max(1, Math.round(l.h || 80))
  const grows = !FIXED_HEIGHT_TYPES.has(child?.type)
  const heightStyle = grows
    ? { height: 'auto', minHeight: `${h}px` }
    : { height: `${h}px` }

  if (props.flow === 'grid') {
    return { width: '100%', minWidth: 0, ...heightStyle }
  }
  if (props.flow === 'row') {
    // Row: keep each child's designed width; it may shrink but not grow.
    return { flex: '0 1 auto', width: `${w}px`, maxWidth: '100%', minWidth: 0, ...heightStyle }
  }
  // Column: stretch fills the width, any other alignment keeps the designed one.
  return {
    flexShrink: 0,
    width: props.align === 'stretch' ? '100%' : `${w}px`,
    maxWidth: '100%',
    ...heightStyle,
  }
}

// Inline CSS string for the HTML export (kebab-case). '' when free.
export function autoLayoutContainerCss(props) {
  return styleToCss(autoLayoutContainerStyle(props))
}
export function autoLayoutChildCss(child, props) {
  return styleToCss(autoLayoutChildStyle(child, props))
}

function styleToCss(style) {
  if (!style) return ''
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(';')
}
