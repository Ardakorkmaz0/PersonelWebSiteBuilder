// AI assistant — tool dispatch + prompt loop + multi-provider transport.
//
// This module owns the moving parts that vary per turn: the tool catalogue,
// the snapshot, the per-provider call layer, the failover loop, and the
// post-applyTemplate stale-IDs recovery. Stable data (provider configs,
// templates, system prompt) lives in sibling modules:
//   - aiProviders.js     provider/key/model/endpoint storage + helpers
//   - aiTemplates.js     applyTemplate presets + chat suggestion chips
//   - aiSystemPrompt.js  the SYSTEM_PROMPT string used every turn
//
// Public API: every named export users / panels touch is re-exported below
// so import sites like `import { runAiPrompt, getProvider } from
// '../../utils/aiAssistant.js'` keep working unchanged.
//
// Security: every tool call still flows through the store and through the
// existing client/server sanitizers (sanitize_styles, sanitize_url,
// sanitize_custom_js, ALLOWED_COMPONENT_TYPES). Worst case the model
// proposes a javascript: href — sanitize_url drops it before save.

import { useEditorStore } from '../store/editorStore.js'
import { registry } from '../components/registry.jsx'
import {
  AI_PROVIDERS,
  GROQ_ENDPOINT,
  LOCAL_PROXY_PATH,
  OPENROUTER_ENDPOINT,
  buildGeminiEndpoint,
  getApiKey,
  getEndpoint,
  getModel,
  getProvider,
  pickBestLocalModel,
  readCachedLocalModels,
  resolveBackendBase,
  setModel,
  setProvider,
} from './aiProviders.js'
import { TEMPLATES } from './aiTemplates.js'
import { SYSTEM_PROMPT } from './aiSystemPrompt.js'

// ---------------------------------------------------------------------------
// Re-exports: stable public surface for AiBar / AiChatPanel / PropertiesPanel
// ---------------------------------------------------------------------------

export {
  AI_PROVIDERS,
  fetchLocalStatus,
  getApiKey,
  getEndpoint,
  getModel,
  getProvider,
  pickBestLocalModel,
  setProvider,
  setModel,
} from './aiProviders.js'
// Setters used by the Settings panel.
export {
  AI_MODELS,
  getModelsFor,
  setApiKey,
  setEndpoint,
} from './aiProviders.js'
// Suggestion chips for the empty chat state.
export { SUGGESTION_CHIPS } from './aiTemplates.js'

// ---------------------------------------------------------------------------
// Schema snapshot the model reasons over
// ---------------------------------------------------------------------------

// Compact snapshot of the schema the model can reason about without burning
// thousands of tokens on full style maps. Keeps ids stable so subsequent
// tool calls (update / remove) can address each component.
function schemaSnapshot() {
  const s = useEditorStore.getState()
  const briefProps = (c) => {
    const p = c.props || {}
    const keys = Object.keys(p).slice(0, 6)
    const out = {}
    for (const k of keys) {
      const v = p[k]
      if (typeof v === 'string') out[k] = v.length > 60 ? v.slice(0, 57) + '...' : v
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v
      else if (Array.isArray(v)) out[k] = `[${v.length}]`
      else out[k] = '[obj]'
    }
    return out
  }
  const briefLayout = (l) =>
    l
      ? {
          x: Math.round(l.x || 0),
          y: Math.round(l.y || 0),
          w: Math.round(l.w || 0),
          h: Math.round(l.h || 0),
        }
      : null
  const walk = (comps) =>
    (comps || []).map((c) => ({
      id: c.id,
      type: c.type,
      tabId: c.tabId,
      props: briefProps(c),
      layout: briefLayout(c.layout),
      hidden: c.hidden || undefined,
      hiddenMobile: c.hiddenMobile || undefined,
      children: Array.isArray(c.children) ? walk(c.children) : undefined,
    }))
  return {
    currentPageId: s.currentPageId,
    pages: s.schema.pages.map((p) => ({
      id: p.id,
      name: p.name,
      flowMode: p.flowMode,
      canvasWidth: p.canvasWidth,
      mobileWidth: p.mobileWidth,
      components: walk(p.components),
    })),
    theme: s.schema.theme,
    customCss: (s.schema.customCss || '').length > 0,
    customJs: (s.schema.customJs || '').length > 0,
  }
}

// ---------------------------------------------------------------------------
// Tool declarations + dispatcher
// ---------------------------------------------------------------------------

// Each declaration maps 1:1 onto a store action. We expose enough surface for
// layout-level edits + content + styles + custom code, but stop short of
// destructive bulk ops the model might abuse.
function toolDeclarations() {
  const types = Object.keys(registry)
  return [
    {
      name: 'addComponent',
      description:
        'Add a new top-level or nested component. Returns the new component id. parentId is required when adding into a container or tabs widget.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: types, description: 'Component type from the registry.' },
          parentId: { type: 'string', description: 'Optional. id of an existing container/tabs to drop into.' },
          x: { type: 'number', description: 'Optional initial x in design pixels.' },
          y: { type: 'number', description: 'Optional initial y in design pixels.' },
        },
        required: ['type'],
      },
    },
    {
      name: 'updateProps',
      description: 'Update the props of a component. Only the keys in patch are changed.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          patch: { type: 'object', description: 'JSON object with the props to merge in.' },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'updateStyles',
      description: 'Update the inline styles of a component. CSS keys must be camelCase (backgroundColor, fontSize, ...).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          patch: { type: 'object', description: 'JSON object with the style keys/values to merge.' },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'setLayout',
      description: 'Move/resize a component. patch may contain x, y, w, h.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              w: { type: 'number' },
              h: { type: 'number' },
            },
          },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'removeComponent',
      description: 'Delete a component (and its children, if any).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'duplicateComponent',
      description: 'Duplicate a component (with a fresh id), pasted next to the original.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveToEnd',
      description:
        "Reorder a component so it renders LAST in its parent's list — i.e. at the BOTTOM of the page in flow mode. Use this for requests like 'move the navbar to the bottom'.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveToStart',
      description:
        "Reorder a component so it renders FIRST in its parent's list — i.e. at the TOP of the page in flow mode. Use this for requests like 'move the footer to the top'.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveForward',
      description:
        'Move a component one step later in document order (towards the bottom of the page in flow mode).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'moveBackward',
      description:
        'Move a component one step earlier in document order (towards the top of the page in flow mode).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'setActiveTab',
      description: 'For a tabs widget, switch which tab panel is shown / receives new drops.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Tabs widget id.' },
          tabId: { type: 'string', description: 'Tab id (e.g. t1, t2) from props.tabs.' },
        },
        required: ['id', 'tabId'],
      },
    },
    {
      name: 'setCustomCss',
      description: 'Replace the site-wide Custom CSS (NOT merged).',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
    {
      name: 'setCustomJs',
      description:
        'Replace the site-wide Custom JS. Runs inside a sandboxed iframe on the public site. NOT merged.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
    {
      name: 'addPage',
      description: 'Add a new page to the site. Returns its new id.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
    {
      name: 'selectPage',
      description: 'Switch the currently-edited page.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'updateTheme',
      description:
        'Patch the site theme (primaryColor, textColor, backgroundColor, fontFamily, radius, etc.). Subsequent applyTheme writes the change into already-placed components.',
      parameters: {
        type: 'object',
        properties: { patch: { type: 'object' } },
        required: ['patch'],
      },
    },
    {
      name: 'centerHorizontally',
      description:
        "Centre a component horizontally inside the page artboard (sets layout.x so that x + w/2 == canvasWidth/2). Use this for requests like 'center the heading'.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    {
      name: 'setLinks',
      description:
        "Replace the navbar's links array. Each link is { label, href }. Hrefs starting with javascript: will be stripped on save.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Navbar component id.' },
          links: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                href: { type: 'string' },
              },
              required: ['label', 'href'],
            },
          },
        },
        required: ['id', 'links'],
      },
    },
    {
      name: 'setSelectOptions',
      description:
        "Replace the options of a select / dropdown component. `options` is an array of strings; the editor joins them with newlines internally.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          placeholder: { type: 'string', description: 'Optional placeholder text.' },
        },
        required: ['id', 'options'],
      },
    },
    {
      name: 'setTabs',
      description:
        "Replace the tabs array on a tabs widget. Each tab is { id, label }; ids must match the tabId on existing children to keep them attached. Pass new ids to create fresh tabs (children with the old ids will be orphaned).",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tabs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
              },
              required: ['id', 'label'],
            },
          },
          activeId: { type: 'string', description: 'Optional id of the tab to focus.' },
        },
        required: ['id', 'tabs'],
      },
    },
    {
      name: 'replaceComponentText',
      description:
        "Replace the visible text on a single component: works on heading/text props.text, button/linkbutton props.text, card props.title or props.text, badge/alert/list props.text.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          field: {
            type: 'string',
            enum: ['auto', 'text', 'title', 'label'],
            description: "Which prop to write to. 'auto' picks the most sensible field for the component type.",
          },
        },
        required: ['id', 'text'],
      },
    },
    {
      name: 'setHidden',
      description:
        "Show or hide a component on PC, on Mobile, or both. The component stays in the schema; only its visibility flag changes.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          hidden: { type: 'boolean', description: 'Hide on PC.' },
          hiddenMobile: { type: 'boolean', description: 'Hide on Mobile.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'clearPage',
      description:
        "Remove every component on the current page in one shot. Use this when the user says 'reset', 'clear the page', 'start over' — instead of issuing many removeComponent calls.",
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'alignComponent',
      description:
        "Snap a component's edge to one side of its parent box (artboard for top-level non-flow components, parent.layout for nested children). Mode is one of left | centerH | right | top | middleV | bottom. Use this for 'center the heading', 'right-align the button', 'put the card at the top of the container'.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          mode: {
            type: 'string',
            enum: ['left', 'centerH', 'right', 'top', 'middleV', 'bottom'],
          },
        },
        required: ['id', 'mode'],
      },
    },
    {
      name: 'distributeSiblings',
      description:
        "Even out the gaps between three or more siblings on the X or Y axis. parentId is the container/tabs id, or null for top-level. axis = 'x' (horizontal gaps) or 'y' (vertical gaps).",
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Container id, or omit for top-level.' },
          axis: { type: 'string', enum: ['x', 'y'] },
        },
        required: ['axis'],
      },
    },
    {
      name: 'applyTemplate',
      description:
        "Wipe the current page and replace it with a polished prebuilt design. Use this whenever the user asks for a named look ('GitHub style', 'dark', 'Apple-like', 'minimal landing', 'portfolio'). Internally clears the page, sets a matching theme + Custom CSS, and drops a coherent set of components (navbar, hero section, content sections, footer). Always prefer this over hand-crafting a many-step plan when the user names a style.",
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['github', 'dark', 'apple', 'minimal-landing', 'portfolio', 'blog', 'dashboard', 'marketing'],
            description: 'Which preset to apply.',
          },
        },
        required: ['name'],
      },
    },
  ]
}

