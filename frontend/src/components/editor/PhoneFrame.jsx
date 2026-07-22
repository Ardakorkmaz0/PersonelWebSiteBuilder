// One phone mockup for the whole editor. Edit and View both render THIS, at the
// same design-pixel geometry, so the two never disagree about how big the device
// is or how much screen the page actually gets.
//
// Everything below is expressed in design pixels (never in screen pixels): the
// caller wraps the frame in the same `scale(...)` transform it applies to the
// page, so bezel, buttons and content shrink together. Measuring the bezel in
// unscaled pixels — which the preview used to do — is exactly what made the two
// canvases look like different phones.
//
// The body shape comes from phoneFrameMetrics.phoneModel(width): pick iPhone Pro
// Max and you get an iPhone, pick a Galaxy and you get a Galaxy.

import { phoneModel } from './phoneFrameMetrics.js'

const BUTTON = '#0d111c'

// Side buttons sit just INSIDE the silhouette so a workspace that clips
// horizontally can never shave them off.
function button(edge, top, height) {
  return {
    position: 'absolute',
    [edge]: 0,
    top,
    width: 3,
    height,
    borderRadius: edge === 'left' ? '0 3px 3px 0' : '3px 0 0 3px',
    background: BUTTON,
  }
}

function Buttons({ kind }) {
  if (kind === 'galaxy') {
    // Samsung puts the whole cluster on the right edge.
    return (
      <>
        <span style={button('right', 132, 58)} />
        <span style={button('right', 206, 40)} />
      </>
    )
  }
  return (
    <>
      <span style={button('left', 96, 26)} />
      <span style={button('left', 140, 44)} />
      <span style={button('left', 196, 44)} />
      <span style={button('right', 150, 66)} />
    </>
  )
}

function Camera({ model }) {
  const centered = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  }
  if (model.camera === 'island') {
    return (
      <div
        aria-hidden="true"
        style={{
          ...centered,
          top: (model.bezel.top - 24) / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          width: 92,
          height: 24,
          paddingRight: 9,
          borderRadius: 12,
          background: '#05070c',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#0f1626',
            boxShadow: 'inset 0 0 0 1px rgba(129,150,201,0.5)',
          }}
        />
      </div>
    )
  }
  if (model.camera === 'punch') {
    return (
      <span
        aria-hidden="true"
        style={{
          ...centered,
          top: (model.bezel.top - 11) / 2,
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: '#05070c',
          boxShadow: 'inset 0 0 0 1px rgba(129,150,201,0.45)',
        }}
      />
    )
  }
  // Classic earpiece slit with the lens beside it.
  return (
    <div
      aria-hidden="true"
      style={{
        ...centered,
        top: (model.bezel.top - 8) / 2,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
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
  )
}

export default function PhoneFrame({ screenWidth, screenHeight, children }) {
  const model = phoneModel(screenWidth)
  const { bezel } = model
  return (
    <div
      data-builder-phone-frame={model.id}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width: screenWidth + bezel.side * 2,
        paddingTop: bezel.top,
        paddingRight: bezel.side,
        paddingBottom: bezel.bottom,
        paddingLeft: bezel.side,
        borderRadius: model.radius,
        background: 'linear-gradient(155deg, #39415a 0%, #10141f 38%, #0a0e17 62%, #2b3245 100%)',
        boxShadow:
          'inset 0 0 0 1px rgba(148,163,184,0.35), inset 0 0 0 3px rgba(8,11,18,0.9), 0 26px 60px rgba(15,23,42,0.38)',
      }}
    >
      <Buttons kind={model.buttons} />
      <Camera model={model} />

      <div
        style={{
          position: 'relative',
          width: screenWidth,
          minHeight: screenHeight,
          overflow: 'hidden',
          borderRadius: model.screenRadius,
          background: '#fff',
        }}
      >
        {children}
      </div>

      {model.home && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: (bezel.bottom - 42) / 2,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: '#11151f',
            boxShadow: 'inset 0 0 0 1.5px rgba(148,163,184,0.4)',
          }}
        />
      )}
      {model.indicator && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: Math.max(4, (bezel.bottom - 5) / 2),
            left: '50%',
            transform: 'translateX(-50%)',
            width: 112,
            height: 5,
            borderRadius: 3,
            background: 'rgba(148,163,184,0.45)',
          }}
        />
      )}
    </div>
  )
}
