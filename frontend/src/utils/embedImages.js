// Image sources inside an HTML embed's code. Palette image blocks (Avatar,
// figures, cards with photos) drop as `html` components, so "change the
// photo" used to mean hand-editing the snippet. These helpers back the image
// pickers at the top of the Properties panel: list every <img> in the code
// and swap the src of the n-th one without disturbing the rest of the markup.
const IMG_TAG_SOURCE = '<img\\b[^>]*>'
const SRC_RE = /(\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)')/i

export function listEmbedImages(code) {
  const text = String(code || '')
  const re = new RegExp(IMG_TAG_SOURCE, 'gi')
  const out = []
  let match
  while ((match = re.exec(text))) {
    const src = SRC_RE.exec(match[0])
    out.push({ index: out.length, src: src ? (src[2] ?? src[3] ?? '') : '' })
  }
  return out
}

export function replaceEmbedImage(code, index, nextSrc) {
  const text = String(code || '')
  const clean = String(nextSrc || '').replace(/"/g, '&quot;')
  let i = -1
  return text.replace(new RegExp(IMG_TAG_SOURCE, 'gi'), (tag) => {
    i += 1
    if (i !== index) return tag
    if (SRC_RE.test(tag)) return tag.replace(SRC_RE, (_, pre) => `${pre}"${clean}"`)
    return tag.replace(/<img\b/i, `<img src="${clean}"`)
  })
}
