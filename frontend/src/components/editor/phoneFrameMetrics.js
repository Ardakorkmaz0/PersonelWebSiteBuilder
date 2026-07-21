// Device-body geometry for the editor's phone mockup, in DESIGN pixels.
// Shared so the Edit canvas and the View preview reserve the same room for the
// bezel and therefore fit-scale to the same size. See PhoneFrame.jsx.

// Bezel thickness around the screen. Top is deeper to hold the earpiece.
export const PHONE_BEZEL = { side: 12, top: 26, bottom: 20 }
// How much bigger the device body is than the screen it holds.
export const PHONE_FRAME_W = PHONE_BEZEL.side * 2
export const PHONE_FRAME_H = PHONE_BEZEL.top + PHONE_BEZEL.bottom