// Dispatch a single tool call to the store. Each branch returns the value
// fed back to the model in the next round (used so the model can chain
// "add → set styles on the new id" without us having to teach it the new id
// beforehand). Validation errors come back as { ok:false, error } so the
// stale-IDs detector downstream can spot them.
// Exported so AiChatPanel's prompt-intent rescue can execute a recovered
// tool call directly (bypassing the model) when the model emits nothing
// usable. Returns the same {ok, ...} shape the in-loop dispatch returns.
export function executeTool(rawName, args) {
  const store = useEditorStore.getState()
  const a = args || {}
  // Models occasionally hallucinate snake_case (add_component) or PascalCase
  // tool names. Normalise to camelCase, then sanity-check against our known
  // list; fall back to a helpful error if still unknown.
  const name = normaliseToolName(rawName)
  switch (name) {
    case 'addComponent': {
      const before = collectIds(store.schema)
      store.addComponent(a.type, Math.round(a.x || 24), Math.round(a.y || 24), a.parentId || null)
      const newId = firstNewId(collectIds(useEditorStore.getState().schema), before)
      return { ok: true, id: newId }
    }
    case 'updateProps':
      store.updateProps(a.id, a.patch || {})
      return { ok: true }
    case 'updateStyles':
      store.updateStyles(a.id, a.patch || {})
      return { ok: true }
    case 'setLayout':
      store.setLayout(a.id, a.patch || {})
      return { ok: true }
    case 'removeComponent':
      store.removeComponent(a.id)
      return { ok: true }
    case 'duplicateComponent':
      store.duplicateComponent(a.id)
      return { ok: true }
    // Store names are bringToFront / sendToBack but those are confusing in a
    // flow-mode (vertical document) context — expose them to the model as
    // moveToEnd / moveToStart instead.
    case 'moveToEnd':
      store.bringToFront(a.id)
      return { ok: true }
    case 'moveToStart':
      store.sendToBack(a.id)
      return { ok: true }
    case 'moveForward':
      store.moveForward(a.id)
      return { ok: true }
    case 'moveBackward':
      store.moveBackward(a.id)
      return { ok: true }
    case 'setActiveTab':
      store.setActiveTab(a.id, a.tabId)
      return { ok: true }
    case 'setCustomCss':
      store.setCustomCss(a.code || '')
      return { ok: true }
    case 'setCustomJs':
      store.setCustomJs(a.code || '')
      return { ok: true }
    case 'addPage': {
      const before = useEditorStore.getState().schema.pages.map((p) => p.id)
      store.addPage(a.name || 'New page')
      const after = useEditorStore.getState().schema.pages.map((p) => p.id)
      const newId = after.find((id) => !before.includes(id))
      return { ok: true, id: newId }
    }
    case 'selectPage':
      store.selectPage(a.id)
      return { ok: true }
    case 'updateTheme':
      store.updateTheme(a.patch || {})
      // The store ships theme variables via CSS — but already-placed
      // components keep their hard-coded styles until applyTheme rewrites
      // them. Auto-apply so "make everything blue" actually colours the
      // existing canvas instead of just changing future drops.
      try { store.applyTheme() } catch { /* applyTheme is optional */ }
      return { ok: true, autoApplied: true }
    case 'centerHorizontally': {
      const node = findDeep(store.schema, a.id)
      if (!node) return { ok: false, error: 'Component not found' }
      const page = store.schema.pages.find((p) => p.components.some((c) => c.id === a.id))
      const canvasW = page?.canvasWidth || 1000
      const w = Math.round(node.layout?.w || 200)
      const newX = Math.max(0, Math.round((canvasW - w) / 2))
      store.setLayout(a.id, { x: newX })
      return { ok: true, x: newX }
    }
    case 'setLinks': {
      const links = Array.isArray(a.links) ? a.links.map((l) => ({
        label: String(l?.label || ''),
        href: String(l?.href || ''),
      })) : []
      store.updateProps(a.id, { links })
      return { ok: true, count: links.length }
    }
    case 'setSelectOptions': {
      const opts = Array.isArray(a.options) ? a.options.map((s) => String(s)) : []
      const patch = { options: opts.join('\n') }
      if (typeof a.placeholder === 'string') patch.placeholder = a.placeholder
      store.updateProps(a.id, patch)
      return { ok: true, count: opts.length }
    }
    case 'setTabs': {
      const tabs = Array.isArray(a.tabs) ? a.tabs.map((t) => ({
        id: String(t?.id || ''),
        label: String(t?.label || ''),
      })).filter((t) => t.id) : []
      const patch = { tabs }
      if (typeof a.activeId === 'string') patch.activeId = a.activeId
      else if (tabs.length) patch.activeId = tabs[0].id
      store.updateProps(a.id, patch)
      return { ok: true, count: tabs.length }
    }
    case 'replaceComponentText': {
      const node = findDeep(store.schema, a.id)
      if (!node) return { ok: false, error: 'Component not found' }
      const field = pickTextField(node.type, a.field || 'auto')
      if (!field) return { ok: false, error: `No editable text field on ${node.type}` }
      store.updateProps(a.id, { [field]: String(a.text || '') })
      return { ok: true, field }
    }
    case 'setHidden': {
      const patch = {}
      if (typeof a.hidden === 'boolean') patch.hidden = a.hidden
      if (typeof a.hiddenMobile === 'boolean') patch.hiddenMobile = a.hiddenMobile
      if (!Object.keys(patch).length) return { ok: false, error: 'Provide hidden or hiddenMobile' }
      store.setVisibility(a.id, patch)
      return { ok: true }
    }
    case 'alignComponent':
      store.alignComponent(a.id, a.mode)
      return { ok: true }
    case 'distributeSiblings':
      store.distributeSiblings(a.parentId || null, a.axis === 'x' ? 'x' : 'y')
      return { ok: true }
    case 'clearPage': {
      const before = useEditorStore.getState()
      const page = before.schema.pages.find((p) => p.id === before.currentPageId)
      const ids = (page?.components || []).map((c) => c.id)
      ids.forEach((id) => store.removeComponent(id))
      return { ok: true, removed: ids.length }
    }
    case 'applyTemplate': {
      // Weak local models often invent a template name from the user's topic
      // (e.g. "youtube", "restaurant", "saas"). Instead of failing the whole
      // chain, fall back to the closest curated template — the customisation
      // round downstream will rewrite the placeholder copy for the topic.
      const wanted = String(a?.name || '').toLowerCase()
      let tpl = TEMPLATES[wanted]
      let resolvedName = wanted
      if (!tpl) {
        resolvedName = mapTopicToTemplate(wanted)
        tpl = TEMPLATES[resolvedName]
      }
      if (!tpl) return { ok: false, error: `Unknown template "${a.name}". Choose one of: ${Object.keys(TEMPLATES).join(', ')}` }
      // 1) wipe the page first so existing components don't leak.
      const before0 = useEditorStore.getState()
      const page0 = before0.schema.pages.find((p) => p.id === before0.currentPageId)
      ;(page0?.components || []).map((c) => c.id).forEach((id) => store.removeComponent(id))
      // 2) force HTML Flow mode. addComponent on a non-flow page drops every
      // new node at (24,24) → templates with no explicit positions used to
      // stack on top of each other and looked broken. Flow mode lets flex
      // stack them naturally in document order.
      const refreshed = useEditorStore.getState()
      const currentPage = refreshed.schema.pages.find((p) => p.id === refreshed.currentPageId)
      if (currentPage && !currentPage.flowMode) {
        try { store.enableFlowMode() } catch { /* ignore */ }
      }
      // 3) theme + custom css
      if (tpl.theme) {
        store.updateTheme(tpl.theme)
        try { store.applyTheme() } catch { /* ignore */ }
      }
      if (typeof tpl.customCss === 'string') store.setCustomCss(tpl.customCss)
      // 4) build the component tree top-down. Track newest id so we can patch
      // props after creation.
      const created = {}
      for (const step of tpl.steps || []) {
        const beforeIds = collectIds(useEditorStore.getState().schema)
        store.addComponent(step.type, step.x || 0, step.y || 0, step.parentId ? created[step.parentId] : null)
        const newId = firstNewId(collectIds(useEditorStore.getState().schema), beforeIds)
        if (newId) {
          if (step.alias) created[step.alias] = newId
          if (step.props) store.updateProps(newId, step.props)
          if (step.styles) store.updateStyles(newId, step.styles)
          if (step.layout) store.setLayout(newId, step.layout)
        }
      }
      return {
        ok: true,
        template: resolvedName,
        requestedName: wanted,
        topicFallback: resolvedName !== wanted ? resolvedName : undefined,
        componentsCreated: Object.keys(created).length,
      }
    }
    default:
      return { ok: false, error: `Unknown tool "${rawName}" (normalised to "${name}"). Use one of the declared tool names exactly.` }
  }
}

