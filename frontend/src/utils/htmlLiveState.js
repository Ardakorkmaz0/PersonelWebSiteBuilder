// The state a page's own scripts put it in, carried from View into Edit.
//
// Edit mode renders the document WITHOUT scripts — it needs same-origin to be
// editable, and same-origin plus scripts would hand the page this app's
// session. So everything a script does is missing there: the dark-mode class
// it puts on <html>, the accordion it opened, the dropdown it expanded, the
// tab it selected. You could see those in View and not edit them, and edit in
// Edit without seeing them.
//
// View can't lend Edit its scripts, but it can lend the RESULT. This module
// compares the document View is actually showing against the one on disk and
// carries the difference over as attributes. Display only: every element it
// touches records what it replaced in `data-pwb-state`, and serializeDocument
// puts the original back, so nothing here reaches the saved file.
//
// Attributes only, never structure: content a script GENERATES is not in the
// file, and baking it in on the next save would rewrite the page behind the
// author's back.

// What interaction actually changes. `class` and `style` carry most of it
// (dark mode, .open, display:none, a measured height); the aria- pairs carry
// the accessible half of the same widgets.
const STATE_ATTRS = new Set(['class', 'style', 'hidden', 'open', 'checked', 'selected', 'data-state'])

const isStateAttr = (name) => STATE_ATTRS.has(name) || name.startsWith('aria-')

// A runaway page could otherwise hand us a diff the size of the document.
const MAX_ENTRIES = 600

function parse(html) {
  try {
    return new DOMParser().parseFromString(String(html || ''), 'text/html')
  } catch {
    return null
  }
}

function attributeChanges(authored, live) {
  const out = {}
  for (const name of authored.getAttributeNames()) {
    if (!isStateAttr(name)) continue
    if (!live.hasAttribute(name)) out[name] = null
    else if (live.getAttribute(name) !== authored.getAttribute(name)) out[name] = live.getAttribute(name)
  }
  for (const name of live.getAttributeNames()) {
    if (!isStateAttr(name) || authored.hasAttribute(name)) continue
    out[name] = live.getAttribute(name)
  }
  return out
}

// Nothing a script leaves behind that is ours, or that could run.
const SKIP_ADDED = 'script,link,[data-pwb-injected],[data-pwb-chrome],[data-builder-runtime-style],[data-builder-motion-style],[data-builder-interactive-style]'

// How far ahead to look for the authored child again after a script inserted
// something before it. A page appends; it does not usually interleave.
const LOOK_AHEAD = 8

// Content a script built rather than the author. It renders in Edit, marked so
// that the editor treats it as furniture and a save drops it — the alternative
// is an editor that shows an empty box where the running page shows a page.
const MAX_ADDED = 120
const MAX_ADDED_BYTES = 400000

// Where an element sits, as child indices from <html>. Both documents come
// from the same file, so the path lines up — and every step re-checks the tag
// name, so a script that inserted a node somewhere is recognised as an
// insertion instead of shifting everything after it onto the wrong element.
export function liveStateDiff(authoredHtml, liveHtml) {
  // No report is not the same as "the page dropped every attribute": the
  // reporter sends nothing when the document is too big to carry.
  if (!String(liveHtml || '').trim()) return { attrs: [], added: [] }
  const authored = parse(authoredHtml)?.documentElement
  const live = parse(liveHtml)?.documentElement
  if (!authored || !live || authored.tagName !== live.tagName) return { attrs: [], added: [] }

  const attrs = []
  const added = []
  let addedBytes = 0

  const carry = (node, path, index) => {
    if (added.length >= MAX_ADDED || addedBytes >= MAX_ADDED_BYTES) return
    if (node.matches?.(SKIP_ADDED)) return
    const html = node.outerHTML || ''
    if (!html || html.length > MAX_ADDED_BYTES) return
    addedBytes += html.length
    added.push({ path, index, html })
  }

  const visit = (a, b, path) => {
    if (attrs.length >= MAX_ENTRIES) return
    const changes = attributeChanges(a, b)
    if (Object.keys(changes).length) attrs.push({ path, attrs: changes })

    const aKids = a.children
    const bKids = b.children
    let ai = 0
    let bi = 0
    while (ai < aKids.length && bi < bKids.length) {
      if (aKids[ai].tagName === bKids[bi].tagName) {
        visit(aKids[ai], bKids[bi], [...path, ai])
        ai += 1
        bi += 1
        continue
      }
      // The live child is not the authored one: either the script inserted it,
      // or the two documents have genuinely parted ways.
      let found = -1
      for (let look = bi + 1; look < Math.min(bKids.length, bi + 1 + LOOK_AHEAD); look += 1) {
        if (bKids[look].tagName === aKids[ai].tagName) {
          found = look
          break
        }
      }
      if (found === -1) return
      for (; bi < found; bi += 1) carry(bKids[bi], path, bi)
    }
    // Whatever the running page has after the author's last child.
    for (; bi < bKids.length; bi += 1) carry(bKids[bi], path, bi)
  }

  visit(authored, live, [])
  return { attrs, added }
}

