import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { registry } from '../registry.jsx'
import { RenderComponent } from './Renderer.jsx'

function expandedComponent(type, scale = 2) {
  const def = registry[type]
  return {
    id: `${type}_scale_test`,
    type,
    props: { ...(def.defaultProps || {}) },
    styles: { ...(def.defaultStyles || {}) },
    layout: {
      w: Math.round(def.defaultSize.w * scale),
      h: Math.round(def.defaultSize.h * scale),
    },
    children: [],
  }
}

function renderType(type, scale = 2) {
  return renderToStaticMarkup(<RenderComponent component={expandedComponent(type, scale)} />)
}

describe('RenderComponent box scaling', () => {
  it('preserves entered line breaks in visible text', () => {
    const html = renderToStaticMarkup(
      <RenderComponent component={{
        ...expandedComponent('heading', 1),
        props: { text: 'First line\nSecond line', level: 'h2' },
      }} />,
    )

    expect(html).toContain('white-space:pre-wrap')
    expect(html).toContain('First line\nSecond line')
  })

  it('renders every registered component when the box is resized larger', () => {
    for (const type of Object.keys(registry)) {
      expect(renderType(type)).toContain('width:100%')
    }
  })

  it('scales button text metrics with the resized box', () => {
    const html = renderType('button')

    expect(html).toContain('font-size:34px')
    expect(html).toContain('border-radius:1960px')
  })

  it('scales form field internals with the resized box', () => {
    const html = renderType('input')

    expect(html).toContain('font-size:30px')
    expect(html).toContain('height:88px')
    expect(html).toContain('padding:20px 24px')
  })

  it('scales alert icon, spacing, and text metrics with the resized box', () => {
    const html = renderType('alert')

    expect(html).toContain('font-size:32px')
    expect(html).toContain('gap:20px')
    expect(html).toContain('width="40px"')
  })

  it('scales tabs chrome when the tabs box is resized', () => {
    const html = renderType('tabs')

    expect(html).toContain('font-size:32px')
    expect(html).toContain('padding:20px 32px')
    expect(html).toContain('gap:12px')
  })

  it('scales icons with the resized box', () => {
    const html = renderType('icon')

    expect(html).toContain('font-size:80px')
    expect(html).toContain('justify-content:center')
  })

  it('scales html embed content through the iframe document', () => {
    const html = renderToStaticMarkup(
      <RenderComponent
        component={{
          id: 'html_box_scale_test',
          type: 'html',
          props: {
            _baseSize: { w: 220, h: 56 },
            code: '<div style="width:220px;height:56px;font-size:16px;">Box</div>',
          },
          styles: {},
          layout: { w: 440, h: 112 },
        }}
      />,
    )

    expect(html).toContain('data-pwb-embed-scale')
    expect(html).toContain('--pwb-embed-scale:2')
    expect(html).toContain('data-pwb-embed-scale-root')
  })

  it('renders html button embeds as frame-filling controls', () => {
    const html = renderToStaticMarkup(
      <RenderComponent
        component={{
          id: 'html_button_fill_test',
          type: 'html',
          props: {
            _paletteType: 'button',
            code: '<a href="#" style="display:inline-block;padding:12px 26px;font-size:16px;">Button</a>',
          },
          styles: {},
          layout: { w: 440, h: 112 },
        }}
      />,
    )

    expect(html).toContain('data-pwb-embed-fill=&quot;control&quot;')
    expect(html).toContain('width:100vw!important;height:100vh!important')
    expect(html).not.toContain('data-pwb-embed-scaled=&quot;true&quot;')
  })

  it('makes html embeds inert in editor preview mode', () => {
    const html = renderToStaticMarkup(
      <RenderComponent
        editorPreview
        component={{
          id: 'html_editor_preview_test',
          type: 'html',
          props: {
            code: '<button>Click</button>',
          },
          styles: {},
          layout: { w: 220, h: 80 },
        }}
      />,
    )

    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('pointer-events:none')
    expect(html).toContain('user-select:none')
  })

  it('renders html select embeds as frame-filling forms', () => {
    const html = renderToStaticMarkup(
      <RenderComponent
        component={{
          id: 'html_select_fill_test',
          type: 'html',
          props: {
            _paletteType: 'select',
            code: '<div style="display:flex;align-items:center;gap:14px;"><span>Filter</span><select><option>Newest</option></select></div>',
          },
          styles: {},
          layout: { w: 420, h: 96 },
        }}
      />,
    )

    expect(html).toContain('data-pwb-embed-fill=&quot;form&quot;')
    expect(html).toContain('body[data-pwb-embed-fill=&quot;form&quot;]&gt;*:first-child')
    expect(html).not.toContain('data-pwb-embed-scaled=&quot;true&quot;')
  })

  it('lets html icon embeds fill the resized frame', () => {
    const html = renderToStaticMarkup(
      <RenderComponent
        component={{
          id: 'html_icon_scale_test',
          type: 'html',
          props: {
            _paletteType: 'icon',
            code: '<span style="display:inline-grid;width:48px;height:48px;">+</span>',
          },
          styles: {},
          layout: { w: 180, h: 180 },
        }}
      />,
    )

    expect(html).toContain('width:100vw!important;height:100vh!important')
    expect(html).not.toContain('data-pwb-embed-scaled=&quot;true&quot;')
  })
})
