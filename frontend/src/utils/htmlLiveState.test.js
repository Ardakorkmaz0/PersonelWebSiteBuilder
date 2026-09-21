// Edit mode can't run the page's scripts, so it used to show the document in
// its cold state: dark mode off, every accordion shut, every dropdown closed —
// and no way to edit what was behind them. These pin the bridge that carries
// View's state over, and the rule that none of it reaches the saved file.
import { describe, expect, it } from 'vitest'
import { liveStateDiff, restoreAuthoredState, withLiveState } from './htmlLiveState.js'

const authored = `<!DOCTYPE html><html lang="en" class="scroll-smooth"><head><title>t</title></head>
<body class="bg-white">
  <button id="menu" aria-expanded="false">Menu</button>
  <div id="panel" class="hidden">Behind the click</div>
</body></html>`

// The same document after someone clicked around in View: dark mode on, the
// panel opened.
const live = `<!DOCTYPE html><html lang="en" class="scroll-smooth dark"><head><title>t</title></head>
<body class="bg-white">
  <button id="menu" aria-expanded="true">Menu</button>
  <div id="panel" class="block">Behind the click</div>
  <script data-pwb-state-reporter>/* injected */</scr` + `ipt>
</body></html>`

const parse = (html) => new DOMParser().parseFromString(html, 'text/html')

describe('liveStateDiff', () => {
  it('reports what the page\'s own scripts changed', () => {
    const diff = liveStateDiff(authored, live)
    const changed = diff.map((entry) => entry.attrs)

    expect(changed).toContainEqual({ class: 'scroll-smooth dark' })
    expect(changed).toContainEqual({ 'aria-expanded': 'true' })
    expect(changed).toContainEqual({ class: 'block' })
  })

  it('leaves untouched elements out of it', () => {
    // <head>, <title> and <body> are identical in both, so nothing to carry.
    expect(liveStateDiff(authored, authored)).toEqual([])
  })

  it('ignores content, and anything that is not interaction state', () => {
    const edited = authored.replace('Behind the click', 'Different words').replace('id="menu"', 'id="other"')
    expect(liveStateDiff(authored, edited)).toEqual([])
  })

  it('reports nothing when View sent nothing', () => {
    // The reporter skips a document too big to carry; that is not the same as
    // "the page dropped every attribute it had".
    expect(liveStateDiff(authored, '')).toEqual([])
    expect(liveStateDiff('', '')).toEqual([])
  })

  it('stops at the first branch that does not line up', () => {
    const diff = liveStateDiff(authored, '<p>not this document at all</p>')
    // Whatever it makes of that, it never claims to know about the button.
    expect(diff.every((entry) => entry.path.length <= 1)).toBe(true)
  })
})

describe('withLiveState', () => {
  it('shows the document the way View is showing it', () => {
    const out = withLiveState(authored, liveStateDiff(authored, live))
    const doc = parse(out)

    expect(doc.documentElement.className).toBe('scroll-smooth dark')
    expect(doc.getElementById('panel').className).toBe('block')
    expect(doc.getElementById('menu').getAttribute('aria-expanded')).toBe('true')
  })

  it('records what it replaced so a save can undo it', () => {
    const out = withLiveState(authored, liveStateDiff(authored, live))
    const state = JSON.parse(parse(out).getElementById('panel').getAttribute('data-pwb-state'))

    expect(state.was).toEqual({ class: 'hidden' })
    expect(state.now).toEqual({ class: 'block' })
  })

  it('does nothing without a diff', () => {
    expect(withLiveState(authored, [])).toBe(authored)
  })
})

describe('restoreAuthoredState', () => {
  it('puts the author\'s own attributes back', () => {
    const doc = parse(withLiveState(authored, liveStateDiff(authored, live)))
    restoreAuthoredState(doc.documentElement)

    expect(doc.documentElement.className).toBe('scroll-smooth')
    expect(doc.getElementById('panel').className).toBe('hidden')
    expect(doc.getElementById('menu').getAttribute('aria-expanded')).toBe('false')
    expect(doc.querySelectorAll('[data-pwb-state]')).toHaveLength(0)
  })

  // The borrowed value is only borrowed until the author overrules it.
  it('keeps a value the author changed by hand', () => {
    const doc = parse(withLiveState(authored, liveStateDiff(authored, live)))
    doc.getElementById('panel').className = 'flex gap-2'

    restoreAuthoredState(doc.documentElement)

    expect(doc.getElementById('panel').className).toBe('flex gap-2')
    expect(doc.documentElement.className).toBe('scroll-smooth')
  })
})
