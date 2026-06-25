import { useEffect, useState } from 'react'
import { useEditorStore, selectCurrentPage } from '../../store/editorStore.js'
import { registry } from '../registry.jsx'
import { LINKABLE_TYPES } from '../renderer/constants.js'
import { DEFAULT_THEME, FONT_OPTIONS, THEME_PRESETS, normalizeTheme } from '../../utils/theme.js'
import { presetOptions, presetsForType } from '../../utils/componentPresets.js'
import {
  appendSnippet,
  cssSnippets,
  groupSnippets,
  jsSnippets,
} from '../../utils/snippets.js'
import {
  AI_PROVIDERS,
  fetchLocalStatus,
  getApiKey,
  getEndpoint,
  getModel,
  getModelsFor,
  getProvider,
  pickBestLocalModel,
  setApiKey,
  setEndpoint,
  setModel,
  setProvider,
} from '../../utils/aiAssistant.js'
import {
  LabeledText,
  LabeledTextarea,
  LabeledImage,
  LabeledColor,
  LabeledSelect,
  LabeledPx,
  LabeledNumber,
  LabeledRange,
  LabeledCheckbox,
  LinkTargetControl,
  LinksEditor,
  TabsEditorControl,
} from './controls.jsx'
import { PaletteIcon } from '../icons.jsx'

const JS_SNIPPET_GROUPS = groupSnippets(jsSnippets)
const CSS_SNIPPET_GROUPS = groupSnippets(cssSnippets)

