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
  // Modern iPhone: near-uniform bezel, very round corners, Dynamic Island.
  'iphone-island': {
    id: 'iphone-island',
    bezel: { side: 12, top: 30, bottom: 22 },
    radius: 56,
    screenRadius: 40,
    camera: 'island',
    buttons: 'iphone',
    indicator: true,
  },
  // iPhone SE: thick brow and chin, squared body, physical home button.
  'iphone-classic': {
    id: 'iphone-classic',
    bezel: { side: 11, top: 52, bottom: 62 },
    radius: 24,
    screenRadius: 2,
    camera: 'earpiece',
    buttons: 'iphone',
    home: true,
  },
  // Galaxy S: thin even bezel, centred punch-hole, moderately round corners,
  // and every button on the right edge.
  galaxy: {
    id: 'galaxy',
    bezel: { side: 10, top: 22, bottom: 18 },
    radius: 40,
    screenRadius: 30,
    camera: 'punch',
    buttons: 'galaxy',
    indicator: true,
  },
  // Galaxy Ultra: the boxy one — corners barely rounded.
  ultra: {
    id: 'ultra',
    bezel: { side: 9, top: 20, bottom: 16 },
    radius: 16,
    screenRadius: 8,
    camera: 'punch',
    buttons: 'galaxy',
    indicator: true,
  },
}

// Every mobile preset has a distinct width, so the artboard width alone picks
// the body. Anything custom falls back to the modern-iPhone shape.
const MODEL_BY_WIDTH = {
  360: 'galaxy',
  375: 'iphone-classic',
  384: 'ultra',
  390: 'iphone-island',
  393: 'iphone-island',
  412: 'galaxy',
  430: 'iphone-island',
}

export function phoneModel(width) {
  return PHONE_MODELS[MODEL_BY_WIDTH[Math.round(Number(width) || 0)]] || PHONE_MODELS['iphone-island']
}

// How much bigger the device body is than the screen it holds.
export function phoneFrameW(model) {
  return model.bezel.side * 2
}
export function phoneFrameH(model) {
  return model.bezel.top + model.bezel.bottom
}
