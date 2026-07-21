import { describe, expect, it } from 'vitest'
import { schemaToSingleHtml } from './schemaToFiles.js'

describe('schemaToSingleHtml multiline copy', () => {
  it('preserves Enter as a safe line break', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [{
        id: 'p1',
        name: 'Home',
        mode: 'empty',
        components: [{
          id: 'heading_multiline',
          type: 'heading',
          props: { text: 'First line\nSecond <line>', level: 'h2' },
          styles: {},
          layout: { x: 0, y: 0, w: 400, h: 80 },
        }],
      }],
    })

    expect(html).toContain('First line<br>Second &lt;line&gt;')
    expect(html).not.toContain('Second <line>')
  })
})

describe('schemaToSingleHtml fixed components', () => {
  it('keeps fixed components outside the scaled page transform', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [
        {
          id: 'p1',
          name: 'Home',
          mode: 'empty',
          flowMode: false,
          canvasWidth: 1000,
          mobileWidth: 390,
          components: [
            {
              id: 'button_fixed',
              type: 'button',
              props: {
                text: 'Subscribe',
                href: '#',
                scrollBehavior: 'fixed',
                pinY: 'bottom',
                pinX: 'right',
                pinOffsetY: 20,
                pinOffsetX: 24,
              },
              styles: {},
              layout: { x: 700, y: 520, w: 180, h: 52 },
              mobileLayout: { x: 40, y: 300, w: 180, h: 52 },
            },
            {
              id: 'heading_normal',
              type: 'heading',
              props: { text: 'Normal content', level: 'h2' },
              styles: {},
              layout: { x: 100, y: 100, w: 500, h: 80 },
              mobileLayout: { x: 20, y: 80, w: 350, h: 80 },
            },
          ],
        },
      ],
    }, 'Fixed test')

    const fixedIndex = html.indexOf('class="export-fixed"')
    const fixedButtonIndex = html.indexOf('id="button_fixed"')
    const normalHeadingIndex = html.indexOf('id="heading_normal"')
    expect(fixedIndex).toBeGreaterThan(-1)
    expect(fixedButtonIndex).toBeGreaterThan(fixedIndex)
    expect(normalHeadingIndex).toBeLessThan(fixedIndex)
    expect(html).toContain('position: fixed')
    expect(html).toContain('right: 24px')
    expect(html).toContain('bottom: 20px')
    expect(html).toContain('justify-content: center')
    expect(html).toContain('transform-origin: top center')
    expect(html).toContain('.export-fixed { position: fixed')
    expect(html).toContain('fixedLayer.style.left = Math.round(left)')
    expect(html).toContain('fixedLayer.style.transform = \'scale(\' + scale + \')\'')
    expect(html).toContain('Math.min(1, screenW / mode.w)')
  })
})

describe('schemaToSingleHtml responsive regions', () => {
  it('exports a full-width wrapper with docked desktop and separate mobile layouts', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [{
        id: 'p1', name: 'Home', mode: 'empty', flowMode: false,
        canvasWidth: 1000, mobileWidth: 390,
        components: [{
          id: 'region_1', type: 'region', props: { contentWidth: 1200 },
          styles: { backgroundColor: '#eef2ff' },
          layout: { x: 100, y: 40, w: 1200, h: 360 },
          mobileLayout: { x: 0, y: 40, w: 390, h: 360 },
          children: [{
            id: 'button_1', type: 'button',
            props: { text: 'Go', href: '#', dockX: 'right' }, styles: {},
            layout: { x: 940, y: 80, w: 180, h: 48 },
            mobileLayout: { x: 16, y: 24, w: 180, h: 48 },
          }],
        }],
      }],
    }, 'Region test')
    expect(html).toContain('class="region-child region-region_1-button_1"')
    expect(html).toContain('max-width:1200px')
    expect(html).toContain('left: 0px')
    expect(html).toContain('width: 1000px')
    expect(html).toContain('right:80px;width:180px')
    expect(html).toContain('.region-region_1-button_1 { left:16px;right:auto;top:24px;width:180px')
    expect(html).not.toContain('data-region-design')
  })
})

describe('schemaToSingleHtml mobile navbar', () => {
  it('exports a hamburger menu with the same interactive runtime as preview', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [{
        id: 'home', name: 'Home', mode: 'empty', flowMode: false,
        canvasWidth: 1000, mobileWidth: 390,
        components: [{
          id: 'nav', type: 'navbar',
          props: {
            brand: 'Studio',
            links: [{ label: 'Work', href: '#work' }],
            navLayout: 'horizontal',
            mobileNavMode: 'menu',
          },
          styles: { backgroundColor: '#111827', color: '#ffffff' },
          layout: { x: 0, y: 0, w: 1000, h: 64 },
          mobileLayout: { x: 0, y: 0, w: 390, h: 64 },
        }],
      }],
    }, 'Navbar test')

    expect(html).toContain('data-builder-mobile-nav')
    expect(html).toContain('data-builder-mobile-nav-toggle')
    expect(html).toContain('nav-mobile-menu')
    expect(html).toContain('--builder-nav-menu-bg:#111827')
    expect(html).toContain('background:var(--builder-nav-menu-bg,#1d1d1f)')
    expect(html).toContain('[data-mobile-open="true"] .links')
    expect(html).toContain("navRoot.setAttribute('data-mobile-open'")
  })
})