// Last-ditch recovery for models that don't tool-call at all (gemma-family is
// the usual culprit — base Gemma was never tuned for function calling, so it
// invents tool names like "google:search" and "function_response"). When the
// model returned nothing usable, look at the user's prompt alone and emit the
// most plausible tool intent. Returns { name, args, reason } or null.
//
// Exported so AiChatPanel can call it directly after detecting a total tool
// failure, and tests can pin the regex behaviour.
export function recoverIntentFromPrompt(prompt) {
  const raw = String(prompt || '').toLowerCase().trim()
  if (!raw) return null
  // Topic-style site requests — "make me a youtube site", "X sitesi yap",
  // "bana Y olsun", "build a Z portfolio". Cover EN + TR phrasings.
  const sitePatterns = [
    /(?:make|build|create|do|design)\s+(?:me\s+)?(?:a|an|the)?\s*([a-zA-ZçğıöşüÇĞİÖŞÜ-]+)\s*(?:site|page|website)/i,
    /([a-zA-ZçğıöşüÇĞİÖŞÜ-]+)\s+(?:site|sitesi|sayfa|websitesi)\s*(?:yap|olsun|kur|build)?/i,
    /(?:bana|benim)\s+(?:bir)?\s*([a-zA-ZçğıöşüÇĞİÖŞÜ-]+)\s*(?:sitesi|site|sayfası)?\s*yap/i,
  ]
  for (const re of sitePatterns) {
    const m = raw.match(re)
    if (m && m[1]) {
      const topic = m[1].toLowerCase()
      // Drop conjunctions / generic words that aren't a real topic.
      if (['a', 'an', 'the', 'bir', 'me', 'us', 'one'].includes(topic)) continue
      const tplName = mapTopicToTemplate(topic) || 'portfolio'
      return {
        name: 'applyTemplate',
        args: { name: tplName },
        reason: `Recovered from your prompt — "${topic}" maps to the ${tplName} template.`,
      }
    }
  }
  // "Make it dark" / "switch to dark mode" → applyTemplate dark.
  if (/\b(?:dark\s*mode|night\s*mode|karanlık)\b/i.test(raw)) {
    return { name: 'applyTemplate', args: { name: 'dark' }, reason: 'Recovered from "dark mode" intent.' }
  }
  // "Github style" / "github tarzı" → applyTemplate github.
  if (/\bgithub\b/i.test(raw)) {
    return { name: 'applyTemplate', args: { name: 'github' }, reason: 'Recovered from "github" intent.' }
  }
  // "Apple style" / "iphone page" → applyTemplate apple.
  if (/\bapple|iphone|ipad\b/i.test(raw)) {
    return { name: 'applyTemplate', args: { name: 'apple' }, reason: 'Recovered from "apple" intent.' }
  }
  // "Primary X" / "make primary X" → updateTheme primary colour. Map basic
  // colour words to hexes that match the existing system-prompt examples.
  const colorWords = {
    blue: '#2563eb', red: '#ef4444', green: '#22c55e', purple: '#9333ea',
    pink: '#ec4899', orange: '#ea580c', yellow: '#facc15', black: '#0f172a',
    white: '#ffffff', grey: '#6b7280', gray: '#6b7280',
  }
  const primaryMatch = raw.match(/\bprimary\s+(?:colou?r\s+(?:to\s+)?)?(\w+)/i)
                    || raw.match(/(?:change|make)\s+(?:the\s+)?(?:site|primary)?\s*(?:colou?r)?\s*(?:to)?\s*(\w+)/i)
  if (primaryMatch) {
    const w = primaryMatch[1].toLowerCase()
    if (colorWords[w]) {
      return {
        name: 'updateTheme',
        args: { patch: { primaryColor: colorWords[w] } },
        reason: `Recovered "${w}" primary colour.`,
      }
    }
  }
  return null
}

// Map a free-form topic word the model emitted (e.g. "youtube", "restaurant",
// "saas", "fitness") to the closest curated template. Designed so weak models
// that invent template names from the user's prompt still get a coherent
// starting point, and the subsequent customisation round can localise the
// placeholder copy to the actual topic. Returns one of the keys of TEMPLATES
// or '' (caller treats '' as truly-unknown). Exported so tests can pin the
// mapping table without needing the full store.
export function mapTopicToTemplate(rawName) {
  const n = String(rawName || '').toLowerCase().trim()
  if (!n) return ''
  // Direct hits first — covers exact + common typos via includes.
  if (TEMPLATES[n]) return n
  for (const key of Object.keys(TEMPLATES)) {
    if (n.includes(key) || key.includes(n)) return key
  }
  // Topic → closest template mapping. Order matters when a phrase matches
  // multiple — most specific first.
  const topicMap = [
    [/blog|news|writer|article|essay|magazine|substack|newsletter|notes/, 'blog'],
    [/dashboard|admin|console|analytics|metric|kpi|crm|erp/, 'dashboard'],
    [/portfolio|personal|cv|résumé|resume|freelanc|designer|developer|engineer|illustrator/, 'portfolio'],
    [/youtube|twitch|tiktok|channel|podcast|streamer|vlog|video|creator|fan|tribute|star wars|marvel|harry potter|anime|game|band/, 'portfolio'],
    [/restaurant|cafe|coffee|food|menu|bar|bakery/, 'marketing'],
    [/gym|fitness|yoga|workout|coach|trainer|sport/, 'marketing'],
    [/shop|store|ecommerce|product|brand|launch|landing|signup|subscribe|trial/, 'marketing'],
    [/saas|app|software|tool|platform|service/, 'marketing'],
    [/agency|consult|studio|firm/, 'minimal-landing'],
    [/dark|night|black|studio/, 'dark'],
    [/apple|iphone|ipad|mac/, 'apple'],
    [/github|repo|open\s*source|code/, 'github'],
  ]
  for (const [re, key] of topicMap) {
    if (re.test(n)) return key
  }
  // Generic "X için site / site for X" → portfolio is the most flexible.
  return 'portfolio'
}

// snake_case / kebab-case / PascalCase / spaces → camelCase.
function normaliseToolName(raw) {
  if (typeof raw !== 'string') return ''
  let s = raw.trim().replace(/[\s_-]+/g, '_')
  // Convert each chunk after the first to TitleCase, first stays lowercase.
  const parts = s.split('_').filter(Boolean)
  if (!parts.length) return ''
  return [
    parts[0].charAt(0).toLowerCase() + parts[0].slice(1),
    ...parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)),
  ].join('')
}

function findDeep(schema, id) {
  const walk = (arr) => {
    for (const c of arr || []) {
      if (c.id === id) return c
      if (Array.isArray(c.children)) {
        const f = walk(c.children)
        if (f) return f
      }
    }
    return null
  }
  for (const p of schema?.pages || []) {
    const f = walk(p.components)
    if (f) return f
  }
  return null
}

// Map a component type + caller hint to the prop name that holds its main
// visible text. Used by replaceComponentText so the AI doesn't have to
// remember per-type field names.
function pickTextField(type, hint) {
  if (hint && hint !== 'auto') return hint
  switch (type) {
    case 'heading':
    case 'text':
    case 'button':
    case 'linkbutton':
    case 'badge':
    case 'alert':
    case 'list':
    case 'quote':
      return 'text'
    case 'card':
      return 'title'
    case 'input':
    case 'select':
      return 'label'
    default:
      return null
  }
}

function collectIds(schema) {
  const ids = []
  const walk = (arr) => {
    for (const c of arr || []) {
      ids.push(c.id)
      if (Array.isArray(c.children)) walk(c.children)
    }
  }
  for (const p of schema.pages || []) walk(p.components)
  return new Set(ids)
}

