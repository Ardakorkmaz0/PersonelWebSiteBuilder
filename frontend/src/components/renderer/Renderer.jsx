// Turns schema components into real React components on a free canvas: each
// component is absolutely positioned by its layout { x, y, w, h } and fills its
// box. Shared by the editor canvas and the public preview so output is identical.
//
// `viewport` selects which breakpoint to render: 'pc' uses each component's
// `layout`, 'mobile' uses its independently-designed `mobileLayout`. Components
// hidden on the active breakpoint are skipped.
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import { sanitizeStyles, sanitizeUrl } from '../../utils/sanitize.js'
import {
  canvasHeight,
  flowCanvasHeight,
  flowGap,
  flowItemStyle,
  flowSidePad,
  isHidden,
  layoutFor,
} from './layout.js'

const FULL_BLEED_TYPES = ['navbar', 'section', 'divider']
// Components that can optionally be wrapped in a link (like you can in plain HTML).
export const LINKABLE_TYPES = new Set([
  'heading', 'text', 'image', 'card', 'badge', 'icon',
])

export function RenderComponent({ component, flowMode = false, viewport = 'pc' }) {
  const def = registry[component.type]
  if (!def) return null
  const Comp = def.Render
  const fixedFlow = flowMode && ['image', 'divider', 'spacer'].includes(component.type)
  const style = {
    width: '100%',
    ...(flowMode ? (fixedFlow ? { height: '100%' } : { minHeight: '100%' }) : { height: '100%' }),
    boxSizing: 'border-box',
    overflow: flowMode ? 'visible' : 'hidden',
    ...sanitizeStyles(component.styles),
  }
  // In flow, full-bleed bands (navbar/section/divider) keep an edge-to-edge
  // background but center their CONTENT at the component's Max width (layout.w),
  // so "Max width" actually does something on these blocks.
  const contentWidth =
    flowMode && FULL_BLEED_TYPES.includes(component.type)
      ? Math.round(component.layout?.w || 0) || undefined
      : undefined
  const el = (
    <Comp
      props={component.props || {}}
      style={style}
      viewport={viewport}
      contentWidth={contentWidth}
    />
  )
  // Optional link wrapper: `display:contents` keeps the layout identical while
  // making the whole component clickable, just like wrapping any element in <a>.
  const href = LINKABLE_TYPES.has(component.type)
    ? sanitizeUrl(component.props?.href)
    : ''
  if (href) {
    const ext = /^https?:\/\//i.test(href)
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {}
    return (
      <a href={href} style={{ display: 'contents' }} {...ext}>
        {el}
      </a>
    )
  }
  return el
}

export function Renderer({
  components,
  width,
  background = '#ffffff',
  viewport = 'pc',
  flowMode = false,
  fluid = false,
}) {
  const list = Array.isArray(components) ? components : []
  const canvasW = width || (viewport === 'mobile' ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH)
  const sidePad = flowSidePad(viewport)
  if (flowMode) {
    return (
      <div
        style={{
          // `fluid` (used by the static export) makes the flow fill its parent so
          // it reflows at any width with no horizontal overflow; otherwise the
          // container is the fixed artboard/design width used by the editor.
          width: fluid ? '100%' : canvasW,
          minHeight: flowCanvasHeight(list, viewport, canvasW),
          padding: `0 ${sidePad}px`,
          boxSizing: 'border-box',
          margin: '0 auto',
          background,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          alignContent: 'flex-start',
          justifyContent: 'flex-start',
          gap: flowGap(viewport),
        }}
      >
        {list.map((c) => {
          if (isHidden(c, viewport)) return null
          return (
            <div key={c.id} style={flowItemStyle(c, viewport, canvasW)}>
              <RenderComponent component={c} flowMode viewport={viewport} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: canvasW,
        minHeight: canvasHeight(list, viewport),
        margin: '0 auto',
        background,
      }}
    >
      {list.map((c) => {
        if (isHidden(c, viewport)) return null
        const l = layoutFor(c, viewport) || {}
        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: l.x || 0,
              top: l.y || 0,
              width: l.w || 200,
              height: l.h || 80,
            }}
          >
            <RenderComponent component={c} viewport={viewport} />
          </div>
        )
      })}
    </div>
  )
}