// Compact connection-status pill for the local provider: green when Ollama
// is reachable and reports installed models, amber while we ping, red when
// it can't be reached. Doubles as a refresh button.
function LocalStatusRow({ status, refreshing, onRefresh }) {
  let tone = 'amber'
  let label = 'Checking…'
  let detail = ''
  if (!refreshing && status) {
    if (status.ok) {
      tone = 'emerald'
      const count = (status.models || []).length
      label = count
        ? `Ready · ${count} model${count === 1 ? '' : 's'} found`
        : 'Reachable but no models installed'
      detail = count
        ? `Runtime: ${status.runtime || 'ollama'}`
        : 'Pull one with `ollama pull qwen2.5`.'
    } else {
      tone = 'red'
      label = 'Cannot reach the local runtime'
      detail = status.reason
        ? `Make sure Ollama is running. (${status.reason})`
        : 'Make sure Ollama (or LM Studio) is running.'
    }
  }
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }[tone]
  return (
    <div className={`flex items-start justify-between gap-2 rounded-lg border p-2 text-[11px] ${toneClasses}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        {detail && <p className="mt-0.5 leading-relaxed opacity-80">{detail}</p>}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded-lg border border-current bg-white px-2 py-0.5 text-[10px] font-semibold opacity-90 hover:opacity-100 disabled:cursor-wait"
      >
        {refreshing ? '…' : 'Refresh'}
      </button>
    </div>
  )
}

// Read/write the saved Gemini API key. The key is stored in localStorage and
// sent directly from the browser to Google's API — the Django backend never
// sees it. Saved per browser, not per site.
function AiAssistantSection() {
  const [provider, setProviderState] = useState(() => getProvider())
  const [value, setValue] = useState(() => getApiKey(provider))
  const [reveal, setReveal] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [model, setModelState] = useState(() => getModel(provider))
  const [endpoint, setEndpointState] = useState(() => getEndpoint(provider))
  const [localStatus, setLocalStatus] = useState(null) // { ok, runtime, models, reason }
  const [localRefreshing, setLocalRefreshing] = useState(false)
  const knownModels = getModelsFor(provider)
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const needsKey = providerInfo?.needsKey !== false
  // For the local provider we merge the auto-discovered model list (whatever
  // the user has actually pulled with `ollama pull`) with our suggestions.
  // For other providers `models` stays the curated dropdown.
  const discoveredModels = (provider === 'local' && localStatus?.ok && Array.isArray(localStatus.models))
    ? localStatus.models.map((id) => ({ id, label: id, note: '' }))
    : []
  const models = provider === 'local' && discoveredModels.length
    ? discoveredModels
    : knownModels

  // Ping the backend proxy each time the user opens the panel on the local
  // provider — that's how we know which models they have pulled AND whether
  // Ollama is actually running. All state updates happen in the response
  // callback (never synchronously in the effect body); "no status yet" is
  // treated as refreshing by the row below.
  useEffect(() => {
    if (provider !== 'local') return undefined
    let cancelled = false
    fetchLocalStatus(endpoint || undefined).then((s) => {
      if (cancelled) return
      setLocalStatus(s)
      setLocalRefreshing(false)
      // Auto-pick: if the saved model isn't installed, or even if it is but
      // is a weak-tool-calling model (e.g. gemma) when a stronger one is
      // available (llama3.1 / qwen2.5 / mistral-nemo), switch automatically.
      if (s?.ok && Array.isArray(s.models) && s.models.length) {
        const best = pickBestLocalModel(s.models, model)
        if (best && best !== model) setModelState(best)
      }
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, endpoint])

  function refreshLocalStatus() {
    setLocalRefreshing(true)
    fetchLocalStatus(endpoint || undefined).then((s) => {
      setLocalStatus(s)
      setLocalRefreshing(false)
      if (s?.ok && Array.isArray(s.models) && s.models.length) {
        const best = pickBestLocalModel(s.models, model)
        if (best && best !== model) setModelState(best)
      }
    })
  }
  // When the user picks a different provider, persist it and load the saved
  // key + model + endpoint for that provider so they don't bleed across each
  // other. Lives in the select's event handler (not an effect) so no state
  // cascades through extra renders.
  function pickProvider(next) {
    setProviderState(next)
    setProvider(next)
    setValue(getApiKey(next))
    setModelState(getModel(next))
    setEndpointState(getEndpoint(next))
    // The local-status row refetches via the effect above; clearing here
    // makes it show "checking…" instead of a stale snapshot.
    setLocalStatus(null)
  }
  // Persist the key as the user types; flash "Saved ✓" briefly.
  function changeApiKey(next) {
    setValue(next)
    setApiKey(next || '', provider)
    setSavedFlash(!!next)
  }
  useEffect(() => {
    if (!savedFlash) return undefined
    const t = setTimeout(() => setSavedFlash(false), 1200)
    return () => clearTimeout(t)
  }, [savedFlash])
  useEffect(() => {
    setModel(model, provider)
  }, [model, provider])
  useEffect(() => {
    if (providerInfo?.configurableEndpoint) setEndpoint(endpoint, provider)
  }, [endpoint, provider, providerInfo?.configurableEndpoint])
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">AI Assistant</h3>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[#6b7280]">Provider</span>
        <select
          value={provider}
          onChange={(e) => pickProvider(e.target.value)}
          className="w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-1 text-sm text-[#111827] focus:border-[#4f46e5] focus:outline-none"
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-[#6b7280]">{providerInfo?.keyHint}</span>
      </label>
      {needsKey ? (
        <>
          <p className="text-xs leading-relaxed text-[#6b7280]">
            Paste a free API key from{' '}
            <a
              href={providerInfo?.keyUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4f46e5] underline"
            >
              {(providerInfo?.keyUrl || '').replace(/^https?:\/\//, '').replace(/\/.*/, '')}
            </a>
            . The key stays in your browser and is sent directly to the provider — never to our server.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#6b7280]">
              {providerInfo?.label || 'API'} key
            </span>
            <div className="flex gap-2">
              <input
                type={reveal ? 'text' : 'password'}
                value={value}
                onChange={(e) => changeApiKey(e.target.value.trim())}
                placeholder="AIza... / gsk_... / sk-..."
                className="w-full rounded-lg border border-[#d1d5db] px-2 py-1 font-mono text-xs text-[#111827] focus:border-[#4f46e5] focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="rounded-lg border border-[#d1d5db] px-2 text-xs text-[#374151] hover:bg-[#f3f4f6]"
              >
                {reveal ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        </>
      ) : (
        <div className="space-y-2">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] leading-relaxed text-emerald-900">
            No API key needed — this provider runs on your computer. All you
            need is Ollama installed and at least one model pulled (e.g.
            <code className="mx-1 rounded bg-white px-1 py-0.5 text-[10px]">ollama pull qwen2.5</code>
            ). Requests are routed through this app&apos;s backend, so you
            don&apos;t have to deal with CORS or OLLAMA_ORIGINS.
          </p>
          <LocalStatusRow
            status={localStatus}
            refreshing={localRefreshing || !localStatus}
            onRefresh={refreshLocalStatus}
          />
        </div>
      )}
      {providerInfo?.configurableEndpoint && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#6b7280]">Base URL (advanced)</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpointState(e.target.value)}
            placeholder="http://localhost:11434/v1"
            className="w-full rounded-lg border border-[#d1d5db] px-2 py-1 font-mono text-xs text-[#111827] focus:border-[#4f46e5] focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block text-[11px] text-[#6b7280]">
            Ollama: http://localhost:11434/v1 — LM Studio: http://localhost:1234/v1.
            Leave as-is unless you changed Ollama&apos;s default port.
          </span>
        </label>
      )}
      <p className="text-xs text-[#6b7280]">
        {value
          ? savedFlash
            ? 'Saved ✓'
            : 'Key saved. The AI button in the toolbar opens the chat panel.'
          : 'No key set — the AI button in the toolbar is in setup mode.'}
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[#6b7280]">Model</span>
        {providerInfo?.customModel ? (
          <>
            <input
              type="text"
              list="ai-model-suggestions"
              value={model}
              onChange={(e) => setModelState(e.target.value)}
              placeholder="llama3.1 / qwen2.5 / your-pulled-model"
              className="w-full rounded-lg border border-[#d1d5db] px-2 py-1 font-mono text-xs text-[#111827] focus:border-[#4f46e5] focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id="ai-model-suggestions">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
            <span className="mt-1 block text-[11px] text-[#6b7280]">
              {models.find((m) => m.id === model)?.note ||
                'Type any model you have pulled with Ollama or loaded in LM Studio.'}
            </span>
          </>
        ) : (
          <>
            <select
              value={model}
              onChange={(e) => setModelState(e.target.value)}
              className="w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-1 text-sm text-[#111827] focus:border-[#4f46e5] focus:outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-[#6b7280]">
              {models.find((m) => m.id === model)?.note}
            </span>
          </>
        )}
      </label>
    </section>
  )
}

// Optional snippet picker. Empty selection is the default — writing by hand
// stays the primary workflow; this is just a shortcut.
function SnippetPicker({ groups, list, onPick }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#6b7280]">
        Insert snippet (optional)
      </span>
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value
          if (!id) return
          const snippet = list.find((s) => s.id === id)
          if (snippet) onPick(snippet)
          e.target.value = ''
        }}
        className="w-full rounded-lg border border-[#d1d5db] bg-white px-2 py-1 text-sm text-[#111827] focus:border-[#4f46e5] focus:outline-none"
      >
        <option value="">— pick a snippet to append —</option>
        {groups.map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.items.map((s) => (
              <option key={s.id} value={s.id} title={s.description}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

const STYLE_META = {
  backgroundColor: { label: 'Background', control: 'color' },
  color: { label: 'Text color', control: 'color' },
  fontSize: { label: 'Font size', control: 'px' },
  fontWeight: {
    label: 'Font weight',
    control: 'select',
    options: [['normal', 'Normal'], ['500', 'Medium'], ['600', 'Semibold'], ['bold', 'Bold']],
  },
  fontStyle: {
    label: 'Style',
    control: 'select',
    options: [['normal', 'Normal'], ['italic', 'Italic']],
  },
  fontFamily: {
    label: 'Font',
    control: 'select',
    options: [['inherit', 'Theme font'], ...FONT_OPTIONS],
  },
  textAlign: {
    label: 'Alignment',
    control: 'select',
    options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']],
  },
  textDecoration: {
    label: 'Decoration',
    control: 'select',
    options: [['none', 'None'], ['underline', 'Underline']],
  },
  textTransform: {
    label: 'Text case',
    control: 'select',
    options: [
      ['none', 'Normal'],
      ['uppercase', 'UPPERCASE'],
      ['lowercase', 'lowercase'],
      ['capitalize', 'Capitalize'],
    ],
  },
  backgroundImage: {
    label: 'Gradient',
    control: 'select',
    options: [
      ['none', 'None'],
      ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'Purple'],
      ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'Sky'],
      ['linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 'Mint'],
      ['linear-gradient(135deg, #fa709a 0%, #fee140 100%)', 'Sunset'],
      ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'Blossom'],
      ['linear-gradient(135deg, #30cfd0 0%, #330867 100%)', 'Ocean'],
      ['linear-gradient(180deg, #1d1d1f 0%, #434343 100%)', 'Charcoal'],
    ],
  },
  lineHeight: { label: 'Line height', control: 'text', placeholder: 'e.g. 1.5' },
  letterSpacing: { label: 'Letter spacing', control: 'px' },
  borderRadius: { label: 'Corner radius', control: 'px' },
  borderWidth: { label: 'Border width', control: 'px' },
  borderStyle: {
    label: 'Border style',
    control: 'select',
    options: [['none', 'None'], ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']],
  },
  borderColor: { label: 'Border color', control: 'color' },
  boxShadow: {
    label: 'Shadow',
    control: 'select',
    options: [
      ['none', 'None'],
      ['0 1px 3px rgba(0,0,0,0.15)', 'Small'],
      ['0 4px 12px rgba(0,0,0,0.15)', 'Medium'],
      ['0 10px 25px rgba(0,0,0,0.2)', 'Large'],
    ],
  },
  opacity: { label: 'Opacity', control: 'range' },
  objectFit: {
    label: 'Image fit',
    control: 'select',
    options: [['fill', 'Fill'], ['cover', 'Cover'], ['contain', 'Contain']],
  },
  padding: { label: 'Padding', control: 'text', placeholder: 'e.g. 12px 20px' },
  margin: { label: 'Margin', control: 'text', placeholder: 'e.g. 0 auto' },
  width: { label: 'Width', control: 'text', placeholder: 'e.g. 100%' },
  maxWidth: { label: 'Max width', control: 'text', placeholder: 'e.g. 640px' },
  height: { label: 'Height', control: 'text', placeholder: 'e.g. 48px' },
  minHeight: { label: 'Min height', control: 'text', placeholder: 'e.g. 200px' },
  // Advanced / standard CSS knobs, available on every component.
  transform: { label: 'Transform', control: 'text', placeholder: 'e.g. rotate(-3deg) scale(1.05)' },
  filter: { label: 'Filter', control: 'text', placeholder: 'e.g. blur(2px) brightness(1.1)' },
  backdropFilter: { label: 'Backdrop filter', control: 'text', placeholder: 'e.g. blur(8px)' },
  textShadow: { label: 'Text shadow', control: 'text', placeholder: 'e.g. 0 2px 6px rgba(0,0,0,.3)' },
  aspectRatio: { label: 'Aspect ratio', control: 'text', placeholder: 'e.g. 16 / 9' },
  objectPosition: { label: 'Image position', control: 'text', placeholder: 'e.g. center' },
  backgroundSize: {
    label: 'Background size',
    control: 'select',
    options: [['auto', 'Auto'], ['cover', 'Cover'], ['contain', 'Contain']],
  },
  backgroundPosition: { label: 'Background position', control: 'text', placeholder: 'e.g. center' },
  backgroundRepeat: {
    label: 'Background repeat',
    control: 'select',
    options: [
      ['no-repeat', 'No repeat'],
      ['repeat', 'Repeat'],
      ['repeat-x', 'Repeat X'],
      ['repeat-y', 'Repeat Y'],
    ],
  },
  cursor: {
    label: 'Cursor',
    control: 'select',
    options: [
      ['auto', 'Auto'],
      ['pointer', 'Pointer'],
      ['default', 'Default'],
      ['move', 'Move'],
      ['text', 'Text'],
      ['not-allowed', 'Not allowed'],
    ],
  },
  overflow: {
    label: 'Overflow',
    control: 'select',
    options: [['visible', 'Visible'], ['hidden', 'Hidden'], ['auto', 'Auto'], ['scroll', 'Scroll']],
  },
}

// Universal advanced style controls shown for every component (standard CSS).
const ADVANCED_STYLE_KEYS = [
  'transform', 'filter', 'backdropFilter', 'textShadow', 'aspectRatio',
  'objectPosition', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
  'cursor', 'overflow',
]

const STYLE_GROUPS = [
  {
    title: 'Typography',
    keys: [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textTransform',
      'textDecoration',
    ],
  },
  { title: 'Colors', keys: ['color', 'backgroundColor', 'backgroundImage'] },
  { title: 'Spacing', keys: ['padding', 'margin', 'width', 'maxWidth', 'height', 'minHeight'] },
  { title: 'Border', keys: ['borderRadius', 'borderWidth', 'borderStyle', 'borderColor'] },
  { title: 'Effects', keys: ['boxShadow', 'opacity', 'objectFit'] },
]

// Find a component anywhere in the tree (containers and tabs nest children).
const NESTING_TYPES = new Set(['container', 'tabs'])
function findComponentEntry(components, id, parent = null) {
  for (const c of components || []) {
    if (c.id === id) return { component: c, parent }
    if (NESTING_TYPES.has(c.type) && Array.isArray(c.children)) {
      const found = findComponentEntry(c.children, id, c)
      if (found) return found
    }
  }
  return null
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
      {children}
    </h3>
  )
}

function PropControl({ field, value, onChange, extras, pages = [] }) {
  // An href field becomes the visual link-target picker (page / top / section
  // / URL) instead of a raw text box.
  if (field.key === 'href') {
    return <LinkTargetControl label={field.label} value={value} onChange={onChange} pages={pages} />
  }
  if (field.control === 'textarea') {
    return <LabeledTextarea label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'code') {
    return (
      <div className="space-y-2">
        <SnippetPicker
          groups={JS_SNIPPET_GROUPS}
          list={jsSnippets}
          onPick={(s) => onChange(appendSnippet(value, s, 'js'))}
        />
        <LabeledTextarea
          label={field.label}
          value={value}
          onChange={onChange}
          rows={14}
          mono
          placeholder={'<div>Your custom HTML</div>\n<style>/* CSS */</style>\n<script>/* JS */<\\/script>'}
        />
      </div>
    )
  }
  if (field.control === 'links') {
    return <LinksEditor label={field.label} value={value} onChange={onChange} pages={pages} />
  }
  if (field.control === 'tabs') {
    return (
      <TabsEditorControl
        label={field.label}
        value={value}
        onChange={onChange}
        activeId={extras?.activeId}
        onActiveChange={extras?.onActiveChange}
        children={extras?.children}
        onChildrenChange={extras?.onChildrenChange}
      />
    )
  }
  if (field.control === 'image') {
    return <LabeledImage label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'color') {
    return <LabeledColor label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'px') {
    return <LabeledPx label={field.label} value={value} onChange={onChange} />
  }
  if (field.control === 'select') {
    return (
      <LabeledSelect
        label={field.label}
        value={value}
        onChange={onChange}
        options={field.options}
      />
    )
  }
  return <LabeledText label={field.label} value={value} onChange={onChange} />
}

function StyleControl({ styleKey, value, onChange }) {
  const meta = STYLE_META[styleKey]
  if (!meta) return null
  if (meta.control === 'color') {
    return <LabeledColor label={meta.label} value={value} onChange={onChange} />
  }
  if (meta.control === 'select') {
    return (
      <LabeledSelect
        label={meta.label}
        value={value}
        onChange={onChange}
        options={meta.options}
      />
    )
  }
  if (meta.control === 'px') {
    return <LabeledPx label={meta.label} value={value} onChange={onChange} />
  }
  if (meta.control === 'range') {
    return <LabeledRange label={meta.label} value={value} onChange={onChange} />
  }
  return (
    <LabeledText
      label={meta.label}
      value={value}
      onChange={onChange}
      placeholder={meta.placeholder}
    />
  )
}

function groupedStyles(keys) {
  const available = new Set(keys || [])
  const used = new Set()
  const groups = STYLE_GROUPS.map((group) => {
    const groupKeys = group.keys.filter((key) => available.has(key))
    groupKeys.forEach((key) => used.add(key))
    return { ...group, keys: groupKeys }
  }).filter((group) => group.keys.length)
  const remaining = [...available].filter((key) => !used.has(key))
  if (remaining.length) groups.push({ title: 'Advanced', keys: remaining })
  return groups
}

export default function PropertiesPanel({ htmlMode = false, onApplyThemeToHtml }) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const schema = useEditorStore((s) => s.schema)
  const page = useEditorStore(selectCurrentPage)
  const viewport = useEditorStore((s) => s.viewport)
  const updateProps = useEditorStore((s) => s.updateProps)
  const updateStyles = useEditorStore((s) => s.updateStyles)
  const updateTheme = useEditorStore((s) => s.updateTheme)
  const applyTheme = useEditorStore((s) => s.applyTheme)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  const setCustomJs = useEditorStore((s) => s.setCustomJs)
  const applyComponentPreset = useEditorStore((s) => s.applyComponentPreset)
  const setLayout = useEditorStore((s) => s.setLayout)
  const alignSelection = useEditorStore((s) => s.alignSelection)
  const distributeSelection = useEditorStore((s) => s.distributeSelection)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const setPageBackground = useEditorStore((s) => s.setPageBackground)
  const renamePage = useEditorStore((s) => s.renamePage)
  const setPageFolder = useEditorStore((s) => s.setPageFolder)
  const setVisibility = useEditorStore((s) => s.setVisibility)
  const autoArrangeMobile = useEditorStore((s) => s.autoArrangeMobile)
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent)
  const bringToFront = useEditorStore((s) => s.bringToFront)
  const sendToBack = useEditorStore((s) => s.sendToBack)
  const moveForward = useEditorStore((s) => s.moveForward)
  const moveBackward = useEditorStore((s) => s.moveBackward)
  const removeComponent = useEditorStore((s) => s.removeComponent)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const setTabsChildren = useEditorStore((s) => s.setTabsChildren)
  const applyThemeToComponent = useEditorStore((s) => s.applyThemeToComponent)
  const copyComponentToPage = useEditorStore((s) => s.copyComponentToPage)

  const isMobile = viewport === 'mobile'
  const isFlow = !!page.flowMode
  const layoutKey = isFlow ? 'layout' : isMobile ? 'mobileLayout' : 'layout'
  const selectedEntry = findComponentEntry(page.components, selectedId)
  const component = selectedEntry?.component || null
  const parentComponent = selectedEntry?.parent || null
  const isAbsoluteNested = parentComponent?.type === 'tabs' || parentComponent?.type === 'container'
  const showPositionControls = !isFlow || isAbsoluteNested
  const pageBackground = isMobile
    ? page.backgroundMobile || page.background || '#ffffff'
    : page.background || '#ffffff'
  const theme = schema.theme || DEFAULT_THEME

  if (!component) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-[#e5e7eb] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#111827]">Page</h2>
          <p className="text-xs text-[#6b7280]">
            {isFlow
              ? 'HTML flow layout - nothing selected'
              : `${isMobile ? 'Mobile layout' : 'PC layout'} - nothing selected`}
          </p>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section className="space-y-3">
            <SectionTitle>Page</SectionTitle>
            <LabeledText
              label="Page name"
              value={page.name}
              onChange={(v) => renamePage(page.id, v)}
            />
            <LabeledText
              label="Folder (optional)"
              value={page.folder}
              onChange={(v) => setPageFolder(page.id, v)}
              placeholder="e.g. Marketing"
            />
            <LabeledColor
              label={
                isFlow
                  ? 'Page background'
                  : isMobile
                    ? 'Page background (Mobile)'
                    : 'Page background (PC)'
              }
              value={pageBackground}
              onChange={setPageBackground}
            />
            {isMobile && !isFlow && (
              <button
                type="button"
                onClick={autoArrangeMobile}
                className="w-full rounded-lg border border-[#d1d5db] bg-white py-2 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6]"
              >
                Auto-arrange mobile layout
              </button>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Theme</SectionTitle>
              <button
                type="button"
                onClick={() => (htmlMode ? onApplyThemeToHtml?.(theme) : applyTheme())}
                title={htmlMode
                  ? 'Apply this palette + font to every HTML page'
                  : 'Apply the theme to every component'}
                className="rounded-lg border border-[#4f46e5] px-2 py-1 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
              >
                {htmlMode ? 'Apply to pages' : 'Apply to design'}
              </button>
            </div>
            {/* One-click presets: set the palette AND restyle everything —
                the component schema (component mode) or every HTML page's
                document (HTML mode). New components inherit the active theme. */}
            <div className="grid grid-cols-2 gap-1.5">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`Use the "${p.name}" theme and apply it to the whole site`}
                  onClick={() => {
                    updateTheme(p.theme)
                    if (htmlMode) onApplyThemeToHtml?.(normalizeTheme(p.theme))
                    else applyTheme()
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1.5 text-left text-[11px] font-medium text-[#374151] transition hover:border-[#4f46e5] hover:bg-[#eef2ff]"
                >
                  <span className="flex shrink-0 -space-x-1">
                    {[p.theme.primaryColor, p.theme.headerColor, p.theme.softColor].map((c, i) => (
                      <span
                        key={i}
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
            <LabeledColor
              label="Primary color"
              value={theme.primaryColor}
              onChange={(v) => updateTheme({ primaryColor: v })}
            />
            <LabeledColor
              label="Text color"
              value={theme.textColor}
              onChange={(v) => updateTheme({ textColor: v })}
            />
            <LabeledColor
              label="Muted color"
              value={theme.mutedColor}
              onChange={(v) => updateTheme({ mutedColor: v })}
            />
            <LabeledColor
              label="Site background"
              value={theme.backgroundColor}
              onChange={(v) => updateTheme({ backgroundColor: v })}
            />
            <LabeledColor
              label="Surface color"
              value={theme.surfaceColor}
              onChange={(v) => updateTheme({ surfaceColor: v })}
            />
            <LabeledColor
              label="Soft background"
              value={theme.softColor}
              onChange={(v) => updateTheme({ softColor: v })}
            />
            <LabeledColor
              label="Header color"
              value={theme.headerColor}
              onChange={(v) => updateTheme({ headerColor: v })}
            />
            <LabeledColor
              label="Header text"
              value={theme.headerTextColor}
              onChange={(v) => updateTheme({ headerTextColor: v })}
            />
            <LabeledSelect
              label="Font"
              value={theme.fontFamily}
              onChange={(v) => updateTheme({ fontFamily: v })}
              options={FONT_OPTIONS}
            />
            <LabeledPx
              label="Corner radius"
              value={theme.radius}
              onChange={(v) => updateTheme({ radius: v })}
            />
            <LabeledPx
              label="Button radius"
              value={theme.buttonRadius}
              onChange={(v) => updateTheme({ buttonRadius: v })}
            />
            <LabeledText
              label="Shadow"
              value={theme.shadow}
              onChange={(v) => updateTheme({ shadow: v })}
              placeholder="e.g. 0 8px 24px rgba(0,0,0,0.12)"
            />
          </section>

          <section className="space-y-3">
            <SectionTitle>Custom CSS</SectionTitle>
            <SnippetPicker
              groups={CSS_SNIPPET_GROUPS}
              list={cssSnippets}
              onPick={(s) => setCustomCss(appendSnippet(schema.customCss, s, 'css'))}
            />
            <LabeledTextarea
              label="CSS"
              value={schema.customCss || ''}
              onChange={setCustomCss}
              rows={8}
              mono
              placeholder=".page { scroll-behavior: smooth; }"
            />
          </section>

          <section className="space-y-3">
            <SectionTitle>Custom JavaScript</SectionTitle>
            <p className="text-xs leading-relaxed text-[#6b7280]">
              Runs on the published site inside a sandboxed iframe — full DOM,
              fetch, setTimeout, third-party CDNs, etc. Cannot reach this app or
              the visitor&apos;s session.
            </p>
            <SnippetPicker
              groups={JS_SNIPPET_GROUPS}
              list={jsSnippets}
              onPick={(s) => setCustomJs(appendSnippet(schema.customJs, s, 'js'))}
            />
            <LabeledTextarea
              label="JS"
              value={schema.customJs || ''}
              onChange={setCustomJs}
              rows={10}
              mono
              placeholder={'document.addEventListener("DOMContentLoaded", () => {\n  // your code\n})'}
            />
          </section>

          <AiAssistantSection />


          <p className="text-xs leading-relaxed text-[#6b7280]">
            {isFlow
              ? 'Flow mode uses one document order that adapts across PC and mobile.'
              : isMobile
                ? 'Mobile is a separate design. Drag and resize components on the phone, or auto-arrange them into a clean single column.'
                : 'Select a component on the canvas to edit its content, style, position and size.'}
          </p>
        </div>
      </div>
    )
  }

  const def = registry[component.type]
  const layout = component[layoutKey] || component.layout
  const componentPresets = presetsForType(component.type)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#e5e7eb] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#111827]">{def.label}</h2>
        <p className="text-xs text-[#6b7280]">{component.id}</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[#eef2ff] px-3 py-2">
          <span className="text-xs font-semibold text-[#4f46e5]">
            {isFlow ? 'Editing HTML flow layout' : `Editing ${isMobile ? 'Mobile' : 'PC'} layout`}
          </span>
          {isMobile && !isFlow && (
            <button
              type="button"
              onClick={autoArrangeMobile}
              className="rounded-lg border border-[#4f46e5] bg-white px-2 py-0.5 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
            >
              Auto-arrange
            </button>
          )}
        </div>

        {componentPresets.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Presets</SectionTitle>
            <LabeledSelect
              label="Component preset"
              value=""
              onChange={(value) => value && applyComponentPreset(component.id, value)}
              options={presetOptions(component.type)}
            />
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>
            {showPositionControls ? 'Position & Size' : 'Layout Size'}
            <span className="ml-1 font-normal normal-case text-[#9ca3af]">
              ({isFlow ? 'all screens' : isMobile ? 'mobile' : 'PC'})
            </span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {showPositionControls && (
              <>
                <LabeledNumber
                  label="X"
                  value={layout.x}
                  onChange={(v) => setLayout(component.id, { x: v })}
                />
                <LabeledNumber
                  label="Y"
                  value={layout.y}
                  onChange={(v) => setLayout(component.id, { y: v })}
                />
              </>
            )}
            <LabeledNumber
              label={isFlow ? 'Max width' : 'Width'}
              value={layout.w}
              onChange={(v) => setLayout(component.id, { w: v })}
            />
            <LabeledNumber
              label={isFlow ? 'Min height' : 'Height'}
              value={layout.h}
              onChange={(v) => setLayout(component.id, { h: v })}
            />
          </div>
        </section>

        {/* Align & Distribute. Live snap guides still help while dragging; these
            give precise, one-click control. One selection aligns to the
            artboard; a multi-selection (shift-click on the canvas) aligns the
            items to each other and can distribute equal gaps. */}
        {showPositionControls && (
          <section className="space-y-2">
            <SectionTitle>
              Align &amp; Distribute
              {selectedIds.length > 1 && (
                <span className="ml-1 font-normal normal-case text-[#9ca3af]">({selectedIds.length} selected)</span>
              )}
            </SectionTitle>
            <p className="text-[11px] leading-snug text-[#9ca3af]">
              {selectedIds.length > 1
                ? 'Aligns the selected items to each other.'
                : 'Aligns this item to the artboard. Shift-click on the canvas to select more.'}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                ['left', 'Left'],
                ['centerH', 'Center'],
                ['right', 'Right'],
                ['top', 'Top'],
                ['middleV', 'Middle'],
                ['bottom', 'Bottom'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => alignSelection(mode)}
                  className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-1.5 py-1.5 text-xs text-[#374151] hover:bg-[#e5e7eb]"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={selectedIds.length < 3}
                onClick={() => distributeSelection('x')}
                title={selectedIds.length < 3 ? 'Select 3+ items (shift-click) to distribute' : 'Equal horizontal gaps'}
                className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-1.5 py-1.5 text-xs text-[#374151] hover:bg-[#e5e7eb] disabled:opacity-40"
              >
                ↔ Distribute
              </button>
              <button
                type="button"
                disabled={selectedIds.length < 3}
                onClick={() => distributeSelection('y')}
                title={selectedIds.length < 3 ? 'Select 3+ items (shift-click) to distribute' : 'Equal vertical gaps'}
                className="rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-1.5 py-1.5 text-xs text-[#374151] hover:bg-[#e5e7eb] disabled:opacity-40"
              >
                ↕ Distribute
              </button>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <SectionTitle>Responsive</SectionTitle>
          <LabeledCheckbox
            label="Show on PC"
            checked={!component.hidden}
            onChange={(checked) => setVisibility(component.id, { hidden: !checked })}
          />
          <LabeledCheckbox
            label="Show on Mobile"
            checked={!component.hiddenMobile}
            onChange={(checked) => setVisibility(component.id, { hiddenMobile: !checked })}
          />
        </section>

        {(def.editableProps || []).length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Content</SectionTitle>
            {def.editableProps.map((field) => (
              <PropControl
                key={field.key}
                field={field}
                value={component.props[field.key]}
                pages={schema.pages}
                onChange={(val) => updateProps(component.id, { [field.key]: val })}
                extras={
                  component.type === 'tabs' && field.control === 'tabs'
                    ? {
                        activeId: component.props.activeId,
                        onActiveChange: (id) => setActiveTab(component.id, id),
                        children: component.children || [],
                        onChildrenChange: (next) => setTabsChildren(component.id, next),
                      }
                    : undefined
                }
              />
            ))}
          </section>
        )}

        {LINKABLE_TYPES.has(component.type) && (
          <section className="space-y-3">
            <SectionTitle>Link</SectionTitle>
            <LinkTargetControl
              label="Wrap in a link"
              value={component.props.href}
              pages={schema.pages}
              onChange={(val) => updateProps(component.id, { href: val })}
            />
          </section>
        )}

        {groupedStyles(def.editableStyles || []).map((group) => (
          <section key={group.title} className="space-y-3">
            <SectionTitle>{group.title}</SectionTitle>
            {group.keys.map((styleKey) => (
              <StyleControl
                key={styleKey}
                styleKey={styleKey}
                value={component.styles[styleKey]}
                onChange={(val) => updateStyles(component.id, { [styleKey]: val })}
              />
            ))}
          </section>
        ))}

        <section className="space-y-3">
          <SectionTitle>Advanced CSS</SectionTitle>
          {ADVANCED_STYLE_KEYS.map((styleKey) => (
            <StyleControl
              key={styleKey}
              styleKey={styleKey}
              value={component.styles[styleKey]}
              onChange={(val) => updateStyles(component.id, { [styleKey]: val })}
            />
          ))}
        </section>
      </div>

      <div className="space-y-2 border-t border-[#e5e7eb] p-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => duplicateComponent(component.id)}
            className="rounded-lg bg-[#f3f4f6] py-1.5 text-xs font-medium text-[#374151] hover:bg-[#e5e7eb]"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => bringToFront(component.id)}
            className="rounded-lg bg-[#f3f4f6] py-1.5 text-xs font-medium text-[#374151] hover:bg-[#e5e7eb]"
          >
            {isFlow ? 'Move to end' : 'To front'}
          </button>
          <button
            type="button"
            onClick={() => sendToBack(component.id)}
            className="rounded-lg bg-[#f3f4f6] py-1.5 text-xs font-medium text-[#374151] hover:bg-[#e5e7eb]"
          >
            {isFlow ? 'Move to start' : 'To back'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => moveBackward(component.id)}
            title={isFlow ? 'Move one step earlier in the order' : 'Bring one step backward'}
            className="rounded-lg bg-[#f3f4f6] py-1.5 text-xs font-medium text-[#374151] hover:bg-[#e5e7eb]"
          >
            {isFlow ? 'Move before' : 'Backward'}
          </button>
          <button
            type="button"
            onClick={() => moveForward(component.id)}
            title={isFlow ? 'Move one step later in the order' : 'Bring one step forward'}
            className="rounded-lg bg-[#f3f4f6] py-1.5 text-xs font-medium text-[#374151] hover:bg-[#e5e7eb]"
          >
            {isFlow ? 'Move next' : 'Forward'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => applyThemeToComponent(component.id)}
            title="Restyle this component with the active theme (colors, font, radius)"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#4f46e5] bg-white py-1.5 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            <PaletteIcon size={14} /> Apply theme
          </button>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) copyComponentToPage(component.id, e.target.value)
              e.target.value = ''
            }}
            disabled={schema.pages.length < 2}
            title="Copy this component (with all its properties) onto another page"
            className="rounded-lg border border-[#d1d5db] bg-white px-1.5 py-1.5 text-xs font-medium text-[#374151] focus:border-[#4f46e5] focus:outline-none disabled:opacity-40"
          >
            <option value="" disabled>
              Copy to page…
            </option>
            {schema.pages
              .filter((p) => p.id !== page.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => removeComponent(component.id)}
          className="w-full rounded-lg border border-[#d69ca5] bg-[#fde7e9] py-2 text-sm font-medium text-[#a4262c] hover:bg-[#f6d5d9]"
        >
          Delete component
        </button>
      </div>
    </div>
  )
}
