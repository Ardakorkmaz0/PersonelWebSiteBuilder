import { useEffect, useRef, useState } from 'react'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { useLanguage } from '../../i18n/useLanguage.js'
import { Renderer } from '../renderer/Renderer.jsx'
import { MOTION_CSS } from '../../utils/motion.js'

// Entrance catalog (value → label → hint glyph). Mirrors the Properties-panel
// options and the motion module's REVEAL_TYPES, minus 'none'. `slide-right`
// moves IN from the left, so it reads "from left" to the user. The glyph hints
// the direction without a busy looping demo on every row.
const ENTRANCES = [
  ['fade', 'Fade in', '◍'],
  ['fade-up', 'Fade up', '↑'],
  ['fade-down', 'Fade down', '↓'],
  ['slide-right', 'Slide from left', '→'],
  ['slide-left', 'Slide from right', '←'],
  ['zoom', 'Zoom in', '⤢'],
]
const HOVERS = [
  ['lift', 'Lift'],
  ['grow', 'Grow'],
  ['glow', 'Glow'],
]

const LAST_ANIM_KEY = 'pwb_last_anim'

// Looping preview animations, as SELF-RUNNING CSS keyframes. An earlier version
// toggled the export's `.pwb-in` class on a React timer + CSS transition; that
// depended on precise state/transition timing and, in practice, never visibly
// played — the preview looked dead. A plain infinite keyframe animation needs no
// JS and plays in every browser. The start transforms mirror the real motion
// (motion.js), so the preview reads true: enter, hold, reset, repeat.
const DEMO_CSS = `
.pwb-demo{animation-duration:2.6s;animation-iteration-count:infinite;animation-timing-function:cubic-bezier(.16,.84,.44,1);transform-origin:center}
@keyframes pwb-demo-fade{0%,10%{opacity:0}40%,90%{opacity:1}100%{opacity:0}}
.pwb-demo-fade{animation-name:pwb-demo-fade}
@keyframes pwb-demo-fade-up{0%,10%{opacity:0;transform:translateY(26px)}40%,90%{opacity:1;transform:none}100%{opacity:0;transform:translateY(26px)}}
.pwb-demo-fade-up{animation-name:pwb-demo-fade-up}
@keyframes pwb-demo-fade-down{0%,10%{opacity:0;transform:translateY(-26px)}40%,90%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-26px)}}
.pwb-demo-fade-down{animation-name:pwb-demo-fade-down}
@keyframes pwb-demo-slide-right{0%,10%{opacity:0;transform:translateX(-30px)}40%,90%{opacity:1;transform:none}100%{opacity:0;transform:translateX(-30px)}}
.pwb-demo-slide-right{animation-name:pwb-demo-slide-right}
@keyframes pwb-demo-slide-left{0%,10%{opacity:0;transform:translateX(30px)}40%,90%{opacity:1;transform:none}100%{opacity:0;transform:translateX(30px)}}
.pwb-demo-slide-left{animation-name:pwb-demo-slide-left}
@keyframes pwb-demo-zoom{0%,10%{opacity:0;transform:scale(.9)}40%,90%{opacity:1;transform:none}100%{opacity:0;transform:scale(.9)}}
.pwb-demo-zoom{animation-name:pwb-demo-zoom}
`

// Loops `reveal` on its children. `key={reveal}` remounts the inner node when the
// pick changes, so the animation restarts cleanly from the first frame.
function MotionLoop({ reveal, children, className, style }) {
  return (
    <div className={className} style={style}>
      <div key={reveal} className={`pwb-demo pwb-demo-${reveal}`}>
        {children}
      </div>
    </div>
  )
}

// A tiny stand-in "site" — a heading bar and two cards — used as the neutral
// example so the user sees the motion even before selecting anything of theirs.
function SampleSite() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
      <div style={{ height: 12, borderRadius: 3, background: '#4f46e5', width: '60%' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, height: 34, borderRadius: 6, background: '#e0e7ff' }} />
        <div style={{ flex: 1, height: 34, borderRadius: 6, background: '#e0e7ff' }} />
      </div>
      <div style={{ height: 8, borderRadius: 3, background: '#cbd5e1', width: '80%' }} />
    </div>
  )
}

// A scaled, static, non-interactive snapshot of the current page, so "your site"
// is genuinely the user's content. Scaled to fit the preview box; a heavy page
// still reads as a thumbnail. Empty page → a gentle placeholder.
function PageThumbnail({ boxW = 208, boxH = 132 }) {
  const { t } = useLanguage()
  const page = useEditorStore(selectCurrentPage)
  const components = (page?.components || []).filter((c) => !c.hidden)
  const pageW = page?.canvasWidth || 1000
  if (!components.length) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-[#9ca3af]"
        style={{ width: boxW, height: boxH }}
      >
        {t('This page is empty')}
      </div>
    )
  }
  const scale = boxW / pageW
  return (
    <div style={{ width: boxW, height: boxH, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ width: pageW, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <Renderer
          components={components}
          background={page?.background || '#ffffff'}
          viewport="pc"
          width={pageW}
          designWidth={pageW}
          flowMode={!!page?.flowMode}
        />
      </div>
    </div>
  )
}

function PreviewTile({ label, reveal, children }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</div>
      <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white" style={{ height: 140 }}>
        <MotionLoop reveal={reveal} durationMs={650} style={{ height: '100%' }}>
          {children}
        </MotionLoop>
      </div>
    </div>
  )
}

