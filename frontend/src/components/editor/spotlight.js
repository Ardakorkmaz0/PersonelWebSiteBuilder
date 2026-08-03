// The widths worth checking something at: a comfortable desktop column, a
// tablet, and the phone that everything eventually has to survive. Its own
// module so the shell can stay a component-only file.
export const SPOTLIGHT_WIDTHS = [
  ['desktop', 1100, 'Desktop'],
  ['tablet', 760, 'Tablet'],
  ['phone', 390, 'Phone'],
]

// The canvas floats its selection toolbar at 1100 so it clears a lifted
// component's wrapper. The spotlight is a modal and has to clear ALL of that —
// the first version sat at 200 and the selection frame and its toolbar painted
// straight over the blurred backdrop, still clickable.
export const CANVAS_SELECTION_Z = 1100
export const SPOTLIGHT_Z = 2000

// The toolbar button both opens and closes the spotlight: pressing it again is
// how you leave, without hunting for the × or remembering that Escape works.
// Returns the next target — null when the same thing is already open.
export function toggleSpotlightTarget(current, next) {
  if (next == null) return null
  return current === next ? null : next
}
