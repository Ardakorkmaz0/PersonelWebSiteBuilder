// Device bodies for the editor's phone mockup, in DESIGN pixels. Shared so the
// Edit canvas and the View preview reserve the same room for the bezel and
// therefore fit-scale to the same size. See PhoneFrame.jsx for the drawing.
//
// The mockup follows the device the user picked in the size dropdown: an iPhone
// preset gets an iPhone body, a Galaxy gets a punch-hole camera and squarer
// corners, the Ultra is boxier still. What identifies a phone at a glance is
// corner roundness, bezel thickness, camera cutout and button placement — so
// those are what vary.
//
// The camera always sits IN the bezel, never notched into the screen: the page
// keeps every pixel it was designed with.

export const PHONE_MODELS = {
  // Neutral artboard for custom/default 390px work: it deliberately carries no
  // vendor identity, while still looking like a real contemporary phone.
  generic: {
    id: 'generic',
    name: 'Standard mobile',
    bezel: { side: 8, top: 8, bottom: 9 },
    radius: 36,
    screenRadius: 29,
    camera: 'punch',
    buttons: 'galaxy',
    body: 'graphite',
  },
  // iPhone 15 Pro / Pro Max: titanium rail, near-uniform bezel and Dynamic Island.
  'iphone-island': {
    id: 'iphone-island',
    name: 'iPhone 15 Pro',
    bezel: { side: 9, top: 9, bottom: 9 },
    radius: 54,
    screenRadius: 46,
    camera: 'island',
    buttons: 'iphone',
    body: 'titanium',
  },
  // The regular iPhone 14 uses the classic Face ID notch, not Dynamic Island.
  'iphone-notch': {
    id: 'iphone-notch',
    name: 'iPhone 14',
    bezel: { side: 10, top: 10, bottom: 10 },
    radius: 50,
    screenRadius: 41,
    camera: 'notch',
    buttons: 'iphone',
    body: 'midnight',
  },
  // iPhone SE: thick brow and chin, squared body, physical home button.
  'iphone-classic': {
    id: 'iphone-classic',
    name: 'iPhone SE (3rd generation)',
    bezel: { side: 11, top: 52, bottom: 62 },
    radius: 24,
    screenRadius: 2,
    camera: 'earpiece',
    buttons: 'iphone',
    home: true,
    body: 'aluminium',
  },
  // Galaxy S: thin even bezel, centred punch-hole, moderately round corners,
  // and every button on the right edge.
  'galaxy-s24': {
    id: 'galaxy-s24',
    name: 'Galaxy S24',
    bezel: { side: 7, top: 7, bottom: 8 },
    radius: 38,
    screenRadius: 31,
    camera: 'punch',
    buttons: 'galaxy',
    body: 'graphite',
  },
  // Galaxy Ultra: the boxy one — corners barely rounded.
  'galaxy-s24-ultra': {
    id: 'galaxy-s24-ultra',
    name: 'Galaxy S24 Ultra',
    bezel: { side: 8, top: 8, bottom: 9 },
    radius: 14,
    screenRadius: 7,
    camera: 'punch',
    buttons: 'galaxy',
    body: 'titanium-black',
  },
  // Pixel 7 has a rounder screen and its power key sits above the volume rocker.
  'pixel-7': {
    id: 'pixel-7',
    name: 'Pixel 7',
    bezel: { side: 9, top: 10, bottom: 11 },
    radius: 34,
    screenRadius: 26,
    camera: 'punch',
    buttons: 'pixel',
    body: 'obsidian',
  },
}

// Every mobile preset has a distinct width, so the artboard width alone picks
// the body. Anything custom falls back to the modern-iPhone shape.
const MODEL_BY_WIDTH = {
  360: 'galaxy-s24',
  375: 'iphone-classic',
  384: 'galaxy-s24-ultra',
  390: 'iphone-notch',
  393: 'iphone-island',
  412: 'pixel-7',
  430: 'iphone-island',
}

// The screen height that goes with a phone width, for the canvases that have no
// device to ask. Every mobile preset in the toolbar carries its device height as
// the "fold", so that value wins when it is set; this is the fallback for the
// preset that has none (Standard mobile) and for custom widths.
const SCREEN_HEIGHT_BY_WIDTH = {
  360: 780,
  375: 667,
  384: 824,
  390: 844,
  393: 852,
  412: 915,
  430: 932,
}

export function phoneScreenHeight(width) {
  const w = Math.round(Number(width) || 0)
  if (SCREEN_HEIGHT_BY_WIDTH[w]) return SCREEN_HEIGHT_BY_WIDTH[w]
  // Contemporary phones sit around 2.16:1; clamp so an odd custom width still
  // produces a screen someone could hold.
  return Math.min(1400, Math.max(480, Math.round((w || 390) * 2.16)))
}

export function phoneModel(width, fold) {
  if (Math.round(Number(width) || 0) === 390 && Number(fold) === 0) return PHONE_MODELS.generic
  return PHONE_MODELS[MODEL_BY_WIDTH[Math.round(Number(width) || 0)]] || PHONE_MODELS['iphone-island']
}

// How much bigger the device body is than the screen it holds.
export function phoneFrameW(model) {
  return model.bezel.side * 2
}
export function phoneFrameH(model) {
  return model.bezel.top + model.bezel.bottom
}
