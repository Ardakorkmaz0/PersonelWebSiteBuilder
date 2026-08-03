// The canvas spotlight: one component, alone, at a real width.
//
// Same idea as the HTML one, different subject. A component is not a DOM node
// you can lift out — it is a schema entry the canvas draws — so the preview
// runs the SAME renderer the canvas and the published page use, on a
// one-component page. Anything else would be a second opinion about how a
// component looks, and this project already has three renderers to keep in
// agreement without inventing a fourth.

import SpotlightShell from './SpotlightShell.jsx'
import PropertiesPanel from './PropertiesPanel.jsx'
import { Renderer } from '../renderer/Renderer.jsx'
import { useLanguage } from '../../i18n/useLanguage.js'
import { selectCurrentPage, useEditorStore } from '../../store/editorStore.js'
import { registry } from '../registry.jsx'

function findById(components, id) {
  for (const c of components || []) {
    if (c.id === id) return c
    const deep = findById(c.children, id)
    if (deep) return deep
  }
  return null
}

export default function ComponentSpotlight({ open, componentId, onClose }) {
  const { t } = useLanguage()
  const viewport = useEditorStore((state) => state.viewport)
  const page = useEditorStore(selectCurrentPage)
  const component = findById(page?.components, componentId)

  if (!open || !component) return null

  const isMobile = viewport === 'mobile'
  const layout = (isMobile ? component.mobileLayout || component.layout : component.layout) || {}
  const background = (isMobile ? page.backgroundMobile || page.background : page.background) || '#ffffff'

  return (
    <SpotlightShell
      open={open}
      onClose={onClose}
      initialWidth={isMobile ? 'phone' : 'desktop'}
      title={t(registry[component.type]?.label || component.type)}
      subtitle={component.type}
      caption={(width) => t('Rendered with the site’s own theme at {width}px.', { width })}
      renderPreview={(width) => {
        // The component is drawn at the top-left of its own page rather than
        // wherever it sits on the canvas: this is a look at the component, not
        // at its position. Its size is its own.
        const solo = {
          ...component,
          layout: { ...layout, x: 0, y: 0 },
          mobileLayout: { ...layout, x: 0, y: 0 },
          // A component hidden on this breakpoint would render to nothing —
          // and an empty spotlight looks like a bug rather than a setting.
          hidden: false,
          hiddenMobile: false,
        }
        const height = Math.max(120, Math.round(layout.h || 200) + 48)
        return (
          <div
            className="overflow-hidden rounded-xl"
            style={{ width: '100%', height, background }}
          >
            <Renderer
              components={[solo]}
              width={width}
              designWidth={width}
              background={background}
              viewport={viewport}
              flowMode={!!page.flowMode}
            />
          </div>
        )
      }}
      panel={<PropertiesPanel />}
    />
  )
}
