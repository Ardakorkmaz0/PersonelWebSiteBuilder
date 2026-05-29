// Turns schema components into real React components on a free canvas: each
// component is absolutely positioned by its layout { x, y, w, h } and fills its
// box. Shared by the editor canvas and the public preview so output is identical.
//
// `viewport` selects which breakpoint to render: 'pc' uses each component's
// `layout`, 'mobile' uses its independently-designed `mobileLayout`. Components
// hidden on the active breakpoint are skipped.
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import { sanitizeStyles } from '../../utils/sanitize.js'
import { canvasHeight, isHidden, layoutFor } from './layout.js'

export function RenderComponent({ component }) {
  const def = registry[component.type]
  if (!def) return null
  const Comp = def.Render
  const style = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    ...sanitizeStyles(component.styles),
  }
  return <Comp props={component.props || {}} style={style} />
}

export function Renderer({ components, width, background = '#ffffff', viewport = 'pc' }) {
  const list = Array.isArray(components) ? components : []
  const canvasW = width || (viewport === 'mobile' ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH)
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
