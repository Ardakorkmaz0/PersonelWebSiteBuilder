// What the editor walkthrough says, and whether it has already been said.
//
// Separate from the component so the steps can be read (and tested) without
// rendering anything — and because a component file that also exports
// constants breaks fast refresh.

export const EDITOR_TOUR_KEY = 'pwb_editor_tour_v1'

export const EDITOR_TOUR_STEPS = [
  {
    id: 'rail',
    target: '[data-tour="rail-left"]',
    title: 'Pages and blocks',
    body: 'Your pages live here. Add one, open its files, or pick a block and drop it on the canvas.',
  },
  {
    id: 'modes',
    target: '[data-tour="canvas-modes"]',
    title: 'Edit, View, Source',
    body: 'Edit is where you build. View plays the page for real, and Source is the code behind it.',
  },
  {
    id: 'devices',
    target: '[data-tour="devices"]',
    title: 'Phone layout',
    body: 'The phone is designed separately: what you move on Mobile stays on mobile.',
  },
  {
    id: 'tools',
    target: '[data-tour="canvas-tools"]',
    title: 'Canvas tools',
    body: 'Grid, link and brush live here — along with Live code, which shows the line every edit writes.',
  },
  {
    id: 'properties',
    target: '[data-tour="properties"]',
    title: 'Properties',
    body: 'Whatever you select is edited here. With nothing selected it is the page itself: language, direction, search metadata.',
  },
  {
    id: 'ai',
    target: '[data-tour="ai"]',
    title: 'Ask AI',
    body: 'Ask for a section, a rewrite, or a whole page. Nothing lands before you accept it.',
  },
  {
    id: 'publish',
    target: '[data-tour="publish"]',
    title: 'Save and publish',
    body: 'Save keeps your work. Publish puts it online — and you can reopen this tour any time from the ⋯ menu.',
  },
]

export function tourWasSeen() {
  try { return localStorage.getItem(EDITOR_TOUR_KEY) === '1' }
  catch { return true } // no storage: treat it as seen rather than nag every visit
}

export function markTourSeen() {
  try { localStorage.setItem(EDITOR_TOUR_KEY, '1') } catch { /* ignore */ }
}