function firstNewId(after, before) {
  for (const id of after) if (!before.has(id)) return id
  return null
}

// ---------------------------------------------------------------------------
// Transport: error formatting + per-provider call layer
// ---------------------------------------------------------------------------

// Parse Google's RetryInfo block (RFC-style "30s") into milliseconds, falling
// back to a reasonable default. Used so the auto-retry sleeps exactly the
// amount Google asked for instead of a guess.
function parseRetryDelayMs(parsed, defaultMs) {
  try {
    const details = parsed?.error?.details || []
    for (const d of details) {
      const t = d?.['@type'] || ''
      if (t.endsWith('RetryInfo') && typeof d.retryDelay === 'string') {
        const m = d.retryDelay.match(/(\d+(?:\.\d+)?)s/)
        if (m) return Math.round(parseFloat(m[1]) * 1000)
      }
    }
  } catch { /* ignore */ }
  return defaultMs
}

// Map a raw provider error blob to a one-line, human-friendly message that
// fits the chat panel without overwhelming the user with JSON. `providerId`
// drives the wording (so a Groq 429 doesn't say "Gemini quota hit").
function describeApiError(status, rawText, providerId = getProvider()) {
  let parsed
  try { parsed = JSON.parse(rawText) } catch { parsed = null }
  const apiMessage = parsed?.error?.message || parsed?.error?.error || ''
  const me = AI_PROVIDERS.find((p) => p.id === providerId)
  const meLabel = me?.label?.replace(/ \(.*\)$/, '') || 'AI provider'
  const other = AI_PROVIDERS.find((p) => p.id !== providerId)
  const otherLabel = other?.label?.replace(/ \(.*\)$/, '') || 'the other provider'
  // OpenRouter retires free models from time to time. When that happens the
  // message is "No endpoints found for <model>" — point the user at Settings
  // instead of leaving them puzzled.
  if (/no endpoints found/i.test(apiMessage)) {
    return `${meLabel} retired the selected model. Open Settings → Model dropdown and pick a fresh one (Qwen3 80B is the safe default), or paste any current id from openrouter.ai/models.`
  }
  if (status === 429) {
    const waitMs = parseRetryDelayMs(parsed, 30_000)
    const waitSec = Math.ceil(waitMs / 1000)
    return `${meLabel} quota hit (per-minute or per-day). Wait ~${waitSec}s and try again, or switch to ${otherLabel} in Settings (Properties → AI Assistant).`
  }
  if (status === 400 && /api key|invalid/i.test(apiMessage)) {
    return `Your ${meLabel} API key is invalid or missing the right permissions. Re-paste it in Settings.`
  }
  if (status === 401) {
    return `Your ${meLabel} API key was rejected (401). Open Settings → AI Assistant and paste a fresh key.`
  }
  if (status === 403) {
    return `Your ${meLabel} API key was rejected (403). Check that the key is active and has the Generative Language / Chat Completions API enabled.`
  }
  if (status >= 500) {
    return `${meLabel} is having trouble right now (${status}). Try again in a moment or switch to ${otherLabel}.`
  }
  return apiMessage || `${meLabel} ${status}: ${rawText.slice(0, 200)}`
}

// Universal turn shape we hand around so the rest of the file doesn't have to
// care which provider it talks to. Each "turn" is either:
//   { role: 'user'|'model', text }                       (text turn)
//   { role: 'model', functionCalls: [{name, args}] }     (model tool calls)
//   { role: 'tool', toolResults: [{name, response}] }    (our tool outputs)
// callProvider() translates this into the right wire shape and translates the
// response back into a list of `parts` shaped like Gemini's (so the calling
// loop is unchanged).

async function callProvider(apiKey, history, currentTurnText) {
  const provider = getProvider()
  if (provider === 'groq') return callGroq(apiKey, history, currentTurnText)
  if (provider === 'openrouter') return callOpenRouter(apiKey, history, currentTurnText)
  if (provider === 'local') return callLocal(apiKey, history, currentTurnText)
  return callGemini(apiKey, history, currentTurnText)
}

// ---- Gemini transport --------------------------------------------------
async function callGemini(apiKey, history, currentTurnText) {
  const modelId = getModel('gemini')
  const url = `${buildGeminiEndpoint(modelId)}?key=${encodeURIComponent(apiKey)}`
  const contents = historyToGeminiContents(history, currentTurnText)
  const body = JSON.stringify({
    systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: toolDeclarations() }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { temperature: 0.2 },
  })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) {
      const data = await res.json()
      const candidate = data?.candidates?.[0]
      return candidate?.content?.parts || []
    }
    const text = await res.text()
    if (res.status === 429 && attempt === 0) {
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = null }
      const waitMs = Math.min(8000, parseRetryDelayMs(parsed, 4000))
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    throw new Error(describeApiError(res.status, text, 'gemini'))
  }
  throw new Error('Gemini did not respond after the retry. Please try again.')
}

function historyToGeminiContents(history, currentTurnText) {
  const out = []
  for (const turn of history) {
    if (turn.role === 'user' && typeof turn.text === 'string') {
      out.push({ role: 'user', parts: [{ text: turn.text }] })
    } else if (turn.role === 'model' && Array.isArray(turn.functionCalls)) {
      out.push({
        role: 'model',
        parts: turn.functionCalls.map((c) => ({ functionCall: { name: c.name, args: c.args || {} } })),
      })
    } else if (turn.role === 'model' && typeof turn.text === 'string') {
      out.push({ role: 'model', parts: [{ text: turn.text }] })
    } else if (turn.role === 'tool' && Array.isArray(turn.toolResults)) {
      out.push({
        role: 'user',
        parts: turn.toolResults.map((r) => ({ functionResponse: { name: r.name, response: r.response } })),
      })
    }
  }
  if (currentTurnText) {
    out.push({ role: 'user', parts: [{ text: currentTurnText }] })
  }
  return out
}

// ---- Generic OpenAI-compatible transport -------------------------------
// Shared by Groq and the local Ollama / LM Studio path. `opts.url` is the
// chat-completions endpoint, `opts.apiKey` is optional (local providers may
// not need one), `opts.providerId` is just used for friendly error wording.
async function callOpenAICompatible(history, currentTurnText, opts) {
  const messages = historyToOpenAiMessages(history, currentTurnText)
  const body = JSON.stringify({
    model: opts.modelId,
    messages,
    tools: toolDeclarations().map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
    temperature: 0.2,
    ...(opts.extraBody || {}),
  })
  const headers = { 'Content-Type': 'application/json', ...(opts.extraHeaders || {}) }
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res
    try {
      res = await fetch(opts.url, { method: 'POST', headers, body })
    } catch (e) {
      // Network-level failure (typical for unreachable local servers /
      // missing CORS headers). Give the user a hint they can actually act on.
      if (opts.providerId === 'local') {
        throw new Error(
          `Could not reach the local AI at ${opts.url}. Make sure Ollama (or LM Studio) is running and started with OLLAMA_ORIGINS="*" so the browser can call it.`,
          { cause: e },
        )
      }
      throw new Error(e?.message || 'Network error', { cause: e })
    }
    if (res.ok) {
      const data = await res.json()
      const choice = data?.choices?.[0]?.message
      if (!choice) return []
      const parts = []
      if (Array.isArray(choice.tool_calls)) {
        for (const tc of choice.tool_calls) {
          let args
          try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {} } catch { args = {} }
          parts.push({ functionCall: { name: tc.function?.name || '', args } })
        }
      }
      // Some local models (Llama 3.1 8B in particular) "think aloud" and
      // print the intended call as JSON inside the assistant text instead of
      // using the tool_calls field. Recover those so the canvas still
      // updates. If we extract any call from the text we DROP the original
      // text so the chat doesn't show both the JSON and the action.
      if (parts.length === 0 && typeof choice.content === 'string' && choice.content.trim()) {
        const recovered = extractTextCalls(choice.content)
        if (recovered.length) {
          for (const r of recovered) parts.push({ functionCall: r })
        } else {
          parts.push({ text: choice.content })
        }
      } else if (typeof choice.content === 'string' && choice.content.trim()) {
        parts.push({ text: choice.content })
      }
      return parts
    }
    const text = await res.text()
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 4000))
      continue
    }
    throw new Error(describeApiError(res.status, text, opts.providerId))
  }
  throw new Error(`${opts.providerId} did not respond after the retry. Please try again.`)
}

async function callGroq(apiKey, history, currentTurnText) {
  return callOpenAICompatible(history, currentTurnText, {
    url: GROQ_ENDPOINT,
    apiKey,
    providerId: 'groq',
    modelId: getModel('groq'),
  })
}

async function callOpenRouter(apiKey, history, currentTurnText) {
  return callOpenAICompatible(history, currentTurnText, {
    url: OPENROUTER_ENDPOINT,
    apiKey,
    providerId: 'openrouter',
    modelId: getModel('openrouter'),
    // OpenRouter asks for these so traffic from this app appears in its
    // analytics correctly; both are optional but it's polite to send them.
    extraHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'PersonelWebSiteBuilder',
    },
  })
}

