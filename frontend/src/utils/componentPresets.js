import { normalizeTheme } from './theme.js'

export const COMPONENT_PRESETS = {
  navbar: [
    { id: 'dark', label: 'Dark bar' },
    { id: 'light', label: 'Light bar' },
    { id: 'accent', label: 'Accent bar' },
    { id: 'glass', label: 'Glass bar' },
  ],
  heading: [
    { id: 'display', label: 'Display' },
    { id: 'quiet', label: 'Quiet' },
    { id: 'centered', label: 'Centered' },
  ],
  text: [
    { id: 'body', label: 'Body copy' },
    { id: 'lead', label: 'Lead text' },
    { id: 'muted', label: 'Muted text' },
  ],
  button: [
    { id: 'solid', label: 'Solid' },
    { id: 'outline', label: 'Outline' },
    { id: 'ghost', label: 'Ghost' },
    { id: 'sharp', label: 'Sharp' },
  ],
  linkbutton: [
    { id: 'plain', label: 'Plain link' },
    { id: 'pill', label: 'Soft pill' },
    { id: 'underline', label: 'Underline' },
  ],
  image: [
    { id: 'rounded', label: 'Rounded' },
    { id: 'square', label: 'Square' },
    { id: 'framed', label: 'Framed' },
  ],
  section: [
    { id: 'soft', label: 'Soft band' },
    { id: 'dark', label: 'Dark band' },
    { id: 'accent', label: 'Accent band' },
  ],
  card: [
    { id: 'elevated', label: 'Elevated' },
    { id: 'flat', label: 'Flat' },
    { id: 'outline', label: 'Outline' },
    { id: 'soft', label: 'Soft' },
  ],
  divider: [
    { id: 'subtle', label: 'Subtle' },
    { id: 'accent', label: 'Accent' },
    { id: 'thick', label: 'Thick' },
  ],
}

export function presetsForType(type) {
  return COMPONENT_PRESETS[type] || []
}

export function presetOptions(type) {
  return [['', 'Choose a preset'], ...presetsForType(type).map((p) => [p.id, p.label])]
}

export function componentPresetStyles(type, presetId, theme) {
  const t = normalizeTheme(theme)
  const transparent = 'transparent'
  const border = '1px'
  const none = 'none'

  const map = {
    navbar: {
      dark: { backgroundColor: t.headerColor, color: t.headerTextColor, boxShadow: none },
      light: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
      },
      accent: { backgroundColor: t.primaryColor, color: '#ffffff', boxShadow: none },
      glass: {
        backgroundColor: 'rgba(255,255,255,0.82)',
        color: t.textColor,
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
      },
    },
    heading: {
      display: {
        color: t.textColor,
        fontFamily: t.fontFamily,
        fontSize: '56px',
        fontWeight: '700',
        lineHeight: '1.05',
      },
      quiet: {
        color: t.mutedColor,
        fontFamily: t.fontFamily,
        fontSize: '34px',
        fontWeight: '500',
      },
      centered: {
        color: t.textColor,
        fontFamily: t.fontFamily,
        textAlign: 'center',
        fontWeight: '700',
      },
    },
    text: {
      body: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '18px', lineHeight: '1.6' },
      lead: { color: t.textColor, fontFamily: t.fontFamily, fontSize: '22px', lineHeight: '1.45' },
      muted: { color: t.mutedColor, fontFamily: t.fontFamily, fontSize: '17px', lineHeight: '1.6' },
    },
    button: {
      solid: {
        backgroundColor: t.primaryColor,
        color: '#ffffff',
        borderRadius: t.buttonRadius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      outline: {
        backgroundColor: transparent,
        color: t.primaryColor,
        borderRadius: t.buttonRadius,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: t.primaryColor,
        boxShadow: none,
      },
      ghost: {
        backgroundColor: t.softColor,
        color: t.textColor,
        borderRadius: t.buttonRadius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      sharp: {
        backgroundColor: t.textColor,
        color: '#ffffff',
        borderRadius: '4px',
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
    },
    linkbutton: {
      plain: {
        color: t.primaryColor,
        backgroundColor: transparent,
        padding: '0px',
        borderRadius: '0px',
        textDecoration: 'none',
      },
      pill: {
        color: t.primaryColor,
        backgroundColor: t.softColor,
        padding: '10px 18px',
        borderRadius: t.buttonRadius,
        textDecoration: 'none',
      },
      underline: {
        color: t.textColor,
        backgroundColor: transparent,
        padding: '0px',
        borderRadius: '0px',
        textDecoration: 'underline',
      },
    },
    image: {
      rounded: { borderRadius: t.radius, borderWidth: '0px', borderStyle: 'none', boxShadow: none },
      square: { borderRadius: '0px', borderWidth: '0px', borderStyle: 'none', boxShadow: none },
      framed: {
        borderRadius: t.radius,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: 'rgba(0,0,0,0.12)',
        boxShadow: t.shadow,
      },
    },
    section: {
      soft: { backgroundColor: t.softColor, color: t.textColor, borderRadius: t.radius, boxShadow: none },
      dark: { backgroundColor: t.headerColor, color: t.headerTextColor, borderRadius: t.radius, boxShadow: none },
      accent: { backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: t.radius, boxShadow: none },
    },
    card: {
      elevated: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: t.shadow,
      },
      flat: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
      outline: {
        backgroundColor: t.surfaceColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: 'rgba(0,0,0,0.12)',
        boxShadow: none,
      },
      soft: {
        backgroundColor: t.softColor,
        color: t.textColor,
        borderRadius: t.radius,
        borderWidth: '0px',
        borderStyle: 'none',
        boxShadow: none,
      },
    },
    divider: {
      subtle: { backgroundColor: 'rgba(0,0,0,0.12)', opacity: '1' },
      accent: { backgroundColor: t.primaryColor, opacity: '1' },
      thick: { backgroundColor: t.textColor, borderRadius: '999px', opacity: '1' },
    },
  }

  return map[type]?.[presetId] || null
}
