import { describe, expect, it } from 'vitest'
import { registry } from '../components/registry.jsx'
import { AI_PROVIDERS, getModelsFor } from '../utils/aiProviders.js'
import { SUGGESTION_CHIPS } from '../utils/aiTemplates.js'
import { WIZARD_FONTS, WIZARD_MOODS, WIZARD_SECTIONS, WIZARD_SITE_TYPES } from '../utils/aiWizard.js'
import { COMPONENT_PRESETS } from '../utils/componentPresets.js'
import { DEVICES } from '../utils/htmlDevices.js'
import { SITE_TEMPLATES } from '../utils/htmlTemplates.js'
import { HTML_BLOCKS, HTML_VARIANTS } from '../utils/htmlVariants.js'
import { ICON_OPTIONS } from '../utils/icons.js'
import { PRESET_IMAGES } from '../utils/presetImages.js'
import { cssSnippets, jsSnippets } from '../utils/snippets.js'
import { TEMPLATE_LIBRARY } from '../utils/templateLibrary.js'
import { TURKISH_TRANSLATIONS } from './translations.js'

const sourceModules = import.meta.glob('../**/*.{js,jsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function decodeStringBody(body) {
  return body
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\(['"\\])/g, '$1')
}

function staticTranslationKeys() {
  const keys = new Set()
  const pattern = /\bt\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g
  for (const [filename, source] of Object.entries(sourceModules)) {
    if (filename.includes('.test.') || filename.endsWith('/translations.js')) continue
    for (const match of source.matchAll(pattern)) {
      keys.add(decodeStringBody(match[1] ?? match[2]))
    }
  }
  return [...keys]
}

function visibleCatalogStrings() {
  const values = []
  const add = (...items) => values.push(...items.filter((item) => typeof item === 'string' && item))

  for (const category of TEMPLATE_LIBRARY) {
    add(category.name, category.desc)
    for (const variant of category.variants) add(variant.name, variant.desc)
  }
  for (const presets of Object.values(COMPONENT_PRESETS)) {
    for (const preset of presets) add(preset.label)
  }
  for (const image of PRESET_IMAGES) add(image.name)
  for (const device of DEVICES) add(device.label)
  for (const template of SITE_TEMPLATES) add(template.name, template.desc)
  for (const block of HTML_BLOCKS) add(block.label, block.desc)
  for (const variants of Object.values(HTML_VARIANTS)) {
    for (const variant of variants) add(variant.label)
  }
  for (const provider of AI_PROVIDERS) {
    add(provider.label, provider.keyHint)
    for (const model of getModelsFor(provider.id)) add(model.label, model.note)
  }
  for (const item of [...WIZARD_SITE_TYPES, ...WIZARD_SECTIONS, ...WIZARD_MOODS, ...WIZARD_FONTS]) add(item.label)
  for (const chip of SUGGESTION_CHIPS) add(chip.label)
  for (const snippet of [...jsSnippets, ...cssSnippets]) add(snippet.category, snippet.name, snippet.description)
  for (const [, label] of ICON_OPTIONS) add(label)
  add(
    'HTML file...',
    'Project folder...',
    'Project JSON...',
    'Export (download) the HTML file',
    'Download this project (.json)',
    'Export HTML…',
    'Export project (.json)',
  )

  for (const definition of Object.values(registry)) {
    add(definition.label)
    for (const field of definition.editableProps || []) {
      add(field.label)
      for (const option of field.options || []) add(option[1])
    }
  }

  return [...new Set(values)]
}

describe('Turkish translation coverage', () => {
  it('covers every static t() key used by the application', () => {
    const missing = staticTranslationKeys().filter(
      (key) => !Object.prototype.hasOwnProperty.call(TURKISH_TRANSLATIONS, key),
    )
    expect(missing.sort()).toEqual([])
  })

  it('covers labels and descriptions supplied by visible data catalogs', () => {
    const missing = visibleCatalogStrings().filter(
      (key) => !Object.prototype.hasOwnProperty.call(TURKISH_TRANSLATIONS, key),
    )
    expect(missing.sort()).toEqual([])
  })
})
