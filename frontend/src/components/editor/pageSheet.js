// A floating-sheet drop shadow so the design reads as an actual PAGE resting on
// the workspace. Shared by the Edit canvas and the View preview so both frame
// the page identically and its real edges are always obvious — the visual
// bridge between editing and previewing.
// A hairline ring keeps the page edge crisp even where the workspace clips the
// soft shadow, so the boundary is never ambiguous.
export const PAGE_SHEET_SHADOW =
  '0 0 0 1px rgba(15,23,42,0.10), 0 18px 48px rgba(15,23,42,0.22), 0 4px 12px rgba(15,23,42,0.10)'
