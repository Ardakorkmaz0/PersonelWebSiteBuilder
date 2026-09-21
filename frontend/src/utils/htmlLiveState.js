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

// Where an element sits, as child indices from <html>. Both documents come
// from the same file, so the path lines up — and every step re-checks the tag
// name, so a script that inserted a node somewhere stops the walk there
// instead of dressing the wrong element.
export function liveStateDiff(authoredHtml, liveHtml) {
  // No report is not the same as "the page dropped every attribute": the
  // reporter sends nothing when the document is too big to carry.
  if (!String(liveHtml || '').trim()) return []
  const authored = parse(authoredHtml)?.documentElement
  const live = parse(liveHtml)?.documentElement
  if (!authored || !live || authored.tagName !== live.tagName) return []

  const out = []
  const visit = (a, b, path) => {
    if (out.length >= MAX_ENTRIES) return
    const attrs = attributeChanges(a, b)
    if (Object.keys(attrs).length) out.push({ path, attrs })
    const aKids = a.children
    const bKids = b.children
    const shared = Math.min(aKids.length, bKids.length)
    for (let i = 0; i < shared; i += 1) {
      if (aKids[i].tagName !== bKids[i].tagName) break
      visit(aKids[i], bKids[i], [...path, i])
    }
  }
  visit(authored, live, [])
  return out
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
  if (!Array.isArray(diff) || !diff.length) return String(html || '')
  const doc = parse(html)
  if (!doc?.documentElement) return String(html || '')

  let touched = 0
  for (const { path, attrs } of diff) {
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