function elementAt(root, path) {
  let el = root
  for (const index of path) {
    el = el?.children?.[index]
    if (!el) return null
  }
  return el
}

// The document as Edit should render it. Preview-only: `data-pwb-state` holds
// both what was there and what we put in its place, so a save can put the
// first back — and can tell whether the author has since changed it by hand.
export function withLiveState(html, diff) {
  const attrChanges = Array.isArray(diff?.attrs) ? diff.attrs : []
  const additions = Array.isArray(diff?.added) ? diff.added : []
  if (!attrChanges.length && !additions.length) return String(html || '')
  const doc = parse(html)
  if (!doc?.documentElement) return String(html || '')

  let touched = 0
  // Attributes first: the paths were measured on the document as it is, and an
  // insertion would move everything after it.
  for (const { path, attrs } of attrChanges) {
    const el = elementAt(doc.documentElement, path)
    if (!el) continue
    const was = {}
    const now = {}
    for (const [name, value] of Object.entries(attrs || {})) {
      if (!isStateAttr(name)) continue
      was[name] = el.hasAttribute(name) ? el.getAttribute(name) : null
      if (value === null) el.removeAttribute(name)
      else el.setAttribute(name, value)
      now[name] = value
    }
    if (!Object.keys(was).length) continue
    el.setAttribute('data-pwb-state', JSON.stringify({ was, now }))
    touched += 1
  }

  // Then the content the page built for itself, in document order so each
  // insertion lands where it did in the running page.
  const ordered = [...additions].sort((a, b) => (a.path.length - b.path.length) || (a.index - b.index))
  for (const { path, index, html: markup } of ordered) {
    const parent = elementAt(doc.documentElement, path)
    if (!parent) continue
    const holder = doc.createElement('div')
    holder.innerHTML = String(markup || '')
    const node = holder.firstElementChild
    if (!node) continue
    // data-pwb-injected: a save drops it. data-pwb-chrome: the editor skips it
    // when selecting. contenteditable=false: the edit document is in
    // designMode, and without this the caret would still land in content that
    // a save is going to drop — typing into it would vanish silently.
    node.setAttribute('data-pwb-injected', 'live-state')
    node.setAttribute('data-pwb-chrome', '')
    node.setAttribute('contenteditable', 'false')
    const before = parent.children[index] || null
    parent.insertBefore(node, before)
    touched += 1
  }

  if (!touched) return String(html || '')
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

// Called by serializeDocument on the clone it is about to save: put the
// author's own values back, unless the value on the element is no longer the
// one we wrote — that means the author changed it themselves, and their
// version is the one to keep.
export function restoreAuthoredState(root) {
  if (!root?.querySelectorAll) return
  // <html> itself carries the dark-mode class, and querySelectorAll on an
  // element never returns that element — so it has to be asked for by name.
  const marked = [...root.querySelectorAll('[data-pwb-state]')]
  if (root.hasAttribute?.('data-pwb-state')) marked.unshift(root)
  marked.forEach((el) => {
    let state
    try {
      state = JSON.parse(el.getAttribute('data-pwb-state') || 'null')
    } catch {
      state = null
    }
    el.removeAttribute('data-pwb-state')
    if (!state?.was) return
    for (const [name, value] of Object.entries(state.was)) {
      const mine = state.now?.[name] ?? null
      const current = el.hasAttribute(name) ? el.getAttribute(name) : null
      if (current !== mine) continue
      if (value === null) el.removeAttribute(name)
      else el.setAttribute(name, value)
    }
  })
}
