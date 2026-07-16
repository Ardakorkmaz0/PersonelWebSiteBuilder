import { describe, expect, it } from 'vitest'
import { schemaToResponsiveHtml } from './responsiveHtml.js'

describe('schemaToResponsiveHtml multiline copy', () => {
  it('preserves line breaks while escaping markup', () => {
    const html = schemaToResponsiveHtml({
      theme: {},
      pages: [{
        id: 'p1',
        name: 'Home',
        components: [{
          id: 'text_multiline',
          type: 'text',
          props: { text: 'One\nTwo <safe>' },
          styles: {},
          layout: { x: 0, y: 0, w: 400, h: 80 },
        }],
      }],
    })

    expect(html).toContain('One<br>Two &lt;safe&gt;')
    expect(html).not.toContain('Two <safe>')
  })
})
