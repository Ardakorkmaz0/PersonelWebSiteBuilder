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
