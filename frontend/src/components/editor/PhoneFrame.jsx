// One phone mockup for the whole editor. Edit and View both render THIS, at the
// same design-pixel geometry, so the two never disagree about how big the device
// is or how much screen the page actually gets.
//
// Everything below is expressed in design pixels (never in screen pixels): the
// caller wraps the frame in the same `scale(...)` transform it applies to the
// page, so bezel, buttons and content shrink together. Measuring the bezel in
// unscaled pixels — which the preview used to do — is exactly what made the two
// canvases look like different phones.

import { PHONE_BEZEL, PHONE_FRAME_W } from './phoneFrameMetrics.js'

const BUTTON = '#0d111c'

export default function PhoneFrame({ screenWidth, screenHeight, children }) {
  return (
    <div
      data-builder-phone-frame=""
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width: screenWidth + PHONE_FRAME_W,
        paddingTop: PHONE_BEZEL.top,
        paddingRight: PHONE_BEZEL.side,
        paddingBottom: PHONE_BEZEL.bottom,
        paddingLeft: PHONE_BEZEL.side,
        borderRadius: 54,
        background: 'linear-gradient(155deg, #39415a 0%, #10141f 38%, #0a0e17 62%, #2b3245 100%)',
        boxShadow:
          'inset 0 0 0 1px rgba(148,163,184,0.35), inset 0 0 0 3px rgba(8,11,18,0.9), 0 26px 60px rgba(15,23,42,0.38)',
      }}
    >
      {/* Side buttons, drawn just inside the silhouette so a workspace that
          clips horizontally can never shave them off. */}
      <span style={btn(96, 26)} />
      <span style={btn(140, 44)} />
      <span style={btn(196, 44)} />
      <span style={{ ...btn(150, 66), left: undefined, right: 0, borderRadius: '3px 0 0 3px' }} />

      {/* Earpiece slit + camera lens in the top bezel. Deliberately NOT a notch
          punched into the screen: the page keeps every pixel it was designed
          with, and nothing of the user's layout is ever covered. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 9,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ width: 54, height: 6, borderRadius: 3, background: '#1c2231' }} />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#161b28',
            boxShadow: 'inset 0 0 0 1px rgba(129,150,201,0.45)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          width: screenWidth,
          minHeight: screenHeight,
          overflow: 'hidden',
          borderRadius: 24,
          background: '#fff',
        }}
      >
        {children}
      </div>

      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 7,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 112,
          height: 5,
          borderRadius: 3,
          background: 'rgba(148,163,184,0.45)',
        }}
      />
    </div>
  )
}

function btn(top, height) {
  return {
    position: 'absolute',
    left: 0,
    top,
    width: 3,
    height,
    borderRadius: '0 3px 3px 0',
    background: BUTTON,
  }
}
