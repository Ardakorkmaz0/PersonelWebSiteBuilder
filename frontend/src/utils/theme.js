// One-click theme presets: picking one replaces the palette AND re-themes
// the existing components (the panel calls applyTheme right after). New
// components always inherit the active theme via themedStyles().
export const THEME_PRESETS = [
  { id: 'apple', name: 'Clean Apple', theme: { primaryColor: '#0071e3', textColor: '#1d1d1f', mutedColor: '#6e6e73', backgroundColor: '#ffffff', surfaceColor: '#ffffff', softColor: '#f5f5f7', headerColor: '#1d1d1f', headerTextColor: '#f5f5f7', fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", radius: '18px', buttonRadius: '980px' } },
  { id: 'indigo', name: 'Indigo SaaS', theme: { primaryColor: '#4f46e5', textColor: '#171723', mutedColor: '#62636f', backgroundColor: '#ffffff', surfaceColor: '#ffffff', softColor: '#f4f4fb', headerColor: '#ffffff', headerTextColor: '#171723', fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', radius: '14px', buttonRadius: '10px' } },
  { id: 'coral', name: 'Warm Coral', theme: { primaryColor: '#e8543f', textColor: '#27201e', mutedColor: '#766a66', backgroundColor: '#fffaf7', surfaceColor: '#ffffff', softColor: '#fcefe9', headerColor: '#fffaf7', headerTextColor: '#27201e', fontFamily: '"Poppins", system-ui, sans-serif', radius: '18px', buttonRadius: '999px' } },
  { id: 'forest', name: 'Forest Calm', theme: { primaryColor: '#166534', textColor: '#1a2e1f', mutedColor: '#5c6f61', backgroundColor: '#fbfdf9', surfaceColor: '#ffffff', softColor: '#eef4ec', headerColor: '#1a2e1f', headerTextColor: '#eef4ec', fontFamily: '"DM Sans", system-ui, sans-serif', radius: '10px', buttonRadius: '8px' } },
  { id: 'noir', name: 'Noir Gold', theme: { primaryColor: '#eab308', textColor: '#f1efe9', mutedColor: '#a6a195', backgroundColor: '#121110', surfaceColor: '#181614', softColor: '#1a1917', headerColor: '#121110', headerTextColor: '#f1efe9', fontFamily: '"DM Sans", system-ui, sans-serif', radius: '2px', buttonRadius: '2px' } },
  { id: 'ocean', name: 'Ocean Teal', theme: { primaryColor: '#0e7490', textColor: '#102a33', mutedColor: '#5b7480', backgroundColor: '#ffffff', surfaceColor: '#ffffff', softColor: '#f0f7f9', headerColor: '#0e7490', headerTextColor: '#ffffff', fontFamily: '"Open Sans", system-ui, sans-serif', radius: '12px', buttonRadius: '10px' } },
  { id: 'plum', name: 'Plum Elegant', theme: { primaryColor: '#86198f', textColor: '#241627', mutedColor: '#73637a', backgroundColor: '#fefcff', surfaceColor: '#ffffff', softColor: '#f8f0fa', headerColor: '#fefcff', headerTextColor: '#241627', fontFamily: '"Lora", Georgia, serif', radius: '16px', buttonRadius: '999px' } },
  { id: 'mono', name: 'Minimal Mono', theme: { primaryColor: '#111111', textColor: '#111111', mutedColor: '#6f6f6f', backgroundColor: '#ffffff', surfaceColor: '#ffffff', softColor: '#f5f5f5', headerColor: '#ffffff', headerTextColor: '#111111', fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', radius: '0px', buttonRadius: '0px' } },
  { id: 'slate', name: 'Slate Dark', theme: { primaryColor: '#38bdf8', textColor: '#e8edf4', mutedColor: '#94a3b8', backgroundColor: '#0b1220', surfaceColor: '#0f1828', softColor: '#101a2e', headerColor: '#0b1220', headerTextColor: '#e8edf4', fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', radius: '12px', buttonRadius: '10px' } },
  { id: 'ivory', name: 'Ivory Serif', theme: { primaryColor: '#9a6b4f', textColor: '#2c2520', mutedColor: '#7c7167', backgroundColor: '#faf7f2', surfaceColor: '#fffdf9', softColor: '#f1ebe1', headerColor: '#2c2520', headerTextColor: '#faf7f2', fontFamily: '"Playfair Display", Georgia, serif', radius: '4px', buttonRadius: '4px' } },
]

export const DEFAULT_THEME = {
  primaryColor: '#0071e3',
  textColor: '#1d1d1f',
  mutedColor: '#6e6e73',
  backgroundColor: '#ffffff',
  surfaceColor: '#ffffff',
  softColor: '#f5f5f7',
  headerColor: '#1d1d1f',
  headerTextColor: '#f5f5f7',
  fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  radius: '18px',
  buttonRadius: '980px',
  shadow: '0 4px 20px rgba(0,0,0,0.08)',
}

// Auto-imported so we don't have to keep two lists in sync. Google fonts are
// added below in the same [stack, label] shape FONT_OPTIONS already uses.
import { GOOGLE_FONTS } from './googleFonts.js'

const SYSTEM_FONT_OPTIONS = [
  [DEFAULT_THEME.fontFamily, 'System'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times'],
  ['"Courier New", Courier, monospace', 'Monospace'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['"Trebuchet MS", Helvetica, sans-serif', 'Trebuchet'],
]

const GOOGLE_FONT_OPTIONS = GOOGLE_FONTS.map((f) => [f.stack, `${f.name} · Google`])

// Every font the theme dropdown lists. System fonts first (zero network),
// curated Google Fonts after. Selecting a Google entry trips the
// auto-injection in EditorPage / PreviewPage / the HTML emitters so the
// preview matches the published page without any extra plumbing.
export const FONT_OPTIONS = [...SYSTEM_FONT_OPTIONS, ...GOOGLE_FONT_OPTIONS]

const THEME_KEYS = Object.keys(DEFAULT_THEME)

function cleanThemeValue(value, fallback) {
  if (typeof value !== 'string') return fallback
  const v = value.replace(/[;{}<>]/g, '').trim()
  if (!v) return fallback
  const low = v.toLowerCase()
  if (low.includes('javascript:') || low.includes('expression(') || low.includes('url(')) {
    return fallback
  }
  return v.slice(0, 180)
}

function cssValue(value, fallback = '') {
  return cleanThemeValue(value, fallback)
}

export function normalizeTheme(theme) {
  const input = theme && typeof theme === 'object' ? theme : {}
  return THEME_KEYS.reduce((out, key) => {
    out[key] = cleanThemeValue(input[key], DEFAULT_THEME[key])
    return out
  }, {})
}

export function safeCustomCss(css) {
  if (typeof css !== 'string') return ''
  return css
    .replace(/<\/style/gi, '<\\/style')
    .replace(/<script/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, 20000)
}

export function themeVariablesCss(theme) {
  const t = normalizeTheme(theme)
  return `:root {
  --site-primary: ${cssValue(t.primaryColor)};
  --site-text: ${cssValue(t.textColor)};
  --site-muted: ${cssValue(t.mutedColor)};
  --site-bg: ${cssValue(t.backgroundColor)};
  --site-surface: ${cssValue(t.surfaceColor)};
  --site-soft: ${cssValue(t.softColor)};
  --site-header: ${cssValue(t.headerColor)};
  --site-header-text: ${cssValue(t.headerTextColor)};
  --site-font: ${cssValue(t.fontFamily)};
  --site-radius: ${cssValue(t.radius)};
  --site-button-radius: ${cssValue(t.buttonRadius)};
  --site-shadow: ${cssValue(t.shadow)};
}`
}

export function customCssBlock(customCss) {
  const css = safeCustomCss(customCss)
  return css ? `\n/* Custom CSS */\n${css}` : ''
}

// Mirrors safeCustomCss. The published page wraps user JS in a sandboxed
// iframe, so the only literal we must escape is `</script` — otherwise a stray
// occurrence would close the script tag and break the rest of the document.
// Length-capped at 50KB to match the backend.
export function safeCustomJs(js) {
  if (typeof js !== 'string') return ''
  return js.replace(/<\/\s*script/gi, '<\\/script').slice(0, 50000)
}

export function customJsBlock(customJs) {
  const js = safeCustomJs(customJs)
  if (!js) return ''
  // Concatenated so this module's own source never contains a literal
  // `</script>` end tag (the emitted HTML still gets one).
  return `<script data-builder-custom-js>\n${js}\n</scr` + 'ipt>'
}

export function themeCss(theme, customCss = '') {
  return `${themeVariablesCss(theme)}${customCssBlock(customCss)}`
}

export function themedStyles(type, baseStyles = {}, theme = DEFAULT_THEME) {
  const t = normalizeTheme(theme)
  const styles = { ...baseStyles }
  switch (type) {
    case 'navbar':
      return {
        ...styles,
        backgroundColor: t.headerColor,
        color: t.headerTextColor,
        fontFamily: t.fontFamily,
      }
    case 'heading':
    case 'text':
      return {
        ...styles,
        color: t.textColor,
        fontFamily: t.fontFamily,
      }
    case 'button':
      return {
        ...styles,
        backgroundColor: t.primaryColor,
        color: '#ffffff',
        borderRadius: t.buttonRadius,
        fontFamily: t.fontFamily,
      }
    case 'linkbutton':
      return {
        ...styles,
        color: t.primaryColor,
        fontFamily: t.fontFamily,
      }
    case 'image':
      return {
        ...styles,
        borderRadius: t.radius,
      }
    case 'section':
      return {
        ...styles,
        backgroundColor: t.softColor,
        color: t.textColor,
        borderRadius: t.radius,
        fontFamily: t.fontFamily,
      }
    case 'card':
      return {
        ...styles,
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        boxShadow: t.shadow,
        fontFamily: t.fontFamily,
      }
    case 'divider':
      return {
        ...styles,
        backgroundColor: t.mutedColor,
      }
    default:
      return styles
  }
}

export function applyThemeToSchema(schema) {
  const theme = normalizeTheme(schema?.theme)
  const pages = (schema?.pages || []).map((page) => ({
    ...page,
    background: theme.backgroundColor,
    backgroundMobile: theme.backgroundColor,
    components: (page.components || []).map((component) => ({
      ...component,
      styles: themedStyles(component.type, component.styles || {}, theme),
    })),
  }))
  return {
    ...schema,
    theme,
    customCss: typeof schema?.customCss === 'string' ? schema.customCss : '',
    pages,
  }
}
