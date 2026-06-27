const HTML_EMBED_RESET_CSS = [
  'html,body{margin:0!important;padding:0!important;background:transparent;font-family:inherit;color:inherit;width:100%;height:100%;min-height:100%;overflow:hidden!important;}',
  '*,*::before,*::after{box-sizing:border-box;scrollbar-width:none;}',
  '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important;}',
  'body{display:block;overflow-wrap:anywhere;}',
  'body *,body>*{max-width:100%;min-width:0;}',
  'body>:is(div,section,article,main,aside,header,footer):only-child{min-height:100%;}',
  'img,video,canvas,svg{max-width:100%;height:auto;}',
  'iframe{max-width:100%;border:0;}',
  'table{max-width:100%;border-collapse:collapse;}',
  'pre,code{white-space:pre-wrap;word-break:break-word;}',
].join('')

const resetTag = `<style data-pwb-embed-reset>${HTML_EMBED_RESET_CSS}</style>`

function hasReset(html) {
  return /<style[^>]*data-pwb-embed-reset/i.test(html)
}

function injectReset(html) {
  if (hasReset(html)) return html
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${resetTag}</head>`)
  }
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${resetTag}`)
  }
  if (/<html(\s[^>]*)?>/i.test(html)) {
    return html.replace(
      /<html(\s[^>]*)?>/i,
      (match) => `${match}<head><meta charset="UTF-8">${resetTag}</head>`,
    )
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${resetTag}</head><body>${html}</body></html>`
}

export function htmlEmbedDocument(code) {
  const html = typeof code === 'string' ? code : ''
  return injectReset(html)
}

export { HTML_EMBED_RESET_CSS }
