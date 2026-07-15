import { describe, expect, it } from 'vitest'
import { schemaToSingleHtml } from './schemaToFiles.js'

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
