const HTML_EMBED_RESET_CSS = [
  'html,body{margin:0!important;padding:0!important;background:transparent;font-family:inherit;color:inherit;width:100%;height:100%;min-height:100%;overflow:hidden!important;}',
  '*,*::before,*::after{box-sizing:border-box;scrollbar-width:none;}',
  '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important;}',
  'body{display:block;overflow-wrap:anywhere;}',
  'body[data-pwb-embed-fill="control"]{display:grid!important;place-items:stretch!important;}',
  'body[data-pwb-embed-fill="control"]>[data-pwb-embed-scale-root],body[data-pwb-embed-fill="control"]>*:first-child{display:flex!important;align-items:center!important;justify-content:center!important;width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important;margin:0!important;box-sizing:border-box!important;line-height:1.1!important;white-space:nowrap!important;font-size:clamp(12px,28vmin,88px)!important;}',
  'body[data-pwb-embed-fill="control"]>[data-pwb-embed-scale-root]>*:first-child{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;box-sizing:border-box!important;line-height:1.1!important;white-space:nowrap!important;font-size:inherit!important;}',
  'body[data-pwb-embed-fill="form"]{display:grid!important;place-items:stretch!important;}',
  'body[data-pwb-embed-fill="form"]>*:first-child{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:clamp(8px,4vw,32px)!important;width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important;margin:0!important;padding:clamp(6px,4vmin,24px)!important;box-sizing:border-box!important;font-size:clamp(13px,12vmin,42px)!important;line-height:1.1!important;overflow:hidden!important;}',
  'body[data-pwb-embed-fill="form"] :is(label,span){font-size:inherit!important;line-height:1.1!important;white-space:nowrap!important;flex:0 0 auto!important;}',
  'body[data-pwb-embed-fill="form"] :is(input,select,textarea){flex:1 1 auto!important;min-width:0!important;width:100%!important;height:calc(100vh - clamp(12px,8vmin,48px))!important;max-height:100vh!important;font-size:inherit!important;padding:0 clamp(10px,5vmin,32px)!important;border-radius:clamp(8px,8vmin,40px)!important;box-sizing:border-box!important;}',
  'body:has(> span[style*="inline-grid"]:first-of-type:last-of-type){display:grid;place-items:center;}',
  'body:has(> span[style*="inline-grid"]:first-of-type:last-of-type)>span[style*="inline-grid"]:first-of-type:last-of-type{width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important;margin:0!important;font-size:clamp(14px,38vmin,120px)!important;}',
  'body *,body>*{max-width:100%;min-width:0;}',
  'body>:is(div,section,article,main,aside,header,footer):only-child{min-height:100%;}',
  // When the embed is scaled, the snippet is wrapped in the scale-root; stretch a
  // lone block child to fill it too, so a resized section/banner has no dead space
  // below it (the colored background fills the whole frame).
  'body[data-pwb-embed-scaled]>[data-pwb-embed-scale-root]>:is(div,section,article,main,aside,header,footer):only-child{min-height:100%;}',
  'img,video,canvas,svg{max-width:100%;height:auto;}',
  'iframe{max-width:100%;border:0;}',
  'table{max-width:100%;border-collapse:collapse;}',
  'pre,code{white-space:pre-wrap;word-break:break-word;}',
].join('')

const resetTag = `<style data-pwb-embed-reset>${HTML_EMBED_RESET_CSS}</style>`
const SCALE_EPSILON = 0.02

function cleanScale(scale) {
  const n = Number(scale)
  if (!Number.isFinite(n) || Math.abs(n - 1) < SCALE_EPSILON) return null
  return Math.max(0.2, Math.min(4, n))
}

function scaleTag(scale) {
  const clean = cleanScale(scale)
  if (!clean) return ''
  const value = clean.toFixed(4).replace(/\.?0+$/, '')
  return `<style data-pwb-embed-scale>:root{--pwb-embed-scale:${value};}body[data-pwb-embed-scaled]{display:block!important;}body[data-pwb-embed-scaled]>[data-pwb-embed-scale-root]{display:block;width:calc(100% / var(--pwb-embed-scale));min-height:calc(100% / var(--pwb-embed-scale));transform:scale(var(--pwb-embed-scale));transform-origin:top left;}</style>`
}

function fillAttr(fill) {
  return fill === 'control' || fill === 'icon' || fill === 'form'
    ? ` data-pwb-embed-fill="${fill}"`
    : ''
}

function hasReset(html) {
  return /<style[^>]*data-pwb-embed-reset/i.test(html)
}

function wrapBodyForOptions(html, options = {}) {
  const scale = cleanScale(options.scale)
  const fill = fillAttr(options.fill)
  if (!scale && !fill) return html
  if (/<body(\s[^>]*)?>/i.test(html) && /<\/body>/i.test(html)) {
    const bodyAttrs = `${scale ? ' data-pwb-embed-scaled="true"' : ''}${fill}`
    const open = scale ? '<div data-pwb-embed-scale-root>' : ''
    const close = scale ? '</div>' : ''
    return html
      .replace(/<body([^>]*)>/i, `<body$1${bodyAttrs}>${open}`)
      .replace(/<\/body>/i, `${close}</body>`)
  }
  return html
}

function injectReset(html, options = {}) {
  const tags = `${hasReset(html) ? '' : resetTag}${scaleTag(options.scale)}`
  if (!tags && !cleanScale(options.scale) && !fillAttr(options.fill)) return html
  if (hasReset(html)) return wrapBodyForOptions(html.replace(/<\/head>/i, `${scaleTag(options.scale)}</head>`), options)
  if (/<\/head>/i.test(html)) {
    return wrapBodyForOptions(html.replace(/<\/head>/i, `${tags}</head>`), options)
  }
  if (/<head(\s[^>]*)?>/i.test(html)) {
    return wrapBodyForOptions(html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${tags}`), options)
  }
  if (/<html(\s[^>]*)?>/i.test(html)) {
    return wrapBodyForOptions(html.replace(
      /<html(\s[^>]*)?>/i,
      (match) => `${match}<head><meta charset="UTF-8">${tags}</head>`,
    ), options)
  }
  const scale = cleanScale(options.scale)
  const bodyAttr = `${scale ? ' data-pwb-embed-scaled="true"' : ''}${fillAttr(options.fill)}`
  const open = scale ? '<div data-pwb-embed-scale-root>' : ''
  const close = scale ? '</div>' : ''
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${tags}</head><body${bodyAttr}>${open}${html}${close}</body></html>`
}

export function htmlEmbedDocument(code, options = {}) {
  const html = typeof code === 'string' ? code : ''
  return injectReset(html, options)
}

export { HTML_EMBED_RESET_CSS }