describe('schemaToSingleHtml per-breakpoint styles', () => {
  it('emits stylesMobile overrides inside the mobile media block only', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [
        {
          id: 'p1',
          name: 'Home',
          mode: 'empty',
          flowMode: false,
          canvasWidth: 1000,
          mobileWidth: 390,
          components: [
            {
              id: 'title1',
              type: 'heading',
              props: { text: 'Hello', level: 'h1' },
              styles: { fontSize: '44px', color: '#111111' },
              stylesMobile: { fontSize: '28px' },
              layout: { x: 60, y: 80, w: 600, h: 60 },
              mobileLayout: { x: 16, y: 60, w: 358, h: 60 },
            },
          ],
        },
      ],
    }, 'Site')
    // Desktop rule keeps the base size; the media block carries the override.
    const mediaStart = html.indexOf('@media (max-width: 768px)')
    expect(mediaStart).toBeGreaterThan(-1)
    const desktop = html.slice(0, mediaStart)
    const media = html.slice(mediaStart)
    expect(media).toContain('font-size: 28px')
    expect(desktop).toContain('font-size: 44px')
    expect(desktop).not.toContain('font-size: 28px')
  })
})

describe('schemaToSingleHtml auto-layout container', () => {
  const build = (flow, extra = {}) => schemaToSingleHtml({
    theme: {},
    pages: [{
      id: 'p1', name: 'Home', mode: 'empty',
      components: [{
        id: 'c1', type: 'container',
        props: { flow, gap: 20, ...extra },
        styles: {}, layout: { x: 0, y: 0, w: 600, h: 300 },
        children: [
          { id: 'a', type: 'heading', props: { text: 'A', level: 'h3' }, styles: {}, layout: { x: 0, y: 0, w: 200, h: 40 } },
          { id: 'b', type: 'text', props: { text: 'B' }, styles: {}, layout: { x: 0, y: 0, w: 200, h: 60 } },
        ],
      }],
    }],
  }, 'Site')

  it('emits a flex column that flows children (no absolute positioning)', () => {
    const html = build('column')
    expect(html).toContain('display:flex')
    expect(html).toContain('flex-direction:column')
    expect(html).toContain('gap:20px')
    // The container's own children are not absolutely pinned in flow mode.
    expect(html).not.toContain('position:absolute;left:0px;top:0px;width:200px')
  })

  it('emits a responsive grid template', () => {
    const html = build('grid', { cols: 4 })
    expect(html).toContain('display:grid')
    expect(html).toContain('repeat(4, minmax(0, 1fr))')
  })

  it('a free container still uses the absolute mini-canvas', () => {
    const html = build('free')
    expect(html).toContain('position:relative')
    expect(html).toContain('position:absolute')
    expect(html).not.toContain('display:grid')
  })
})

describe('schemaToSingleHtml embed breakpoints', () => {
  // Regression: embeds (html/select/accordion/container/tabs) used to carry an
  // INLINE desktop layout on their wrapper. Inline styles outrank a media query,
  // so a phone-sized design still painted them at their PC position and width —
  // they hung off the side of the screen in View and on the published site while
  // the edit canvas showed them fitting.
  it('positions an embed from the stylesheet so the mobile breakpoint wins', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [{
        id: 'p1', name: 'Home', mode: 'empty', flowMode: false,
        canvasWidth: 1920, mobileWidth: 430,
        components: [{
          id: 'html_1', type: 'html',
          props: { html: '<p>Plan</p>', _paletteType: 'select' },
          styles: { padding: '12px' },
          layout: { x: 135, y: 288, w: 360, h: 70 },
          mobileLayout: { x: 20, y: 571, w: 360, h: 90 },
        }],
      }],
    }, 'Embed test')

    expect(html).toContain('<div id="html_1" class="c-html_1">')
    expect(html).toContain('.c-html_1 { position: absolute;')
    expect(html).toMatch(/\.c-html_1 \{[^}]*top: 288px;[^}]*width: 360px;[^}]*height: 70px;/)
    expect(html).toMatch(/ {2}\.c-html_1 \{[^}]*top: 571px;[^}]*height: 90px;/)
    // The look stays on the inner node — the wrapper rule must not repeat it,
    // or padding and borders would be applied twice.
    expect(html).not.toMatch(/\.c-html_1 \{[^}]*padding: 12px/)
    // The embed's own iframe follows the phone box instead of keeping its PC height.
    expect(html).toContain('.c-html_1 > iframe { height:90px; }')
  })
})

describe('schemaToSingleHtml per-breakpoint visibility', () => {
  // "Hide on PC" must not leak into the phone: the desktop `display:none` sits
  // outside the media query, so the mobile rule has to put the display back.
  it('shows a PC-hidden component again at the mobile breakpoint', () => {
    const html = schemaToSingleHtml({
      theme: {},
      pages: [{
        id: 'p1', name: 'Home', mode: 'empty', flowMode: false,
        canvasWidth: 1000, mobileWidth: 390,
        components: [
          {
            id: 'nav_pc_hidden', type: 'navbar', props: { brand: 'Only phones' }, styles: {},
            layout: { x: 0, y: 0, w: 1000, h: 64 }, mobileLayout: { x: 0, y: 0, w: 390, h: 64 },
            hidden: true, hiddenMobile: false,
          },
          {
            id: 'text_mobile_hidden', type: 'text', props: { text: 'Only desktops' }, styles: {},
            layout: { x: 40, y: 120, w: 400, h: 60 }, mobileLayout: { x: 8, y: 120, w: 300, h: 60 },
            hidden: false, hiddenMobile: true,
          },
        ],
      }],
    }, 'Visibility test')

    expect(html).toMatch(/\.c-nav_pc_hidden \{[^}]*display:none;/)
    expect(html).toMatch(/ {2}\.c-nav_pc_hidden \{[^}]*display:flex;/)
    expect(html).toMatch(/ {2}\.c-text_mobile_hidden \{[^}]*display:none;/)
  })
})