// The Animation tab: pick a scroll entrance or a hover effect, preview it on both
// a sample site and this page, then apply it to the selected component. The last
// pick is remembered so reopening the editor lands on it.
export default function AnimationPanel() {
  const { t } = useLanguage()
  const selectedId = useEditorStore((s) => s.selectedId)
  const updateProps = useEditorStore((s) => s.updateProps)
  const selected = useEditorStore((s) => {
    const id = s.selectedId
    if (!id) return null
    return (selectCurrentPage(s)?.components || []).find((c) => c.id === id) || null
  })
  const pinned = selected?.props?.scrollBehavior === 'fixed' || selected?.props?.scrollBehavior === 'sticky'

  // Start on the last-used entrance (returning users see it immediately);
  // a first-timer starts with nothing picked, so the preview + Use appear only
  // after they click one — the "click → preview → use" flow.
  const [picked, setPicked] = useState(() => {
    try {
      return localStorage.getItem(LAST_ANIM_KEY) || null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (!picked) return
    try {
      localStorage.setItem(LAST_ANIM_KEY, picked)
    } catch {
      /* private mode — remembering is a nicety, not required */
    }
  }, [picked])

  const applyEntrance = () => {
    if (!selectedId || pinned) return
    updateProps(selectedId, { animIn: picked, animSpeed: selected?.props?.animSpeed || 'normal' })
  }
  const applyHover = (hover) => {
    if (!selectedId || pinned) return
    updateProps(selectedId, { animHover: hover })
  }

  const styleRef = useRef(null)
  return (
    <div className="space-y-4">
      {/* Preview styles: the looping demo keyframes plus the export's MOTION_CSS
          (its .pwb-hover-* rules drive the hover swatches). Both only touch
          pwb-* selectors, which exist solely inside these previews in the app. */}
      <style ref={styleRef}>{DEMO_CSS}{MOTION_CSS}</style>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
          {t('Entrance (on scroll)')}
        </h2>
        <div className="grid grid-cols-2 gap-1.5">
          {ENTRANCES.map(([value, label, glyph]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPicked(value)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] font-medium transition ${
                picked === value
                  ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]'
                  : 'border-[#e5e7eb] text-[#374151] hover:border-[#4f46e5]'
              }`}
            >
              <span aria-hidden="true" className="text-sm leading-none opacity-70">{glyph}</span>
              <span className="truncate">{t(label)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Only after an entrance is picked: its preview — on a sample AND on this
          page — then the Use button that commits it to the selected element. */}
      {picked ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#4f46e5]">
            {t('Preview')}: {t(ENTRANCES.find(([v]) => v === picked)?.[1] || '')}
          </div>
          <div className="flex gap-2">
            <PreviewTile label={t('Example')} reveal={picked}>
              <div className="flex h-full items-center px-2">
                <SampleSite />
              </div>
            </PreviewTile>
            <PreviewTile label={t('This page')} reveal={picked}>
              <div className="flex h-full items-center justify-center">
                <PageThumbnail />
              </div>
            </PreviewTile>
          </div>
          <button
            type="button"
            onClick={applyEntrance}
            disabled={!selectedId || pinned}
            className="mt-2.5 w-full rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#2563eb] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-[#4338ca] hover:to-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected?.props?.animIn === picked ? t('In use') : t('Use this animation')}
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-[#9ca3af]">
            {pinned
              ? t('A pinned bar cannot animate.')
              : !selectedId
                ? t('Select an element on the canvas to apply it.')
                : t('Applies to the selected element. Switch to View to see it play.')}
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#e5e7eb] px-3 py-4 text-center text-[11px] text-[#9ca3af]">
          {t('Pick an animation to preview it.')}
        </p>
      )}

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
          {t('Hover effect')}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {HOVERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyHover(selected?.props?.animHover === value ? 'none' : value)}
              disabled={!selectedId || pinned}
              title={t('Hover to try; click to apply')}
              className={`rounded-lg border p-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selected?.props?.animHover === value
                  ? 'border-[#4f46e5] bg-[#eef2ff]'
                  : 'border-[#e5e7eb] hover:border-[#4f46e5]'
              }`}
            >
              <div className="grid place-items-center rounded bg-[#f8fafc]" style={{ height: 34 }}>
                <div
                  className={`pwb-hover pwb-hover-${value}`}
                  style={{ width: 26, height: 18, borderRadius: 5, background: '#4f46e5' }}
                />
              </div>
              <div className="mt-1 truncate text-center text-[11px] font-medium text-[#374151]">{t(label)}</div>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#9ca3af]">
          {t('Hover a swatch to preview; click to apply or remove.')}
        </p>
      </div>
    </div>
  )
}
