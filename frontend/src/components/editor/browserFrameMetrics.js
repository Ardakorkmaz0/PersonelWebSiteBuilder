export const BROWSER_FRAME_SIDE = 9
export const BROWSER_FRAME_TOP = 78
export const BROWSER_FRAME_BOTTOM = 9

export function browserFrameW() {
  return BROWSER_FRAME_SIDE * 2
}

export function browserFrameH() {
  return BROWSER_FRAME_TOP + BROWSER_FRAME_BOTTOM
}