async function callLocal(apiKey, history, currentTurnText) {
  const base = getEndpoint('local') || 'http://localhost:11434/v1'
  // Last-mile model validation: if Settings ever ran a status fetch this
  // session, the installed models are cached. If the saved id isn't in that
  // cache, silently swap to the best installed alternative — prevents
  // Ollama 404s from a stale localStorage default (e.g. "llama3.1" when the
  // user actually pulled "llama3.1:8b").
  let savedModel = getModel('local')
  const cached = readCachedLocalModels()
  if (cached.length && !cached.includes(savedModel)) {
    const corrected = pickBestLocalModel(cached, savedModel)
    if (corrected && corrected !== savedModel) {
      savedModel = corrected
      setModel(corrected, 'local')
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
    }
  }
  // Route through Django: browser → /api/ai/local/proxy/ → Ollama. The base
  // URL travels inside the body (key `_localBase`) so we don't trigger a CORS
  // preflight with a custom header.
  const url = `${resolveBackendBase()}${LOCAL_PROXY_PATH}/proxy/`
  return callOpenAICompatible(history, currentTurnText, {
    url,
    apiKey,
    providerId: 'local',
    modelId: savedModel,
    extraBody: { _localBase: base },
  })
}

// Scan an assistant text reply for tool-call intent and recover it as a real
// function call. Weak local models (e.g. Llama 3.1 8B) frequently write the
// call as JSON, as a JS-like function call, or in prose with the function
// name mentioned. We try several patterns in order of specificity.
// Exported so tests can pin the regression set for each pattern.
export function extractTextCalls(text) {
  const out = []
  if (typeof text !== 'string') return out
  const declared = toolDeclarations()
  const isReal = (n) => declared.some((t) => t.name === n)
  const norm = (n) => (isReal(n) ? n : normaliseToolName(n))

  // Pattern A — JSON object with name + parameters/arguments.
  const jsonRe = /\{\s*"name"\s*:\s*"([a-zA-Z_][\w]*)"\s*,\s*"(?:parameters|arguments|args)"\s*:\s*(\{[\s\S]*?\})\s*\}/g
  let m
  while ((m = jsonRe.exec(text)) !== null) {
    let args = {}
    try { args = JSON.parse(m[2]) } catch { /* skip malformed */ }
    const n = norm(m[1])
    if (isReal(n)) out.push({ name: n, args })
  }
  if (out.length) return out

  // Pattern B — JS-like call: applyTemplate({...}) / addComponent({...})
  const callRe = /\b([a-zA-Z_][\w]*)\s*\(\s*(\{[\s\S]*?\})\s*\)/g
  while ((m = callRe.exec(text)) !== null) {
    let args = {}
    try { args = JSON.parse(m[2]) } catch { /* skip malformed */ }
    const n = norm(m[1])
    if (isReal(n)) out.push({ name: n, args })
  }
  if (out.length) return out

  // Pattern C — prose mentions a tool name verbatim with quoted args nearby.
  // "I'll call applyTemplate with name='blog'" or "apply the github template".
  // Special-case applyTemplate because it's the most common high-impact call.
  const templateNames = ['github', 'dark', 'apple', 'minimal-landing', 'portfolio', 'blog', 'dashboard', 'marketing']
  const lower = text.toLowerCase()
  if (/apply\s*template|applytemplate|(?:apply|use)\s+the\s+\w+\s+template|hazır\s*şablon|template\s+(?:name|adı)/i.test(text)) {
    const found = templateNames.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(lower))
    if (found) out.push({ name: 'applyTemplate', args: { name: found } })
  }
  if (out.length) return out

  // Pattern D — bare argument JSON, no tool name. Llama 3.1 8B emits this all
  // the time: `{"patch":{"primaryColor":"#007bff"}}` for "change the primary
  // colour to blue", `{"id":"...","mode":"centerH"}` for "centre the heading",
  // and so on. Infer the intended tool from the shape of the args alone, then
  // fall back to keyword hints from the surrounding prose when shape isn't
  // decisive. The candidate is only accepted if it matches a declared tool.
  const bareJson = text.match(/\{[\s\S]*\}/)
  if (bareJson) {
    let args
    try { args = JSON.parse(bareJson[0]) } catch { args = null }
    if (args && typeof args === 'object') {
      const inferred = inferToolFromArgs(args, lower)
      if (inferred && isReal(inferred)) out.push({ name: inferred, args })
    }
  }
  if (out.length) return out

  return out
}

// Theme-shape vs component-shape: theme keys live on the site-wide theme dict.
// If patch contains any of these, the caller almost certainly meant updateTheme.
const THEME_PATCH_KEYS = new Set([
  'primaryColor', 'textColor', 'mutedColor', 'backgroundColor', 'surfaceColor',
  'softColor', 'headerColor', 'headerTextColor', 'fontFamily', 'radius',
  'buttonRadius', 'shadow',
])

// Pure args-shape → tool-name inference. Falls back to the user/assistant
// prose for the ambiguous cases. Returns '' when nothing fits.
function inferToolFromArgs(args, lowerProse = '') {
  const keys = Object.keys(args || {})
  const hasId = typeof args.id === 'string' && args.id
  // --- updateTheme: {patch: {primaryColor|fontFamily|...}}
  if (args.patch && typeof args.patch === 'object') {
    const patchKeys = Object.keys(args.patch)
    const themeKeyHits = patchKeys.filter((k) => THEME_PATCH_KEYS.has(k)).length
    if (themeKeyHits > 0 && !hasId) return 'updateTheme'
    // --- setLayout / updateStyles / updateProps: keyed by patch shape
    if (hasId) {
      const layoutKeys = ['x', 'y', 'w', 'h']
      if (patchKeys.length && patchKeys.every((k) => layoutKeys.includes(k))) return 'setLayout'
      // CSS-shaped values (kebab/camel case property name + colour or length) →
      // updateStyles. Heuristic: keys are lowercase + values are strings.
      const looksCssy = patchKeys.length && patchKeys.every(
        (k) => /^[a-z]+[A-Z]?[a-zA-Z]*$/.test(k) && typeof args.patch[k] !== 'object',
      )
      if (looksCssy) return 'updateStyles'
      return 'updateProps'
    }
  }
  // --- applyTemplate: {name: 'github'|'dark'|...}
  if (typeof args.name === 'string' && !hasId) {
    const templates = ['github', 'dark', 'apple', 'minimal-landing', 'portfolio', 'blog', 'dashboard', 'marketing']
    if (templates.includes(args.name)) return 'applyTemplate'
  }
  // --- addComponent: {type: 'navbar'|'heading'|...}
  if (typeof args.type === 'string' && !hasId) return 'addComponent'
  if (hasId) {
    // --- specialised content tools — match by collection key.
    if (Array.isArray(args.links)) return 'setLinks'
    if (Array.isArray(args.options)) return 'setSelectOptions'
    if (Array.isArray(args.tabs)) return 'setTabs'
    if (typeof args.text === 'string') return 'replaceComponentText'
    if (typeof args.mode === 'string') return 'alignComponent'
    if (typeof args.tabId === 'string') return 'setActiveTab'
    if (typeof args.hidden === 'boolean' || typeof args.hiddenMobile === 'boolean') return 'setHidden'
  }
  // --- distributeSiblings: {axis, parentId?}
  if (typeof args.axis === 'string' && !hasId) return 'distributeSiblings'
  // --- setCustomCss / setCustomJs: {code} — needs prose to disambiguate.
  if (typeof args.code === 'string' && keys.length === 1) {
    if (/\bcss|stylesheet|style\b/i.test(lowerProse)) return 'setCustomCss'
    if (/\bjs|javascript|script\b/i.test(lowerProse)) return 'setCustomJs'
    // Default to CSS — far more common for the "add some styles" request.
    return 'setCustomCss'
  }
  return ''
}

function historyToOpenAiMessages(history, currentTurnText) {
  const out = [{ role: 'system', content: SYSTEM_PROMPT }]
  // OpenAI-compatible APIs require a tool_call_id to thread tool results back
  // to the assistant turn that requested them.
  let pendingCallIds = []
  for (const turn of history) {
    if (turn.role === 'user' && typeof turn.text === 'string') {
      out.push({ role: 'user', content: turn.text })
    } else if (turn.role === 'model' && typeof turn.text === 'string') {
      out.push({ role: 'assistant', content: turn.text })
    } else if (turn.role === 'model' && Array.isArray(turn.functionCalls)) {
      const calls = turn.functionCalls.map((c, i) => {
        const id = `c_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`
        return {
          id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
        }
      })
      pendingCallIds = calls.map((c) => c.id)
      out.push({ role: 'assistant', content: '', tool_calls: calls })
    } else if (turn.role === 'tool' && Array.isArray(turn.toolResults)) {
      turn.toolResults.forEach((r, i) => {
        const tcid = pendingCallIds[i] || `c_${Date.now()}_${i}`
        out.push({
          role: 'tool',
          tool_call_id: tcid,
          name: r.name,
          content: JSON.stringify(r.response || {}),
        })
      })
      pendingCallIds = []
    }
  }
  if (currentTurnText) {
    out.push({ role: 'user', content: currentTurnText })
  }
  return out
}

