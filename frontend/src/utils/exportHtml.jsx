import { renderToStaticMarkup } from 'react-dom/server'
import { Renderer } from '../components/renderer/Renderer.jsx'
import { CANVAS_WIDTH, MOBILE_CANVAS_WIDTH } from '../components/registry.jsx'

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  )
}

// Serialize the design to a standalone HTML document. Emits BOTH the desktop and
// the (independent) mobile layout, swapped by a media query at 768px, so the
// exported file behaves like the live public page. Reuses the shared Renderer so
// the markup is identical to the editor canvas.
export function schemaToHtml(schema, title = 'My Site') {
  const page = schema?.pages?.[0] || {}
  const components = page.components || []
  const bg = page.background || '#ffffff'
  const bgMobile = page.backgroundMobile || bg

  const flow = !!page.flowMode
  const desktop = renderToStaticMarkup(
    <Renderer
      components={components}
      viewport="pc"
      width={page.canvasWidth || CANVAS_WIDTH}
      background={bg}
      flowMode={flow}
      fluid={flow}
    />,
  )
  const mobile = renderToStaticMarkup(
    <Renderer
      components={components}
      viewport="mobile"
      width={page.mobileWidth || MOBILE_CANVAS_WIDTH}
      background={bgMobile}
      flowMode={flow}
      fluid={flow}
    />,
  )

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: system-ui, 'Segoe UI', Roboto, sans-serif; }
      .site-mobile { display: none; }
      @media (max-width: 768px) {
        .site-desktop { display: none; }
        .site-mobile { display: block; }
      }
    </style>
  </head>
  <body>
    <div class="site-desktop" style="background:${escapeHtml(bg)}">${desktop}</div>
    <div class="site-mobile" style="background:${escapeHtml(bgMobile)}">${mobile}</div>
  </body>
</html>`
}
