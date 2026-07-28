// The dark theme is a patch layer, so it has to be told about every colour.
//
// Most of the UI is written in light-mode hex literals (`bg-[#f3f4f6]`,
// `text-[#6b7280]`, …) and dark mode works by enumerating those literals in
// index.css and overriding them. A colour nobody remembered to add to the list
// silently ships as its light value on a dark surface — which is how a
// near-white chip ended up in the editor header and a beige track ended up
// around the segmented toggle.
//
// darkThemeConsistency.test.js checks the palette EXISTS. This one checks it is
// actually REACHED: it is a ratchet, not a cleanup. The literals already
// outside the patch layer are listed below with a reason; anything new fails.
// Use a var(--studio-*) token in new code and this never comes up.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve('src')

// Modules that describe the USER's site rather than our chrome. Their colours
// are content, not theme, and must not follow the builder's dark mode.
const CONTENT_MODULES = /[\\/](htmlTemplates|templateLibrary|htmlVariants|aiTemplates|htmlTheme|theme|componentPresets|blocks|presetImages|snippets|htmlToSchema|responsiveHtml|schemaToFiles|componentToHtml|htmlRecolor|htmlEmbedDocument|htmlRuntime|htmlFiles|exportHtml|icons|htmlSnippetSizing)\.jsx?$/
const CONTENT_DIRS = /[\\/]components[\\/](registry|renderer)/

// Literals deliberately — or knowingly — outside the patch layer. Each is a
// decision, not a licence to add more.
const ALLOWED = new Map([
  // Code-editor and device chrome: dark in BOTH themes on purpose.
  ['#0d1117', 'code editor surface — dark in both themes'],
  ['#1e1e1e', 'code editor surface — dark in both themes'],
  ['#252526', 'code editor gutter — dark in both themes'],
  ['#202631', 'code panel chrome — dark in both themes'],
  ['#151a23', 'code panel toolbar — dark in both themes'],
  ['#0b0b0b', 'device frame bezel — dark in both themes'],
  // Fixed brand / OS colours that must not shift with the theme.
  ['#ff5f57', 'macOS window-control red'],
  ['#febc2e', 'macOS window-control amber'],
  ['#28c840', 'macOS window-control green'],
  // Semantic accents that read correctly on both surfaces.
  ['#16a34a', 'success dot / button — same green in both themes'],
  ['#fbbf24', 'favourite star hover'],
  ['#818cf8', 'chart bar fill'],
  ['#7f1d1d', 'destructive hover on an inverted toolbar'],
  ['#991b1b', 'destructive hover on an inverted toolbar'],
  ['#bfdbfe', 'drop-indicator tint'],
  ['#dbeafe', 'drop-indicator tint'],
  ['#93c5fd', 'drop-indicator tint'],
  ['#fde68a', 'inline warning tint'],
  ['#bbf7d0', 'inline success tint'],
  ['#f0fdf4', 'inline success tint'],
  ['#166534', 'inline success text'],
  ['#fafaff', 'palette swatch background'],
  ['#111827', 'wizard preview frame border'],
  // The dark-theme audit's findings were fixed rather than accepted: the
  // linked-file chip, the two light pills, the warning bar and the admin label
  // now use tokens or the shared .studio-status-* treatment. The segmented
  // control is the one that keeps its literals: its warm paper look is
  // deliberate in light mode, so dark mode redefines the RELATIONSHIP (recessed
  // track, raised active pill) in index.css instead of flattening the colours.
  ['#eae7e0', 'segmented-toggle track — warm in light, remapped in index.css'],
  ['#76736b', 'segmented-toggle inactive label — remapped in index.css'],
])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(p)
  }
  return out
}

function patchedLiterals() {
  const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
  const blocks = css.match(/:root\[data-ui-theme="dark"\][\s\S]*?\n\}/g) || []
  return new Set((blocks.join('\n').match(/#[0-9a-fA-F]{3,8}/g) || []).map((c) => c.toLowerCase()))
}

function uiColourUses() {
  const uses = new Map() // literal -> Set(file)
  for (const file of walk(SRC)) {
    if (CONTENT_MODULES.test(file) || CONTENT_DIRS.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(
      /\b(?:bg|text|border|from|to|via|ring|outline|shadow|fill|stroke|decoration|placeholder|caret|divide|accent)-\[(#[0-9a-fA-F]{3,8})\]/g,
    )) {
      const lit = m[1].toLowerCase()
      if (!uses.has(lit)) uses.set(lit, new Set())
      uses.get(lit).add(path.relative(SRC, file).replace(/\\/g, '/'))
    }
  }
  return uses
}

describe('dark theme colour coverage', () => {
  const uses = uiColourUses()
  const patched = patchedLiterals()

  it('the scan actually found the UI (guards the ratchet below)', () => {
    expect(uses.size).toBeGreaterThan(30)
    expect(patched.size).toBeGreaterThan(20)
  })

  it('no NEW hardcoded colour escapes the dark patch layer', () => {
    const escaped = []
    for (const [lit, files] of uses) {
      if (patched.has(lit) || ALLOWED.has(lit)) continue
      escaped.push(`${lit} — used in ${[...files].slice(0, 3).join(', ')}`)
    }
    expect(
      escaped.sort(),
      'These colours render as their light value on a dark surface. Prefer a '
      + 'var(--studio-*) token; if the colour must stay fixed in both themes, '
      + 'add it to ALLOWED in this file with the reason.',
    ).toEqual([])
  })

  it('every ALLOWED entry is still in use (keeps the list honest)', () => {
    const stale = [...ALLOWED.keys()].filter((lit) => !uses.has(lit))
    expect(stale, 'remove these from ALLOWED — nothing uses them any more').toEqual([])
  })
})
