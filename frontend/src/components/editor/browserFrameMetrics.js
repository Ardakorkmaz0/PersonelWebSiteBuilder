export const BROWSER_FRAME_SIDE = 9
export const BROWSER_FRAME_TOP = 78
export const BROWSER_FRAME_BOTTOM = 9

export function browserFrameW() {
  return BROWSER_FRAME_SIDE * 2
}

export function browserFrameH() {
  return BROWSER_FRAME_TOP + BROWSER_FRAME_BOTTOM
}

// ---------------------------------------------------------------------------
// The phone browser, in design pixels.
//
// A page on a phone never gets the whole screen: the status bar, the address
// bar and the toolbar sit on top of it. Reserving that room is the point of the
// mobile browser frame — a hero sized to the device height is TALLER than what
// the visitor actually sees, and only a frame that eats the same pixels the
// real browser eats can show it.
//
// The two skins differ where it matters for layout: iOS keeps a toolbar at the
// bottom, Android puts everything in the top bar and leaves only the system
// gesture strip below. A bottom-pinned button lands in a different place on the
// two, so the frame follows the device the user picked.
export const MOBILE_BROWSER_STATUS = 36
export const MOBILE_BROWSER_BAR = 46
export const MOBILE_BROWSER_TOOLBAR = 48
export const MOBILE_BROWSER_GESTURE = 22

// Galaxy/Pixel bodies (and the neutral "Standard mobile" artboard) get Chrome's
// Android chrome; every iPhone body gets Safari's.
export function mobileBrowserSkin(model) {
  const buttons = model?.buttons
  return buttons === 'galaxy' || buttons === 'pixel' ? 'android' : 'ios'
}

export function mobileBrowserTopH() {
  return MOBILE_BROWSER_STATUS + MOBILE_BROWSER_BAR
}

export function mobileBrowserBottomH(model) {
  return mobileBrowserSkin(model) === 'ios' ? MOBILE_BROWSER_TOOLBAR : MOBILE_BROWSER_GESTURE
}

export function mobileBrowserChromeH(model) {
  return mobileBrowserTopH() + mobileBrowserBottomH(model)
}
