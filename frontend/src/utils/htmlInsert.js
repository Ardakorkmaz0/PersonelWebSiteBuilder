// Where a document's real `</body>` (or `</head>`) is.
//
// Every writer that adds something to a user's page used to do
// `html.replace(/<\/body>/i, tag + '</body>')`, which takes the FIRST match in
// the string. That is not always the document's own end: a page whose script
// builds another document in a template literal carries `</body>` inside its
// JavaScript, and the injection landed in the middle of the author's code.
// Since the HTML parser ends a `<script>` at the first `</script`, the injected
// runtime closed the author's script early and left it a syntax error — so
// every handler it registered (a theme toggle, a mobile menu, an accordion)
// silently stopped existing in View mode. Measured on a real uploaded page: the
// dark-mode button did nothing, while the same file opened on its own worked.
//
// So the scan walks the markup and steps over the parts that are text rather
// than structure — script, style, textarea and title bodies, and comments.
const SKIPPABLE = /<!--|<(script|style|textarea|title)\b[^>]*>/i

export function closingTagIndex(html, name) {
  const source = String(html || '')
  const closing = new RegExp(`</${name}\\s*>`, 'i')
  let cursor = 0
  while (cursor < source.length) {
    const rest = source.slice(cursor)
    const close = rest.search(closing)
    if (close === -1) return -1
    const skip = SKIPPABLE.exec(rest)
    if (!skip || close < skip.index) return cursor + close
    if (skip[0] === '<!--') {
      const end = source.indexOf('-->', cursor + skip.index + 4)
      if (end === -1) return -1
      cursor = end + 3
      continue
    }
    const tag = skip[1].toLowerCase()
    const end = source.toLowerCase().indexOf(`</${tag}`, cursor + skip.index + skip[0].length)
    if (end === -1) return -1
    cursor = end + tag.length + 2
  }
  return -1
}

// The document with `markup` spliced in just before that tag, or null when the
// document has no such tag — callers keep their own fallback for that case.
export function insertBeforeClosingTag(html, name, markup) {
  const source = String(html || '')
  const at = closingTagIndex(source, name)
  if (at === -1) return null
  return source.slice(0, at) + markup + source.slice(at)
}
