// Curated catalogue of Google Fonts the editor can drop into a site without
// the user having to know about Google Fonts URLs.
//
// Each entry is intentionally narrow — picking the ~30 fonts a builder is
// most likely to need keeps the picker scannable and limits how much network
// the published page has to pull on first paint. The `stack` field always
// falls back to a system font of the same flavour so a blocked Google Fonts
// host (corporate filter, offline preview) still gives readable text.
//
// Adding a font: include it in CATEGORIES below + ship a `weights` string in
// CSS @font-face syntax (semicolon-separated wght axis values). The display=swap
// query param keeps text rendered with the fallback while the font loads.

export const GOOGLE_FONTS = [
  // Sans-serif workhorses
  { name: 'Inter', cat: 'sans', weights: '400;500;600;700', stack: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { name: 'Roboto', cat: 'sans', weights: '400;500;700', stack: '"Roboto", system-ui, sans-serif' },
  { name: 'Open Sans', cat: 'sans', weights: '400;600;700', stack: '"Open Sans", system-ui, sans-serif' },
  { name: 'Lato', cat: 'sans', weights: '400;700', stack: '"Lato", system-ui, sans-serif' },
  { name: 'Poppins', cat: 'sans', weights: '400;500;600;700', stack: '"Poppins", system-ui, sans-serif' },
  { name: 'Montserrat', cat: 'sans', weights: '400;500;600;700', stack: '"Montserrat", system-ui, sans-serif' },
  { name: 'Nunito', cat: 'sans', weights: '400;600;700', stack: '"Nunito", system-ui, sans-serif' },
  { name: 'Work Sans', cat: 'sans', weights: '400;500;600;700', stack: '"Work Sans", system-ui, sans-serif' },
  { name: 'DM Sans', cat: 'sans', weights: '400;500;700', stack: '"DM Sans", system-ui, sans-serif' },
  { name: 'Manrope', cat: 'sans', weights: '400;500;600;700', stack: '"Manrope", system-ui, sans-serif' },
  { name: 'Plus Jakarta Sans', cat: 'sans', weights: '400;500;600;700', stack: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { name: 'Outfit', cat: 'sans', weights: '400;500;600;700', stack: '"Outfit", system-ui, sans-serif' },
  // Serif — for editorial / blog / portfolio
  { name: 'Playfair Display', cat: 'serif', weights: '400;500;600;700', stack: '"Playfair Display", Georgia, serif' },
  { name: 'Merriweather', cat: 'serif', weights: '400;700', stack: '"Merriweather", Georgia, serif' },
  { name: 'Lora', cat: 'serif', weights: '400;500;600;700', stack: '"Lora", Georgia, serif' },
  { name: 'Source Serif 4', cat: 'serif', weights: '400;600;700', stack: '"Source Serif 4", Georgia, serif' },
  { name: 'EB Garamond', cat: 'serif', weights: '400;500;600;700', stack: '"EB Garamond", Garamond, serif' },
  { name: 'Cormorant Garamond', cat: 'serif', weights: '400;500;600;700', stack: '"Cormorant Garamond", Garamond, serif' },
  // Display — big headers, posters, hero text
  { name: 'Bebas Neue', cat: 'display', weights: '400', stack: '"Bebas Neue", "Arial Narrow", sans-serif' },
  { name: 'Oswald', cat: 'display', weights: '400;500;600;700', stack: '"Oswald", "Arial Narrow", sans-serif' },
  { name: 'Anton', cat: 'display', weights: '400', stack: '"Anton", "Arial Black", sans-serif' },
  { name: 'Archivo Black', cat: 'display', weights: '400', stack: '"Archivo Black", "Arial Black", sans-serif' },
  { name: 'Space Grotesk', cat: 'display', weights: '400;500;600;700', stack: '"Space Grotesk", system-ui, sans-serif' },
  { name: 'Unbounded', cat: 'display', weights: '400;500;700', stack: '"Unbounded", system-ui, sans-serif' },
  // Monospace — for code-heavy / dashboard / dev portfolio styles
  { name: 'JetBrains Mono', cat: 'mono', weights: '400;500;700', stack: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace' },
  { name: 'Fira Code', cat: 'mono', weights: '400;500;700', stack: '"Fira Code", ui-monospace, monospace' },
  { name: 'Source Code Pro', cat: 'mono', weights: '400;500;700', stack: '"Source Code Pro", ui-monospace, monospace' },
  { name: 'IBM Plex Mono', cat: 'mono', weights: '400;500;700', stack: '"IBM Plex Mono", ui-monospace, monospace' },
  { name: 'Space Mono', cat: 'mono', weights: '400;700', stack: '"Space Mono", ui-monospace, monospace' },
]

export const FONT_CATEGORIES = [
  { id: 'sans', label: 'Sans-serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'mono', label: 'Monospace' },
]

// Build the Google Fonts CSS endpoint URL for a single font definition.
// `&display=swap` keeps text rendered with the fallback stack while the file
// is in flight — no FOIT, no layout shift on slow networks.
export function googleFontHref(font) {
  if (!font || !font.name) return ''
  const family = encodeURIComponent(font.name).replace(/%20/g, '+')
  const weights = (font.weights || '400').replace(/[^0-9;]/g, '')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`
}

// Scan a fontFamily string (or a theme dict) for any known Google Font name
// and return the href that would load it — or '' if none of our curated
// fonts is referenced. Lets the renderer auto-inject <link> tags without
// requiring an explicit theme.googleFont field.
export function googleFontHrefForTheme(themeOrFontFamily) {
  const fontFamily = typeof themeOrFontFamily === 'string'
    ? themeOrFontFamily
    : themeOrFontFamily?.fontFamily
  if (typeof fontFamily !== 'string' || !fontFamily) return ''
  // Look for a quoted family name first (the picker always emits quoted),
  // then fall back to a loose match. Loose match makes sure existing themes
  // with unquoted `Inter, sans-serif` still trigger the load.
  for (const font of GOOGLE_FONTS) {
    const re = new RegExp(`["']?${font.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?`, 'i')
    if (re.test(fontFamily)) return googleFontHref(font)
  }
  return ''
}

// Look up a curated font by display name. Used by the picker to drive the
// "current selection" badge from the theme's free-text fontFamily field.
export function findFontByName(name) {
  if (!name) return null
  const needle = String(name).toLowerCase()
  return GOOGLE_FONTS.find((f) => f.name.toLowerCase() === needle) || null
}

// Render a ready-to-inject <link> tag (preconnect + the stylesheet) for the
// given theme. Returns '' if the theme doesn't reference a curated Google
// Font. The preconnect lets the browser open the TLS handshake to Google's
// font CDN while the stylesheet is still parsing.
export function googleFontLinkTag(themeOrFontFamily) {
  const href = googleFontHrefForTheme(themeOrFontFamily)
  if (!href) return ''
  return (
    '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + `<link rel="stylesheet" href="${href}">`
  )
}
