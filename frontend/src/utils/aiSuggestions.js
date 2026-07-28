// Context-aware prompt suggestions for the AI panel.
//
// Two surfaces share ONE engine: the starter cards shown while the chat is
// empty, and the follow-up chips shown after the assistant finishes a job.
// Both answer the same question — "looking at this page as it is right now,
// what is the most useful thing to ask for next?" — so the two can never
// contradict each other, the drift that has bitten this codebase whenever a
// second copy of a rule existed.
//
// Everything is derived from live editor state at render time and nothing is
// persisted: a suggestion cannot outlive the situation that produced it. Add
// a navbar and the "add a navbar" card is gone on the next render.
//
// Rules are ordered most-useful-first and the panel takes the first N that
// match. `label`/`why` are English source strings translated at the call site
// (they are covered by the i18n catalog test); `prompt` is what gets sent to
// the model and deliberately stays English.
import { useEditorStore, selectCurrentPage } from '../store/editorStore.js'
import { registry } from '../components/registry.jsx'
import { DEFAULT_THEME } from './theme.js'

// Types that count as "this page already has X" for the structural rules.
const HEADINGY = ['heading', 'hero']
const INPUTY = ['input', 'select']

function typeLabel(type) {
  return registry[type]?.label || type
}

// Plain snapshot of the editor — no store subscription, no React. Kept
// separate from the rules so tests can feed a hand-written context.
export function readSuggestionContext() {
  const state = useEditorStore.getState()
  const page = selectCurrentPage(state)
  const components = page?.components || []
  const selected = components.find((c) => c.id === state.selectedId) || null
  const theme = state.schema?.theme || {}
  return {
    isHtmlSite: page?.mode === 'html',
    componentCount: components.length,
    types: components.map((c) => c.type),
    pageCount: state.schema?.pages?.length || 1,
    hasMotion: components.some((c) => c.props?.animIn && c.props.animIn !== 'none'),
    hasSeo: !!String(page?.seoDescription || '').trim(),
    themeIsDefault:
      theme.primaryColor === DEFAULT_THEME.primaryColor &&
      theme.fontFamily === DEFAULT_THEME.fontFamily,
    selected: selected
      ? {
          type: selected.type,
          // Never undefined: a legacy or unknown type falls back to its own
          // type name, so the rules that interpolate this always have a word.
          label: typeLabel(selected.type) || 'component',
          hasMotion: !!selected.props?.animIn && selected.props.animIn !== 'none',
        }
      : null,
  }
}

const has = (ctx, ...types) => types.some((type) => ctx.types.includes(type))

// --- Component-canvas rules ------------------------------------------------
const CANVAS_RULES = [
  {
    id: 'build-page',
    when: (ctx) => ctx.componentCount === 0,
    label: 'Build this page for me',
    why: 'This page is empty',
    prompt:
      'Build a complete one-page site: a navigation bar at the top, a hero section with a big headline, a short paragraph and a primary call-to-action button, a features section with three cards, and a footer. Use a modern, clean look with plenty of spacing.',
  },
  {
    id: 'restyle-selected',
    when: (ctx) => !!ctx.selected,
    label: 'Restyle the selected {name}',
    why: 'You have a {name} selected',
    vars: (ctx) => ({ name: ctx.selected.label }),
    prompt: (ctx) =>
      `Restyle the currently selected ${ctx.selected.label.toLowerCase()} so it looks more modern and polished — spacing, colours, typography and rounding. Keep its text and position.`,
  },
  {
    id: 'animate-selected',
    when: (ctx) => !!ctx.selected && !ctx.selected.hasMotion,
    label: 'Animate the selected {name}',
    why: 'It has no entrance animation',
    vars: (ctx) => ({ name: ctx.selected.label }),
    prompt: (ctx) =>
      `Give the currently selected ${ctx.selected.label.toLowerCase()} a subtle fade-up entrance animation and a gentle lift on hover.`,
  },
  {
    id: 'add-navbar',
    when: (ctx) => ctx.componentCount > 0 && !has(ctx, 'navbar'),
    label: 'Add a navigation bar',
    why: 'This page has no navbar',
    prompt:
      'Add a navigation bar at the top of the page with the site name on the left and Home, About and Contact links on the right. Match it to the current theme colours.',
  },
  {
    id: 'add-hero',
    when: (ctx) => ctx.componentCount > 0 && ctx.componentCount < 5 && !has(ctx, ...HEADINGY),
    label: 'Add a hero section',
    why: 'There is no headline at the top',
    prompt:
      'Add a hero section below the navbar: a large headline, a supporting sentence and a primary call-to-action button, centred with generous vertical padding.',
  },
  {
    id: 'add-motion',
    when: (ctx) => ctx.componentCount >= 3 && !ctx.hasMotion,
    label: 'Animate the page',
    why: 'Nothing on this page animates yet',
    prompt:
      'Add tasteful entrance animations to this page: fade the hero up first, then reveal the sections below it one after another with a small stagger. Keep it subtle and fast.',
  },
  {
    id: 'write-seo',
    when: (ctx) => ctx.componentCount >= 3 && !ctx.hasSeo,
    label: 'Write the SEO description',
    why: 'Search results will show no summary',
    prompt:
      'Read this page and write a search-engine title (under 60 characters) and a meta description (under 155 characters) that describe it accurately, then set them on the page.',
  },
  {
    id: 'add-contact',
    when: (ctx) => ctx.componentCount >= 4 && !has(ctx, ...INPUTY),
    label: 'Add a contact section',
    why: 'Visitors have no way to reach you',
    prompt:
      'Add a contact section at the bottom of the page with a short heading, a name field, an email field, a message field and a send button.',
  },
  {
    id: 'pick-palette',
    when: (ctx) => ctx.componentCount >= 2 && ctx.themeIsDefault,
    label: 'Pick a colour palette',
    why: 'The site still uses the default theme',
    prompt:
      'Choose a confident colour palette for this site and apply it to the theme — primary, text, muted, background and surface colours plus a font that suits it. Explain the choice in one sentence.',
  },
  {
    id: 'add-page',
    when: (ctx) => ctx.pageCount === 1 && ctx.componentCount >= 4,
    label: 'Add an About page',
    why: 'The site is a single page',
    prompt:
      'Add a second page called About with a heading, two paragraphs of placeholder biography and a photo, then link it from the navigation bar.',
  },
  {
    id: 'add-footer',
    when: (ctx) => ctx.componentCount >= 4 && !has(ctx, 'section', 'region'),
    label: 'Add a footer',
    why: 'The page ends abruptly',
    prompt:
      'Add a footer band at the bottom of the page with the site name, a short copyright line and three small links.',
  },
]