// ---------------------------------------------------------------------------
// runAiPrompt — failover loop + the per-provider round loop
// ---------------------------------------------------------------------------

// Walk the configured providers in display order and return the ones that are
// ready to take a request (have a key, or are key-less like the local
// runtime). The currently-active provider is moved to the front so it's
// tried first when runAiPrompt is called.
function readyProviders() {
  const active = getProvider()
  const ready = AI_PROVIDERS.filter((p) => p.needsKey === false || !!getApiKey(p.id))
  ready.sort((a, b) => (a.id === active ? -1 : b.id === active ? 1 : 0))
  return ready
}

function isFailoverWorthy(err) {
  const m = String(err?.message || err || '').toLowerCase()
  return (
    m.includes('quota') ||
    m.includes('429') ||
    m.includes('rate') ||
    m.includes('could not reach the local') ||
    m.includes('did not respond after the retry')
  )
}

// Generation mode: ask the model for a complete HTML document instead of
// structured tool calls. Llama 3.1 8B / gemma / phi can't reliably tool-call
// but write decent HTML, so this turns their weakness into a path that works.
// Returns { html, providerUsed } — caller writes the html to site.html and
// the editor switches to HtmlWorkspace automatically (isHtmlSite truthy).
export async function runAiHtmlPrompt(prompt, { history = [], currentHtml = '' } = {}) {
  const candidates = readyProviders()
  if (!candidates.length) {
    throw new Error('No AI provider is set up yet. Open Settings (Properties → AI Assistant) and paste any free key, or pick Local AI if you have Ollama running.')
  }
  // Try the active provider first, then failover on quota / unreachable.
  let lastErr = null
  for (const p of candidates) {
    const original = getProvider()
    if (original !== p.id) {
      setProvider(p.id)
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
    }
    try {
      const html = await callHtmlModeOnce(prompt, { history, currentHtml })
      return { html, providerUsed: p.id }
    } catch (e) {
      lastErr = e
      if (!isFailoverWorthy(e)) {
        if (original !== p.id) setProvider(original)
        throw e
      }
    }
  }
  throw lastErr || new Error('All providers failed to generate HTML.')
}

const HTML_SYSTEM_PROMPT = `You are a website-builder backend that emits ONE complete, self-contained HTML5 document per request. Output the document text directly — no code fences, no commentary, no explanation. Start with <!DOCTYPE html> and end with </html>.

Rules:
- All visible copy must be in English even if the user writes in another language. Translate user-provided text to English before placing it.
- One file: inline ALL CSS in a single <style> in <head>. Inline any small JS in a <script> at the end of <body>. Do NOT link external stylesheets/scripts except for fonts.googleapis.com.
- ALWAYS include <meta charset="UTF-8"> and <meta name="viewport" content="width=device-width, initial-scale=1.0"> in <head>.
- Use semantic tags: <header>, <nav>, <main>, <section>, <article>, <footer>.
- Use Google Fonts when the user names a font ("Inter", "Poppins", "Playfair Display", "JetBrains Mono", etc.) — add the <link rel="stylesheet" href="https://fonts.googleapis.com/css2?..."> in <head>.
- Include placeholder copy that matches the topic the user named (so a "youtube site" gets video-platform copy, not lorem ipsum).
- If the user asks for a change to an EXISTING document, return the FULL updated document — never a diff, never just the new fragment.
- When the user asks to ADD something to an existing document ("add a contact section", "put a newsletter signup at the bottom", "add a video grid"), KEEP the rest of the document intact and insert the new element where it visually belongs — a new section goes among the other sections in document order, a nav link goes inside the existing <nav>, a footer item inside the existing <footer>. Do not drop unrelated existing content.
- When the user references a position ("at the top", "above the footer", "after the hero", "in the navbar"), honour it precisely.

Design system — every page you produce must look professionally designed:
- Layout: a .container with max-width 1100-1200px and 24px side padding; sections padded ~96px top/bottom (64px on mobile); content never touches the viewport edge.
- Typography: clamp() for headings (hero h1 ≈ clamp(36px, 6vw, 60px)), line-height 1.1 on headings / 1.6 on body, letter-spacing -0.02em on large headings, body 16-18px.
- Colour: ONE accent colour plus neutral grays (#111 ink, #6b7280 muted, #f5f5f7 soft background, white surface). Use the accent sparingly: buttons, links, small highlights. Never more than 2 accent colours.
- Header: sticky, white/translucent with a subtle bottom border; brand left, 3-5 nav links right; on mobile collapse the links behind a CSS-only hamburger (hidden checkbox + label, no JS).
- Hero: small badge/eyebrow line, big headline (one phrase in the accent colour), one-sentence subtext, a primary button + a ghost secondary button.
- Sections: alternate white and soft-gray backgrounds; each starts with a small uppercase eyebrow label in the accent colour, then an h2, then a one-line lead in muted gray.
- Cards: grid via repeat(auto-fit, minmax(260px, 1fr)); white background, 1px #ececec border, 14-18px radius, soft shadow, slight translateY on hover.
- Footer: dark (#101015) with 2-3 columns (brand blurb, site links, social links) and a bottom bar with the copyright line.
- Motion: 0.15s transitions on buttons/cards/links only — no keyframe animation noise.
- Images: prefer CSS gradient placeholders or https://picsum.photos URLs; always max-width:100%; height:auto.
- Exactly one @media (max-width: 768px) block: stack grids to one column, shrink section padding, show the hamburger.

Page recipes — when the request matches one of these site types, follow the section order exactly (it is what professional sites of that type use):
- CV / resume: header (name + role + contact line) → 2-3 sentence profile → experience as a vertical timeline (period, title, company, one achievement with a number) → education + skills side by side (skill bars or chips) → email CTA. Real-sounding employers and metrics, never "Company A".
- Portfolio: hero with one-line positioning → grid of 6 projects (gradient thumbnail, tag chip, title, one-line result) → about with 3 stats → contact CTA card.
- SaaS / startup landing: hero (badge, headline, sub, 2 CTAs) → 3-4 stat row → 3 feature cards → 3-tier pricing (middle tier highlighted "Most popular") → 3-item FAQ (details/summary) → CTA band → footer.
- Restaurant / café: hero → menu as category headings with dish/price rows (dashed leader line) → hours + address block → events/catering CTA.
- Photography: hero → masonry gallery (CSS columns, varied aspect-ratio gradient tiles) → short about → booking CTA.
- Blog: small hero (title + one-liner) → list of 4-6 post cards (tag chip, date, title, excerpt) → newsletter CTA.
- Event / wedding: hero with date+place badge → schedule timeline → venue block with map link → RSVP CTA (mailto).
- Shop: hero → product grid (gradient image tile, name, price) → brand story → contact CTA.
- Link in bio: single centered column, avatar circle with initial, name, one-liner, 4-6 full-width link cards with emoji + arrow.

Quality bar: the result must look like a $2,000 custom site, not a homework page. Never leave default browser styles visible (Times New Roman, blue links, 8px body margin = instant failure). Every section needs real, specific copy for the topic — concrete numbers, names, and prices beat vague claims.

THE LATEST USER MESSAGE IS THE PRIMARY INTENT. Older turns are reference only. If the user previously asked for X and now asks for Y, return a Y-focused document. Do not blend two unrelated requests.`

