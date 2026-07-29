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

const BUTTON = '#080a0f'

const BODY_FINISH = {
  titanium: 'linear-gradient(145deg, #8b8c91 0%, #34353a 18%, #111217 48%, #55565b 78%, #191a1f 100%)',
  midnight: 'linear-gradient(145deg, #354052 0%, #121824 28%, #070a10 62%, #263043 100%)',
  aluminium: 'linear-gradient(145deg, #6b7079 0%, #20242c 28%, #0b0e14 68%, #454b55 100%)',
  graphite: 'linear-gradient(145deg, #5d626c 0%, #1d2129 24%, #080a0f 64%, #3c424d 100%)',
  'titanium-black': 'linear-gradient(145deg, #625f59 0%, #272622 22%, #090a0d 64%, #45433d 100%)',
  obsidian: 'linear-gradient(145deg, #4c5057 0%, #202329 24%, #090b0f 64%, #353940 100%)',
}

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
    // Galaxy S24: volume rocker above the power key, both on the right rail.
    return (
      <>
        <span style={button('right', 96, 54)} />
        <span style={button('right', 166, 58)} />
      </>
    )
  }
  if (kind === 'pixel') {
    return (
      <>
        <span style={button('right', 92, 48)} />
        <span style={button('right', 154, 72)} />
      </>
    )
  }
  return (
    <>
      <span style={button('left', 88, 24)} />
      <span style={button('left', 130, 48)} />
      <span style={button('left', 190, 48)} />
      <span style={button('right', 148, 72)} />
    </>
  )
}

function Camera({ model, inScreen = false }) {
  const centered = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
    pointerEvents: 'none',
  }
  if (model.camera === 'island') {
    return (
      <div
        aria-hidden="true"
        style={{
          ...centered,
          top: inScreen ? 10 : (model.bezel.top - 28) / 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          width: 104,
          height: 28,
          paddingRight: 10,
          borderRadius: 16,
          background: '#000105',
          boxSizing: 'border-box',
          boxShadow: '0 1px 2px rgba(0,0,0,.9)',
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
  if (model.camera === 'notch') {
    return (
      <div
        aria-hidden="true"
        style={{
          ...centered,
          top: inScreen ? 0 : (model.bezel.top - 28) / 2,
          width: 132,
          height: 29,
          borderRadius: '0 0 18px 18px',
          background: '#000105',
          boxShadow: '0 1px 2px rgba(0,0,0,.85)',
        }}
      >
        <span style={{ position: 'absolute', right: 23, top: 8, width: 9, height: 9, borderRadius: '50%', background: '#101827', boxShadow: 'inset 0 0 0 1px rgba(104,130,186,.5)' }} />
        <span style={{ position: 'absolute', left: '50%', top: 9, width: 38, height: 5, transform: 'translateX(-50%)', borderRadius: 3, background: '#171a20' }} />
      </div>
    )
  }
  if (model.camera === 'punch') {
    return (
      <span
        aria-hidden="true"
        style={{
          ...centered,
          top: inScreen ? 10 : (model.bezel.top - 12) / 2,
          width: 12,
          height: 12,
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

export default function PhoneFrame({ screenWidth, screenHeight, model: suppliedModel, children }) {
  const model = suppliedModel || phoneModel(screenWidth)
  const { bezel } = model
  return (
    <div
      data-builder-phone-frame={model.id}
      aria-label={model.name}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width: screenWidth + bezel.side * 2,
        paddingTop: bezel.top,
        paddingRight: bezel.side,
        paddingBottom: bezel.bottom,
        paddingLeft: bezel.side,
        borderRadius: model.radius,
        background: BODY_FINISH[model.body] || BODY_FINISH.titanium,
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.32), inset 0 0 0 3px rgba(0,0,0,0.88), 0 28px 66px rgba(0,0,0,0.42)',
      }}
    >
      <Buttons kind={model.buttons} />
      {model.camera === 'earpiece' && <Camera model={model} />}

      <div
        style={{
          position: 'relative',
          width: screenWidth,
          // A DEFINITE height, not just a minimum. A phone screen is a fixed
          // viewport, and children fill it with `height: 100%` — which only
          // resolves against a definite parent height. With min-height alone
          // the percentage was indefinite, so the HTML preview's iframe fell
          // back to a replaced element's default 150px: the page showed its
          // first ~150px and the rest of the screen was this div's white
          // background. Both View and Edit, every device, every document.
          height: screenHeight,
          minHeight: screenHeight,
          overflow: 'hidden',
          borderRadius: model.screenRadius,
          background: '#fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,.95), inset 0 0 0 1px rgba(255,255,255,.08)',
        }}
      >
        {children}
        {model.camera !== 'earpiece' && <Camera model={model} inScreen />}
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
    </div>
  )
}
