// Every component type must render in every writer.
//
// A design is drawn three times: by the React canvas (registry.Render), by the
// published-site exporter (schemaToFiles) and by the responsive writer that
// feeds the gallery thumbnails, the Code panel and "Convert to responsive
// HTML". The canvas cannot silently lose a type — a missing Render is a crash
// — but both HTML writers are `switch` statements whose `default` returns an
// empty string. A type nobody added a case for produces NOTHING, with no error
// anywhere: that is how Section bands came to render as blank cards in the
// gallery and vanish outright on conversion.
//
// So: drive every registered type through both writers and require it to leave
// a trace. New component type, no new case, red test.
import { describe, expect, it } from 'vitest'
import { registry } from '../components/registry.jsx'
import { schemaToSingleHtml } from './schemaToFiles.js'
import { schemaToResponsiveHtml } from './responsiveHtml.js'

const MARKER = 'ZZmarkerZZ'

// Props that make a type render something identifiable. Types not listed here
// are driven by their own registry defaults.
const PROBE_PROPS = {
  navbar: { brand: MARKER, links: [{ label: 'Home', href: '#top' }] },
  heading: { text: MARKER, level: 'h2' },
  text: { text: MARKER },
  button: { text: MARKER, href: '#a' },
  linkbutton: { text: MARKER, href: '#a' },
  section: { heading: MARKER, text: 'Body' },
  card: { title: MARKER, text: 'Body' },
  list: { text: `${MARKER}\nSecond` },
  quote: { text: MARKER, author: 'A' },
  badge: { text: MARKER },
  alert: { text: MARKER, variant: 'info' },
  accordion: { title: MARKER, text: 'Body' },
  input: { label: MARKER, placeholder: 'x' },
  select: { label: MARKER, options: 'A\nB' },
  icon: { name: 'star', label: MARKER },
  image: { src: 'https://example.com/a.png', alt: MARKER },
  html: { code: `<div>${MARKER}</div>` },
  tabs: { tabs: [{ id: 't1', label: MARKER }], activeId: 't1' },
}

// Types that carry no text of their own. Asserting on a specific tag would pin
// an implementation detail that legitimately differs between the writers (a
// divider is a styled div in one and an <hr> in the other), so the check is
// writer-agnostic: putting the component on the page has to change the body.
const STRUCTURAL = new Set(['divider', 'spacer'])

function pageWith(component) {
  return {
    theme: {},
    pages: [{
      id: 'p1', name: 'Home', background: '#ffffff',
      canvasWidth: 1000, mobileWidth: 390,
      components: component ? [component] : [],
    }],
  }
}

function bodyOf(html) {
  const start = html.indexOf('<body')
  const end = html.lastIndexOf('</body>')
  return start >= 0 && end > start ? html.slice(start, end) : html
}

// A component's own markup, isolated from the runtime and stylesheet that ride
// along in every document.
function bodyGrowth(writer, component) {
  const empty = bodyOf(writer(pageWith(null), 'Probe')).length
  return bodyOf(writer(pageWith(component), 'Probe')).length - empty
}

function build(type) {
  const def = registry[type]
  const size = def.defaultSize || { w: 300, h: 80 }
  const base = {
    id: `${type}_probe`,
    type,
    props: { ...(def.defaultProps || {}), ...(PROBE_PROPS[type] || {}) },
    styles: {},
    layout: { x: 0, y: 0, w: size.w, h: size.h },
  }
  // Parents need a child, or "renders nothing" is the correct answer.
  if (['container', 'region', 'tabs'].includes(type)) {
    base.children = [{
      id: 'child_probe', type: 'heading', props: { text: MARKER, level: 'h3' },
      styles: {}, layout: { x: 10, y: 10, w: 200, h: 40 }, tabId: 't1',
    }]
  }
  return base
}

const TYPES = Object.keys(registry)

describe('every registered component type reaches every writer', () => {
  it('the registry is actually populated (guards the tests below)', () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(20)
  })

  it.each(TYPES)('%s renders in the published export', (type) => {
    const component = build(type)
    if (STRUCTURAL.has(type)) expect(bodyGrowth(schemaToSingleHtml, component), type).toBeGreaterThan(20)
    else expect(schemaToSingleHtml(pageWith(component), 'Probe'), type).toContain(MARKER)
  })

  it.each(TYPES)('%s renders in the responsive writer', (type) => {
    const component = build(type)
    if (STRUCTURAL.has(type)) expect(bodyGrowth(schemaToResponsiveHtml, component), type).toBeGreaterThan(20)
    else expect(schemaToResponsiveHtml(pageWith(component), 'Probe'), type).toContain(MARKER)
  })

  it.each(TYPES)('%s has a canvas renderer', (type) => {
    expect(typeof registry[type].Render, type).toBe('function')
  })
})

describe('parents carry their children through both writers', () => {
  it.each(['container', 'region', 'tabs'])('%s keeps its child', (type) => {
    const schema = pageWith(build(type))
    expect(schemaToSingleHtml(schema, 'Probe'), `${type} / published`).toContain(MARKER)
    expect(schemaToResponsiveHtml(schema, 'Probe'), `${type} / responsive`).toContain(MARKER)
  })
})
