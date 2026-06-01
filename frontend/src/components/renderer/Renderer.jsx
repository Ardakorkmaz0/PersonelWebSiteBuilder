// Turns schema components into real React components on a free canvas: each
// component is absolutely positioned by its layout { x, y, w, h } and fills its
// box. Shared by the editor canvas and the public preview so output is identical.
//
// `viewport` selects which breakpoint to render: 'pc' uses each component's
// `layout`, 'mobile' uses its independently-designed `mobileLayout`. Components
// hidden on the active breakpoint are skipped.
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import { sanitizeStyles } from '../../utils/sanitize.js'
import {
  canvasHeight,
  flowCanvasHeight,
  flowGap,
  flowItemStyle,
  flowSidePad,
  isHidden,
  layoutFor,
} from './layout.js'

export function RenderComponent({ component, flowMode = false }) {
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
  return <Comp props={component.props || {}} style={style} />
}

export function Renderer({
  components,
  width,
  background = '#ffffff',
  viewport = 'pc',
  flowMode = false,
}) {
  const list = Array.isArray(components) ? components : []
  const canvasW = width || (viewport === 'mobile' ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH)
  const sidePad = flowSidePad(viewport)
  if (flowMode) {
    return (
      <div
        style={{
          width: canvasW,
          minHeight: flowCanvasHeight(list, viewport, canvasW),
          padding: `0 ${sidePad}px`,
          boxSizing: 'border-box',
          margin: '0 auto',
          background,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          gap: flowGap(viewport),
        }}
      >
        {list.map((c) => {
          if (isHidden(c, viewport)) return null
          return (
            <div key={c.id} style={flowItemStyle(c, viewport, canvasW)}>
              <RenderComponent component={c} flowMode />
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
            <RenderComponent component={c} />
          </div>
        )
      })}
    </div>
  )
}
