// The three ways to start a site here, as the ⓘ panel in the header tells them.
//
// Kept as data rather than markup so the panel stays a layout and the wording
// stays reviewable — and so a feature can be added without touching the
// animation. Strings are English sources; the panel runs them through t().

export const APP_FEATURES = [
  {
    id: 'empty',
    icon: 'page',
    title: 'Start from an empty page',
    summary: 'A blank canvas and a block library — no template to fight.',
    points: [
      'Drag blocks in, or let AI draft the first version',
      'Separate phone layout, so mobile is designed, not squeezed',
      'Publish to your address in one click',
    ],
  },
  {
    id: 'upload',
    icon: 'upload',
    title: 'Bring your own HTML',
    summary: 'Upload a page you already have and keep editing it here.',
    points: [
      'Click any text to rewrite it, drag blocks to reorder',
      'Your markup stays yours — nothing is regenerated behind your back',
      'Source view is the real file, always one click away',
    ],
  },
  {
    id: 'local',
    icon: 'folder',
    title: 'Open a local project',
    summary: 'Edit HTML, CSS and JS straight from a folder on your computer.',
    points: [
      'Changes are written back to the files themselves',
      'Linked CSS and JS resolve, so the preview is the real page',
    ],
    // Said plainly rather than discovered the hard way: this one is new, it
    // needs an API only Chromium browsers ship, and it can still surprise you.
    caveat: 'Early version — not recommended for important work yet. Needs a Chromium browser (Chrome or Edge).',
  },
]
