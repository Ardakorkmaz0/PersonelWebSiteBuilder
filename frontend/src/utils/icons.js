// Simple line icons (24x24, stroke-based). The path data is our own trusted
// constant, so it can be rendered inline — React builds the <path> in the editor,
// and the export builds the identical string. Stroke + size come from the caller.
export const ICONS = {
  star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5-4.8-4.6 6.6-.9z',
  heart: 'M19 14c1.5-1.6 3-3.5 3-5.6A4.4 4.4 0 0012.9 6 4.4 4.4 0 003.9 8.4c0 2.1 1.5 4 3 5.6l5.1 5z',
  check: 'M20 6L9 17l-5-5',
  arrowRight: 'M5 12h14M13 5l7 7-7 7',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  user: 'M4 21a8 8 0 0116 0M12 11a4 4 0 100-8 4 4 0 000 8',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16',
  link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  menu: 'M3 6h18M3 12h18M3 18h18',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18',
}

export const ICON_NAMES = Object.keys(ICONS)
const ICON_LABELS = {
  star: 'Star',
  heart: 'Heart',
  check: 'Check',
  arrowRight: 'Arrow right',
  mail: 'Mail',
  phone: 'Phone',
  home: 'Home',
  user: 'User',
  search: 'Search',
  link: 'Link',
  menu: 'Menu',
  globe: 'Globe',
}
export const ICON_OPTIONS = ICON_NAMES.map((name) => [name, ICON_LABELS[name]])

// Build the inline <svg> string (used by the HTML export). `name` is looked up in
// the trusted ICONS map, so nothing user-supplied ends up in the markup.
export function iconSvg(name) {
  const d = ICONS[name] || ICONS.star
  return (
    `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
  )
}
