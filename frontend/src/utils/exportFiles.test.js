import { describe, expect, it } from 'vitest'
import { inlineProjectHtml, minifyGeneratedHtml } from './exportFiles.js'

describe('inlineProjectHtml', () => {
  it('turns linked source-project assets into a portable document', () => {
    const html = `<!doctype html><html><head>
      <link rel="stylesheet" href="styles.css" />
      <link href="custom.css" rel="stylesheet">
      <script src="runtime.js"></script>
    </head><body><h1>Edited</h1><script src="custom.js"></script></body></html>`
    const output = inlineProjectHtml(html, [
      { name: 'styles.css', content: 'body { color: red; }' },
      { name: 'custom.css', content: '.custom { display: block; }' },
      { name: 'runtime.js', content: 'window.runtimeReady = true' },
      { name: 'custom.js', content: 'window.customReady = true' },
    ])

    expect(output).toContain('<style data-pwb-project-styles>')
    expect(output).toContain('<style data-pwb-custom-styles>')
    expect(output).toContain('<script data-pwb-project-runtime>')
    expect(output).toContain('<script data-pwb-custom-script>')
    expect(output).not.toContain('href="styles.css"')
    expect(output).not.toContain('src="runtime.js"')
    expect(output).toContain('<h1>Edited</h1>')
  })
})

describe('minifyGeneratedHtml', () => {
  it('compacts generated markup and CSS without rewriting executable or preformatted content', () => {
    const script = 'const value = 1\nvalue\n  + 2'
    const pre = 'first\n    second'
    const html = `<!doctype html>
      <!-- generated note -->
      <html><head><style>
        /* note */
        body { color: red; padding: 0 10px; }
      </style></head><body>
        <div>One</div>
        <div>Two</div>
        <pre>${pre}</pre>
        <script>${script}</script>
      </body></html>`
    const output = minifyGeneratedHtml(html)

    expect(output.length).toBeLessThan(html.length)
    expect(output).toContain('body{color:red;padding:0 10px}')
    expect(output).toContain(`<pre>${pre}</pre>`)
    expect(output).toContain(`<script>${script}</script>`)
    expect(output).not.toContain('generated note')
  })
})