// One-shot HTML generation against the active provider, reusing the existing
// transport plumbing. Unlike runAiPromptOnce there are no tools and no rounds
// — the model's first text response IS the answer.
async function callHtmlModeOnce(prompt, { history = [], currentHtml = '' }) {
  const provider = getProvider()
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const apiKey = getApiKey(provider)
  if (!apiKey && providerInfo?.needsKey !== false) {
    throw new Error(`Set your ${providerInfo?.label || provider} API key in the editor settings.`)
  }
  // Build a flat user message: prior chat history (cap 10), current HTML
  // snapshot (if any), and the latest request. Cheaper than per-turn role
  // ping-pong for a single-shot generation.
  const HIST = (history || [])
    .filter((m) => m && m.text)
    .slice(-10)
    .map((m) => `${m.role === 'model' || m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.text}`)
    .join('\n')
  const seed = currentHtml && currentHtml.trim()
    ? `\n\nCurrent HTML (rewrite this):\n${currentHtml.slice(0, 30_000)}\n`
    : ''
  // Edits of an existing document get an intent-specific contract appended —
  // weak models otherwise "helpfully" rewrite the whole page on an "add a
  // section" request and drop half the content.
  const contract = seed ? INTENT_CONTRACTS[detectHtmlIntent(prompt)] : ''
  const fullPrompt = `${HIST ? `Recent chat:\n${HIST}\n` : ''}${seed}\nUser request: ${prompt}${contract}\n\nReturn the full HTML document now.`

  // For Gemini we hit the same generateContent endpoint without tools.
  if (provider === 'gemini') {
    const modelId = getModel('gemini')
    const url = `${buildGeminiEndpoint(modelId)}?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'user', parts: [{ text: HTML_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    })
    if (!res.ok) throw new Error(describeApiError(res.status, await res.text(), 'gemini'))
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return cleanHtmlResponse(text)
  }
  // Groq / OpenRouter / Local all speak OpenAI-compatible chat-completions.
  let url
  let extraHeaders = {}
  let extraBody = {}
  let modelId
  if (provider === 'groq') {
    url = GROQ_ENDPOINT
    modelId = getModel('groq')
  } else if (provider === 'openrouter') {
    url = OPENROUTER_ENDPOINT
    modelId = getModel('openrouter')
    extraHeaders = {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'PersonelWebSiteBuilder',
    }
  } else {
    // local
    const base = getEndpoint('local') || 'http://localhost:11434/v1'
    url = `${resolveBackendBase()}${LOCAL_PROXY_PATH}/proxy/`
    modelId = getModel('local')
    extraBody = { _localBase: base }
  }
  const headers = { 'Content-Type': 'application/json', ...extraHeaders }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: HTML_SYSTEM_PROMPT },
        { role: 'user', content: fullPrompt },
      ],
      temperature: 0.4,
      max_tokens: 8192,
      ...extraBody,
    }),
  })
  if (!res.ok) throw new Error(describeApiError(res.status, await res.text(), provider))
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  return cleanHtmlResponse(text)
}

// Models often wrap the document in a ```html ... ``` fence even when told
// not to. Strip the wrapper; if no fence, return as-is. Guarantees the
// caller never has to pattern-match the model's chrome. Exported so the
// test suite can pin every shape of response we've seen in the wild.
export function cleanHtmlResponse(raw) {
  if (typeof raw !== 'string') return ''
  let s = raw.trim()
  // ``` or ```html ... ```
  const fence = s.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/i)
  if (fence) s = fence[1].trim()
  // Some models prefix prose; drop everything before <!DOCTYPE or <html.
  const docStart = s.search(/<!DOCTYPE\s+html|<html[\s>]/i)
  if (docStart > 0) s = s.slice(docStart)
  return s
}

// ---- HTML-mode edit intents -------------------------------------------------
// Classify what the user is asking of an EXISTING document, so the transport
// can append a hard contract and the panel can verify the result. Keyword
// lists cover English + Turkish (the user-facing languages of this product).
export function detectHtmlIntent(prompt) {
  // NOTE: JS \b is ASCII-only — it never fires after Turkish letters like
  // 'ı' ("temayı"), so use an explicit letter lookahead instead.
  const s = ` ${String(prompt || '').toLowerCase()} `
  const END = '(?![a-zçğıöşü])'
  if (new RegExp(`[ \\n](add|insert|append|attach|include|put|create a new|ekle|eklesen|eklemek|yeni bölüm|bir de)${END}`).test(s)) {
    return 'add'
  }
  if (new RegExp(`[ \\n](theme|tema|temayı|temasını|color|colour|colors|renk|renkler|renkleri|palette|palet|recolor|restyle|dark mode|light mode|koyu tema|açık tema|font|typography|yazı tipi|stil|style it|görünüm)${END}`).test(s)) {
    return 'style'
  }
  return 'general'
}

const INTENT_CONTRACTS = {
  add: '\n\nIMPORTANT — this is an ADD request. Return the COMPLETE current document with EVERY existing section preserved exactly as it is (same text, same order, same styling). Only insert the new element where it belongs. Do not rewrite, reformat, or drop anything that already exists.',
  style: '\n\nIMPORTANT — this is a RESTYLE request. Change ONLY presentation: <style> rules, colors, fonts, spacing. Keep every piece of content (all text, links, images) and the EXACT same set of sections/elements — the number of sections must not change. Do NOT add any new section, element, image, or text. Do NOT remove, reword, or reorder anything. If you cannot restyle without adding content, restyle only.',
  general: '',
}

const norm = (el) => String(el?.outerHTML || '').replace(/\s+/g, ' ').trim()

