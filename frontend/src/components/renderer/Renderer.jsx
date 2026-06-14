// Turns schema components into real React components on a free canvas: each
// component is absolutely positioned by its layout { x, y, w, h } and fills its
// box. Shared by the editor canvas and the public preview so output is identical.
//
// `viewport` selects which breakpoint to render: 'pc' uses each component's
// `layout`, 'mobile' uses its independently-designed `mobileLayout`. Components
// hidden on the active breakpoint are skipped.
import { useState } from 'react'
import { registry, CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../registry.jsx'
import { sanitizeStyles, sanitizeUrl } from '../../utils/sanitize.js'
import { FULL_BLEED_TYPES, NON_WRAP_LINK_TYPES, TAB_STYLES } from './constants.js'
import {
  absoluteChildrenHeight,
  canvasHeight,
  flowCanvasHeight,
  flowGap,
  flowItemStyle,
  flowSidePad,
  isHidden,
  layoutFor,
} from './layout.js'

function TabsRender({ component, style, viewport }) {
  const p = component.props || {}
  const tabs = Array.isArray(p.tabs) && p.tabs.length
    ? p.tabs.filter((t) => t && t.id)
    : [{ id: 't1', label: 'Tab' }]
  // The editor passes a controlled activeId via props (so PropertiesPanel can
  // drive it). The public renderer falls back to local state so visitors can
  // click between tabs without any JS shim.
  const initial = tabs.some((t) => t.id === p.activeId) ? p.activeId : tabs[0].id
  const [localActive, setLocalActive] = useState(null)
  const activeId =
    component._designTabId ||
    (tabs.some((t) => t.id === localActive) ? localActive : initial)
  const kids = Array.isArray(component.children) ? component.children : []
  const tablistStyle = {
    ...TAB_STYLES.tablist,
    gap: p.tabGap || TAB_STYLES.tablist.gap,
    background: p.tablistBackgroundColor || 'transparent',
    borderBottom: `1px solid ${p.tablistBorderColor || '#e5e7eb'}`,
    padding: p.tablistPadding || TAB_STYLES.tablist.padding,
  }
  const tabBaseStyle = {
    ...TAB_STYLES.tab,
    background: p.tabBackgroundColor || 'transparent',
    color: p.tabTextColor || TAB_STYLES.tab.color,
    borderRadius: p.tabBorderRadius || 0,
    padding: p.tabPadding || TAB_STYLES.tab.padding,
  }
  const tabActiveStyle = {
    ...TAB_STYLES.tabActive,
    background: p.activeTabBackgroundColor || p.tabBackgroundColor || 'transparent',
    color: p.activeTabColor || TAB_STYLES.tabActive.color,
    borderBottomColor: p.activeTabBorderColor || TAB_STYLES.tabActive.borderBottomColor,
  }
  const panelStyle = {
    ...TAB_STYLES.panel,
    background: p.panelBackgroundColor || 'transparent',
    border: `1px solid ${p.panelBorderColor || 'transparent'}`,
    borderRadius: p.panelBorderRadius || 0,
    padding: p.panelPadding || 0,
    boxSizing: 'border-box',
  }

  return (
    <div
      data-builder-tabs={component.id}
      style={{ ...style, display: 'flex', flexDirection: 'column', overflow: 'visible' }}
    >
      <div role="tablist" style={tablistStyle}>
        {tabs.map((t) => {
          const sel = t.id === activeId
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sel ? 'true' : 'false'}
              data-builder-tab={t.id}
              data-target={component.id}
              onClick={(e) => {
                e.preventDefault()
                if (!component._designTabId) setLocalActive(t.id)
                if (component._onSelectTab) component._onSelectTab(t.id)
              }}
              style={{
                ...tabBaseStyle,
                ...(sel ? tabActiveStyle : null),
              }}
            >
              {t.label || 'Tab'}
            </button>
          )
        })}
      </div>
      {tabs.map((t) => {
        const sel = t.id === activeId
        const panelKids = kids.filter((c) => {
          const id = c.props?.tabId || c.tabId || tabs[0].id
          return id === t.id
        })
        const panelHeight = absoluteChildrenHeight(panelKids, 120)
        return (
          <div
            key={t.id}
            role="tabpanel"
            data-builder-panel={t.id}
            hidden={!sel}
            style={{
              ...panelStyle,
              display: sel ? 'block' : 'none',
              position: 'relative',
              minHeight: panelHeight,
            }}
          >
            {panelKids.map((c) =>
              isHidden(c, viewport) ? null : (() => {
                const l = c.layout || {}
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
              })(),
            )}
          </div>
        )
      })}
    </div>
  )
}

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

  // Tabs: header strip + one panel per tab. In the public renderer (no
  // designActiveId override), the first tab is shown and the rest carry `hidden`
  // so the static JS shim can toggle them. The editor passes `designActiveId`
  // to drive selection from React state.
  if (component.type === 'tabs') {
    return <TabsRender component={component} style={style} viewport={viewport} />
  }

  // A container is a nested mini-canvas: children keep their own x/y/w/h inside
  // the container, matching the editor and exported HTML.
  if (component.type === 'container') {
    const kids = Array.isArray(component.children) ? component.children : []
    const minHeight = absoluteChildrenHeight(kids, Math.round(component.layout?.h || 160))
    return (
      <div
        style={{
          ...style,
          overflow: sanitizeStyles(component.styles).overflow || 'visible',
          display: 'block',
          position: 'relative',
          minHeight,
        }}
      >
        {kids.map((c) => {
          if (isHidden(c, viewport)) return null
          const l = c.layout || {}
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
  // ANY component can carry a link except the ones that are already anchors or
  // are interactive (they handle their own clicks / nested links).
  const href = !NON_WRAP_LINK_TYPES.has(component.type)
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
            // id lets in-page links (#componentId) scroll to this component.
            <div key={c.id} id={c.id} style={flowItemStyle(c, viewport, canvasW)}>
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
            // id lets in-page links (#componentId) scroll to this component.
            id={c.id}
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
