// Read and write editable element copy while treating <br> as a textarea
// newline. Writes use DOM text nodes, so text such as "<script>" remains
// harmless user copy instead of becoming executable HTML.
export function readElementMultilineText(element) {
  if (!element) return ''

  const readNode = (node) => {
    if (node.nodeType === 3) return node.nodeValue || ''
    if (node.nodeType !== 1) return ''
    if (node.tagName === 'BR') return '\n'
    return [...node.childNodes].map(readNode).join('')
  }

  return [...element.childNodes].map(readNode).join('')
}

export function writeElementMultilineText(element, value) {
  if (!element?.ownerDocument) return
  const document = element.ownerDocument
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n')
  const nodes = []

  lines.forEach((line, index) => {
    if (index > 0) nodes.push(document.createElement('br'))
    if (line) nodes.push(document.createTextNode(line))
  })

  element.replaceChildren(...nodes)
}
