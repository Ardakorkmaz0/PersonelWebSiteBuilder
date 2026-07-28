function fileMap(files) {
  return new Map((files || []).map((file) => [file.name, String(file.content || '')]))
}

function safeStyleContent(value) {
  return String(value || '').replace(/<\/\s*style/gi, '<\\/style')
}

function safeScriptContent(value) {
  return String(value || '').replace(/<\/\s*script/gi, '<\\/script')
}

// Source workspace HTML belongs to a readable, multi-file project. The visual
// editor, however, stores one portable document. Inline only the four generated
// project references so an edited page keeps working after it is applied.
export function inlineProjectHtml(html, files) {
  const assets = fileMap(files)
  let output = String(html || '')

  output = output.replace(
    /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']styles\.css["'])[^>]*\/?\s*>/i,
    `<style data-pwb-project-styles>\n${safeStyleContent(assets.get('styles.css'))}\n</style>`,
  )
  output = output.replace(
    /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']custom\.css["'])[^>]*\/?\s*>/i,
    `<style data-pwb-custom-styles>\n${safeStyleContent(assets.get('custom.css'))}\n</style>`,
  )
  output = output.replace(
    /<script\b(?=[^>]*\bsrc=["']runtime\.js["'])[^>]*>\s*<\/script\s*>/i,
    `<script data-pwb-project-runtime>\n${safeScriptContent(assets.get('runtime.js'))}\n</script>`,
  )
  output = output.replace(
    /<script\b(?=[^>]*\bsrc=["']custom\.js["'])[^>]*>\s*<\/script\s*>/i,
    `<script data-pwb-custom-script>\n${safeScriptContent(assets.get('custom.js'))}\n</script>`,
  )

  return output
}

function minifyCss(css) {
  const strings = []
  const protectedCss = String(css || '').replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
    (value) => {
      const token = `___PWB_CSS_STRING_${strings.length}___`
      strings.push(value)
      return token
    },
  )

  let output = protectedCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()

  strings.forEach((value, index) => {
    output = output.replace(`___PWB_CSS_STRING_${index}___`, value)
  })
  return output
}

// Conservative production export: CSS and document whitespace are compacted,
// while scripts, preformatted text and textareas stay byte-for-byte intact.
export function minifyGeneratedHtml(html) {
  const protectedBlocks = []
  let output = String(html || '').replace(
    /<(script|pre|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    (value) => {
      const token = `___PWB_HTML_BLOCK_${protectedBlocks.length}___`
      protectedBlocks.push(value)
      return token
    },
  )

  output = output.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_, attrs, css) => (
    `<style${attrs}>${minifyCss(css)}</style>`
  ))
  output = output
    .replace(/<!--(?!\[if)[\s\S]*?-->/gi, '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/>\s+</g, '> <')
    .trim()

  protectedBlocks.forEach((value, index) => {
    output = output.replace(`___PWB_HTML_BLOCK_${index}___`, value)
  })
  return output
}