// How much of the old document's wording survived into the new one (0..1).
// Token-based, so harmless CSS/markup churn doesn't count as loss. Used to
// catch a model that "restyled" a page by rewriting half the copy.
export function contentPreservationRatio(oldHtml, newHtml) {
  const tokens = (h) => {
    const doc = new DOMParser().parseFromString(String(h || ''), 'text/html')
    return (doc.body?.textContent || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  }
  const oldTok = tokens(oldHtml)
  if (!oldTok.length) return 1
  const newSet = new Set(tokens(newHtml))
  const kept = oldTok.filter((w) => newSet.has(w)).length
  return kept / oldTok.length
}

// ADD-request repair: when the model dropped existing top-level sections
// while "adding" something, salvage the genuinely NEW sections from its
// response and graft them onto the ORIGINAL document instead of accepting
// the lossy rewrite. Returns { html, repaired }.
export function repairDroppedSections(oldHtml, newHtml) {
  const parse = (h) => new DOMParser().parseFromString(String(h || ''), 'text/html')
  const oldDoc = parse(oldHtml)
  const newDoc = parse(newHtml)
  const oldKids = [...oldDoc.body.children]
  const newSet = new Set([...newDoc.body.children].map(norm))
  const missing = oldKids.filter((k) => !newSet.has(norm(k)))
  if (!missing.length) return { html: newHtml, repaired: false }
  const oldSet = new Set(oldKids.map(norm))
  const added = [...newDoc.body.children].filter((k) => !oldSet.has(norm(k)))
  for (const node of added) {
    oldDoc.body.appendChild(oldDoc.importNode(node, true))
  }
  return { html: '<!DOCTYPE html>\n' + oldDoc.documentElement.outerHTML, repaired: true }
}

// Last line of defence for HTML mode: weak models sometimes answer "add a
// contact section" with JUST the new <section> despite the full-document
// instruction. Rather than failing the turn:
//  - a fragment is grafted onto the end of the current document's <body>
//    (the editor's apply step then relocates it next to what the user is
//    looking at and flashes it), or
//  - wrapped into a minimal standalone document when there's no current doc.
// Returns { html, coerced, grafted } or null when the text has no markup at
// all (pure prose — nothing we could render).
export function coerceToHtmlDocument(generated, { currentHtml = '', title = 'My Site' } = {}) {
  const s = String(generated || '').trim()
  if (!s) return null
  if (/<html[\s>]/i.test(s)) return { html: s, coerced: false, grafted: false }
  if (!/<([a-z][a-z0-9-]*)(\s[^>]*)?>/i.test(s)) return null
  const cur = String(currentHtml || '')
  if (/<\/body>/i.test(cur)) {
    return { html: cur.replace(/<\/body>/i, `${s}\n</body>`), coerced: true, grafted: true }
  }
  const esc = String(title).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${s}
</body></html>`
  return { html, coerced: true, grafted: false }
}

export async function runAiPrompt(prompt, { maxRounds = 3, history = [] } = {}) {
  const candidates = readyProviders()
  if (!candidates.length) {
    throw new Error('No AI provider is set up yet. Open Settings (Properties → AI Assistant) and paste any free key, or pick Local AI if you have Ollama running.')
  }
  // Try each ready provider in turn; bail out on the first one that succeeds.
  // Non-quota errors bubble up immediately so we don't mask real bugs.
  const tried = []
  let lastErr = null
  let switchedFrom = null
  for (const p of candidates) {
    if (getProvider() !== p.id) {
      switchedFrom = switchedFrom || getProvider()
      setProvider(p.id)
      // Let the toolbar + chat header refresh their provider/model badges
      // without waiting for a focus event.
      try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
    }
    try {
      const result = await runAiPromptOnce(prompt, { maxRounds, history })
      if (switchedFrom && switchedFrom !== p.id) {
        const fromLabel = AI_PROVIDERS.find((x) => x.id === switchedFrom)?.label || switchedFrom
        const toLabel = p.label
        const cleanFrom = fromLabel.replace(/ \(.*\)$/, '')
        const cleanTo = toLabel.replace(/ \(.*\)$/, '')
        result.text = `(Switched from ${cleanFrom} to ${cleanTo} — first one’s quota was full.) ${result.text || ''}`
      }
      return result
    } catch (e) {
      tried.push({ id: p.id, label: p.label, err: e })
      lastErr = e
      if (!isFailoverWorthy(e)) {
        // Real bug, not a quota/availability hiccup — surface it as-is.
        if (switchedFrom) {
          setProvider(switchedFrom)
          try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
        }
        throw e
      }
      if (tried.length >= candidates.length) {
        // Every configured provider hit its quota or was unreachable. Build
        // a compact summary so the user knows what's happening and what to
        // set up to break the deadlock next time.
        if (switchedFrom) {
          setProvider(switchedFrom)
          try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
        }
        const tail = tried
          .map((t) => t.label.replace(/ \(.*\)$/, ''))
          .join(', ')
        const missing = AI_PROVIDERS
          .filter((x) => x.needsKey !== false && !getApiKey(x.id))
          .map((x) => x.label.replace(/ \(.*\)$/, ''))
        const hint = missing.length
          ? ` Add a free ${missing[0]} key in Settings (Properties → AI Assistant) so auto-failover has somewhere to fall back to.`
          : ' Wait ~60s and try again.'
        throw new Error(`All ready providers are out of quota or unreachable (tried: ${tail}).${hint}`, { cause: e })
      }
    }
  }
  if (switchedFrom) {
    setProvider(switchedFrom)
    try { window.dispatchEvent(new Event('storage')) } catch { /* ignore */ }
  }
  throw lastErr
}

async function runAiPromptOnce(prompt, { maxRounds = 3, history = [] } = {}) {
  const provider = getProvider()
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const apiKey = getApiKey(provider)
  if (!apiKey && providerInfo?.needsKey !== false) {
    const providerLabel = providerInfo?.label || provider
    throw new Error(`Set your ${providerLabel} API key in the editor settings.`)
  }

  const snapshot = schemaSnapshot()
  const HISTORY_TURNS = 12
  // Strong cloud providers handle multi-step customization in the first
  // function-calling response; only weak local models (Llama 3.1 8B and
  // friends) actually need a second-round nudge after applyTemplate.
  const NEEDS_TEMPLATE_NUDGE = provider === 'local'
  // Provider-neutral conversation log. We feed it to callProvider() each
  // round and it gets translated into the right wire shape (Gemini parts /
  // OpenAI messages). Each entry is one of:
  //   { role: 'user', text }
  //   { role: 'model', text }                          (assistant text)
  //   { role: 'model', functionCalls: [{name, args}] } (assistant tool call)
  //   { role: 'tool', toolResults: [{name, response}] }
  const turns = (history || [])
    .filter((m) => m && m.text)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role === 'model' ? 'model' : 'user', text: m.text }))

  // We ship the snapshot in turn 1 only. Subsequent rounds reuse the model's
  // memory of it — the function-call tool results we feed back already tell
  // it what changed, so reshipping the full schema is pure token waste.
  const initialPromptText = `Current schema snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nUser request: ${prompt}`

  let finalText = ''
  const calls = []
  for (let round = 0; round < maxRounds; round += 1) {
    const isFirst = round === 0
    const parts = await callProvider(
      apiKey,
      turns,
      isFirst ? initialPromptText : '',
    )
    const functionCalls = parts.filter((p) => p.functionCall)
    const textParts = parts.filter((p) => typeof p.text === 'string' && p.text.length > 0)

    // On the first round our turns array did not yet contain the prompt; add
    // it now so subsequent rounds (which use turns directly) carry it.
    if (isFirst) turns.push({ role: 'user', text: initialPromptText })

    if (functionCalls.length === 0) {
      finalText = textParts.map((p) => p.text).join('\n').trim() || 'Done.'
      if (finalText) turns.push({ role: 'model', text: finalText })
      break
    }

    // Record the model's tool-calling turn.
    turns.push({
      role: 'model',
      functionCalls: functionCalls.map(({ functionCall }) => ({
        name: functionCall.name,
        args: functionCall.args || {},
      })),
    })

    const toolResults = functionCalls.map(({ functionCall }) => {
      const args = functionCall.args || {}
      let result
      try {
        result = executeTool(functionCall.name, args)
      } catch (e) {
        result = { ok: false, error: String(e?.message || e) }
      }
      const entry = { name: functionCall.name, args, result }
      calls.push(entry)
      console.debug('[AI tool]', entry)
      return { name: functionCall.name, response: result }
    })
    turns.push({ role: 'tool', toolResults })

    // Two failure modes after applyTemplate, both fixed by force-feeding a
    // fresh snapshot into the next round:
    //
    // (1) Weak local models (Llama 3.1 8B, etc.) stop after applyTemplate
    //     and never emit the customisation calls at all.
    // (2) Strong cloud models (Gemini, Groq, OpenRouter) emit applyTemplate
    //     and customisation calls in the SAME parallel batch — the
    //     customisations target component IDs from the pre-template snapshot
    //     and silently fail with "Component not found" because applyTemplate
    //     wiped them. The user then sees the chat claim "all done" while the
    //     canvas still shows the old template (or empty).
    //
    // Whenever applyTemplate succeeded this round, hand the model the new
    // schema and tell it to redo the customisation against real IDs. This
    // costs at most one extra round (still within maxRounds=3) but fixes
    // both classes of failure in one shot.
    const appliedTemplate = toolResults.find((r) => r.name === 'applyTemplate' && r.response?.ok)
    const staleCalls = toolResults.filter(
      (r) => r.name !== 'applyTemplate' && r.response && r.response.ok === false && /not found/i.test(r.response.error || ''),
    )
    if (appliedTemplate && (NEEDS_TEMPLATE_NUDGE || staleCalls.length > 0)) {
      const freshSnapshot = schemaSnapshot()
      const reason = staleCalls.length > 0
        ? `${staleCalls.length} of your tool calls in this batch targeted component IDs from the BEFORE-template snapshot and were silently dropped because applyTemplate wiped those components. `
        : 'Template applied — now you must customise it. '
      turns.push({
        role: 'user',
        text:
          reason
          + 'Here is the FRESH schema with the real new IDs. Re-emit your customisation tool calls '
          + '(setLinks for the navbar, replaceComponentText for EVERY heading / text / button / card '
          + 'title) using the NEW IDs from this snapshot so the page actually reflects the user\'s topic. '
          + 'Do not stop until every default placeholder string has been replaced.\n\n'
          + 'New schema:\n'
          + JSON.stringify(freshSnapshot, null, 2),
      })
    }
  }

  return { text: finalText || 'Done.', toolCallCount: calls.length, calls }
}

// ---- Scoped, single-component AI edit -------------------------------------
// Powers the ✨ "ask AI to restyle / rewrite THIS element" affordance in the
// properties panel: a single-shot completion (no tools, no rounds) that returns
// a JSON patch applied to ONE component — its styles and/or props — so the AI
// touches only the selected element, never the rest of the page.

// Generic single-shot completion against the active provider. Returns the raw
// model text. Mirrors callHtmlModeOnce's transport with a caller-supplied
// system prompt + a tight token budget.
async function completeText(systemPrompt, userText, { temperature = 0.4, maxTokens = 900 } = {}) {
  const provider = getProvider()
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)
  const apiKey = getApiKey(provider)
  if (!apiKey && providerInfo?.needsKey !== false) {
    throw new Error(`Set your ${providerInfo?.label || provider} API key in the editor settings (the AI button).`)
  }
  if (provider === 'gemini') {
    const modelId = getModel('gemini')
    const url = `${buildGeminiEndpoint(modelId)}?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    })
    if (!res.ok) throw new Error(describeApiError(res.status, await res.text(), 'gemini'))
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
  let url
  let extraHeaders = {}
  let extraBody = {}
  let modelId
  if (provider === 'groq') {
    url = GROQ_ENDPOINT
    modelId = getModel('groq')
  } else if (provider === 'openrouter') {
    url = OPENROUTER_ENDPOINT
    modelId = getModel('openrouter')
    extraHeaders = {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      'X-Title': 'PersonelWebSiteBuilder',
    }
  } else {
    const base = getEndpoint('local') || 'http://localhost:11434/v1'
    url = `${resolveBackendBase()}${LOCAL_PROXY_PATH}/proxy/`
    modelId = getModel('local')
    extraBody = { _localBase: base }
  }
  const headers = { 'Content-Type': 'application/json', ...extraHeaders }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      temperature,
      max_tokens: maxTokens,
      ...extraBody,
    }),
  })
  if (!res.ok) throw new Error(describeApiError(res.status, await res.text(), provider))
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

// Pull the first JSON object out of a model reply (tolerates ```json fences +
// leading prose). Exported for the test suite.
export function extractJsonObject(text) {
  if (typeof text !== 'string') return null
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(s.slice(start, end + 1))
  } catch {
    return null
  }
}

const COMPONENT_EDIT_SYSTEM = `You restyle / rewrite ONE component inside a website builder. You get its type, current props, and current inline CSS styles (camelCase keys), plus a user instruction. Return ONLY a JSON object with the changes to APPLY to THIS component — no prose, no markdown fence:
{"styles": {"backgroundColor": "#ef4444"}, "props": {"text": "New copy"}}
Rules:
- Change ONLY what the instruction asks; keep everything else. Include a key ONLY when you want to change it.
- CSS keys are camelCase (backgroundColor, borderRadius, fontSize, boxShadow, padding). Colours as hex.
- To change wording, set the SAME prop key the component already uses for its text (see the current props).
- All user-facing text must be in English. Output valid JSON only.`

// Ask the active model to edit a SINGLE component. Returns { styles, props }
// (either may be empty). Throws on provider / parse errors.
export async function aiEditComponent(component, instruction) {
  if (!component || !instruction || !instruction.trim()) return { styles: {}, props: {} }
  const userText = [
    `Component type: ${component.type}`,
    `Current props: ${JSON.stringify(component.props || {})}`,
    `Current styles: ${JSON.stringify(component.styles || {})}`,
    `Instruction: ${instruction.trim()}`,
  ].join('\n')
  const raw = await completeText(COMPONENT_EDIT_SYSTEM, userText)
  const patch = extractJsonObject(raw) || {}
  return {
    styles: patch.styles && typeof patch.styles === 'object' ? patch.styles : {},
    props: patch.props && typeof patch.props === 'object' ? patch.props : {},
  }
}