// --- HTML-document rules ---------------------------------------------------
// On an HTML page the AI rewrites the document, so structural component rules
// do not apply — these are phrased as document-level edits instead.
const HTML_RULES = [
  {
    id: 'html-polish',
    when: () => true,
    label: 'Polish the design',
    why: 'Same content, better spacing and type',
    prompt:
      'Improve the visual design of this page without changing any of the text: spacing, typography scale, colour contrast and rounding. Keep every section.',
  },
  {
    id: 'html-responsive',
    when: () => true,
    label: 'Make it work on phones',
    why: 'Check the layout at 390px wide',
    prompt:
      'Make this page fully responsive: stack the layout on narrow screens, scale the type down, and make sure nothing overflows horizontally at 390px. Keep the desktop layout as it is.',
  },
  {
    id: 'html-section',
    when: () => true,
    label: 'Add a section',
    why: 'Grow the page',
    prompt:
      'Add a features section with three cards (icon, title, one-sentence description) before the footer, styled to match the rest of the page.',
  },
  {
    id: 'html-dark',
    when: () => true,
    label: 'Add a dark mode',
    why: 'Follow the visitor system theme',
    prompt:
      'Add a dark colour scheme to this page using prefers-color-scheme, keeping the same layout and content.',
  },
]

// Every label/why string that can reach the screen, for the i18n catalog test.
export const SUGGESTION_STRINGS = [...CANVAS_RULES, ...HTML_RULES].flatMap((r) => [r.label, r.why])

// Resolve the matching rules into ready-to-render suggestions.
//
// `exclude` holds ids the user already acted on in this session — asking
// someone to "add a navbar" right after they asked for one is the fastest way
// to make suggestions feel canned, so a used id never comes back.
export function buildAiSuggestions(ctx, { limit = 4, exclude = [] } = {}) {
  if (!ctx) return []
  const rules = ctx.isHtmlSite ? HTML_RULES : CANVAS_RULES
  const skip = new Set(exclude)
  const out = []
  for (const rule of rules) {
    if (out.length >= limit) break
    if (skip.has(rule.id)) continue
    // The whole resolution is guarded, not just `when`: `vars` and `prompt`
    // read the context too, and a rule that throws in either would take the
    // entire AI panel down with it — this runs during render. A rule that
    // cannot describe the current page is simply not offered.
    try {
      if (!rule.when(ctx)) continue
      out.push({
        id: rule.id,
        label: rule.label,
        why: rule.why,
        vars: typeof rule.vars === 'function' ? rule.vars(ctx) : undefined,
        prompt: typeof rule.prompt === 'function' ? rule.prompt(ctx) : rule.prompt,
      })
    } catch {
      /* malformed context — skip this rule, keep the rest */
    }
  }
  return out
}
