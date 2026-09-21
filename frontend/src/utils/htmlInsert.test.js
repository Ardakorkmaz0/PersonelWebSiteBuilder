import { describe, expect, it } from 'vitest'
import { closingTagIndex, insertBeforeClosingTag } from './htmlInsert.js'

// The page that started this: its "export" feature builds a whole document in
// a template literal, so the file's first `</body>` is inside its JavaScript.
const withDocumentInScript = `<!DOCTYPE html><html><head><title>Demo</title></head><body>
<h1>Hi</h1>
<script>
  const EXPORT = \`<html><head></head><body><p>copy</p></body></html>\`;
  document.getElementById('x').addEventListener('click', () => {});
</scr` + `ipt>
</body></html>`

describe('closingTagIndex', () => {
  it('finds the document\'s own closing tag, not one inside a script', () => {
    const at = closingTagIndex(withDocumentInScript, 'body')
    expect(withDocumentInScript.slice(at)).toBe('</body></html>')
  })

  it('steps over comments and styles as well', () => {
    const html = '<html><head><style>/* </head> */</style></head><body><!-- </body> --><p>x</p></body></html>'
    expect(html.slice(closingTagIndex(html, 'head'))).toBe('</head><body><!-- </body> --><p>x</p></body></html>')
    expect(html.slice(closingTagIndex(html, 'body'))).toBe('</body></html>')
  })

  it('reports -1 for a fragment with no such tag', () => {
    expect(closingTagIndex('<p>just a fragment</p>', 'body')).toBe(-1)
    expect(closingTagIndex('', 'body')).toBe(-1)
  })

  it('handles whitespace inside the tag and odd casing', () => {
    const html = '<html><body><p>x</p></BODY\n></html>'
    expect(closingTagIndex(html, 'body')).toBe(html.indexOf('</BODY'))
  })
})

describe('insertBeforeClosingTag', () => {
  it('splices after the author\'s script, leaving it intact', () => {
    const out = insertBeforeClosingTag(withDocumentInScript, 'body', '<script>ran()</scr' + 'ipt>')

    expect(out).toContain('</scr' + 'ipt>\n<script>ran()')
    // The author's own literal is untouched.
    expect(out).toContain('<body><p>copy</p></body></html>`')
  })

  it('gives back null when there is nothing to insert before', () => {
    expect(insertBeforeClosingTag('<p>fragment</p>', 'body', '<b>x</b>')).toBe(null)
  })
})
