// AI Site Wizard: turns a short guided questionnaire into ONE rich generation
// prompt for runAiHtmlPrompt — the same engine (and page recipes) the AI
// chat's HTML path uses. Kept separate from aiAssistant.js so the recipe is
// reviewable and unit-testable on its own.

// `recipe` names the page recipe in HTML_SYSTEM_PROMPT so the model follows
// the professional section order for that site type. `category` maps to the
// Explore feed's Site.CATEGORY_CHOICES.
export const WIZARD_SITE_TYPES = [
  { id: 'portfolio', label: 'Portfolio', icon: '🎨', category: 'portfolio', recipe: 'portfolio' },
  { id: 'cv', label: 'CV / Resume', icon: '📄', category: 'personal', recipe: 'CV / resume' },
  { id: 'business', label: 'Business / Agency', icon: '💼', category: 'business', recipe: 'SaaS / startup landing adapted to a services business' },
  { id: 'landing', label: 'SaaS / Startup', icon: '🚀', category: 'landing', recipe: 'SaaS / startup landing' },
  { id: 'restaurant', label: 'Restaurant / Café', icon: '☕', category: 'business', recipe: 'restaurant / café' },
  { id: 'photography', label: 'Photography', icon: '📷', category: 'portfolio', recipe: 'photography' },
  { id: 'blog', label: 'Blog / Magazine', icon: '✍️', category: 'blog', recipe: 'blog' },
  { id: 'shop', label: 'Shop / Product', icon: '🛍️', category: 'shop', recipe: 'shop' },
  { id: 'event', label: 'Event / Wedding', icon: '💍', category: 'other', recipe: 'event / wedding' },
  { id: 'links', label: 'Link in Bio', icon: '🔗', category: 'personal', recipe: 'link in bio' },
]

export const WIZARD_SECTIONS = [
  { id: 'hero', label: 'Hero / intro' },
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services / features' },
  { id: 'projects', label: 'Projects / gallery' },
  { id: 'experience', label: 'Experience timeline' },
  { id: 'menu', label: 'Menu & prices' },
  { id: 'stats', label: 'Stats / numbers' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'posts', label: 'Latest posts' },
  { id: 'faq', label: 'FAQ' },
  { id: 'newsletter', label: 'Newsletter signup' },
  { id: 'contact', label: 'Contact' },
  { id: 'social', label: 'Social links' },
]

export const DEFAULT_SECTIONS_BY_TYPE = {
  portfolio: ['hero', 'projects', 'about', 'stats', 'contact'],
  cv: ['hero', 'about', 'experience', 'stats', 'contact'],
  business: ['hero', 'services', 'about', 'testimonials', 'contact'],
  landing: ['hero', 'stats', 'services', 'pricing', 'faq', 'contact'],
  restaurant: ['hero', 'menu', 'about', 'testimonials', 'contact'],
  photography: ['hero', 'projects', 'about', 'contact'],
  blog: ['hero', 'posts', 'about', 'newsletter'],
  shop: ['hero', 'projects', 'about', 'faq', 'contact'],
  event: ['hero', 'about', 'faq', 'contact'],
  links: ['hero', 'social'],
}

export const WIZARD_MOODS = [
  { id: 'minimal', label: 'Clean & minimal', prompt: 'clean and minimal with generous white space and restrained typography' },
  { id: 'bold', label: 'Bold & colorful', prompt: 'bold and vibrant with confident colors and large headlines' },
  { id: 'elegant', label: 'Elegant editorial', prompt: 'elegant and editorial with refined details and a premium feel' },
  { id: 'dark', label: 'Dark & techy', prompt: 'a dark theme with a high-contrast accent and a modern tech feel' },
  { id: 'warm', label: 'Warm & friendly', prompt: 'warm and friendly with soft rounded corners and an approachable tone' },
  { id: 'corporate', label: 'Corporate & trusted', prompt: 'professional and corporate with a structured, trustworthy layout' },
]

export const WIZARD_FONTS = [
  { id: 'modern', label: 'Modern sans', family: 'Inter' },
  { id: 'geometric', label: 'Geometric', family: 'Space Grotesk' },
  { id: 'elegant', label: 'Elegant serif', family: 'Playfair Display' },
  { id: 'editorial', label: 'Editorial serif', family: 'Lora' },
  { id: 'mono', label: 'Tech mono', family: 'JetBrains Mono' },
  { id: 'friendly', label: 'Friendly round', family: 'Nunito' },
]

export const WIZARD_ACCENTS = [
  '#4f46e5', '#2563eb', '#0e7490', '#166534', '#e8543f',
  '#b91c1c', '#9333ea', '#eab308', '#111111',
]

const byId = (list, id) => list.find((x) => x.id === id)

// Compose the single generation prompt. Everything the user typed is quoted
// back to the model verbatim; the system prompt already forces English copy
// and the shared design system, so this only has to carry the SPECIFICS.
export function buildWizardPrompt(answers = {}) {
  const type = byId(WIZARD_SITE_TYPES, answers.type) || WIZARD_SITE_TYPES[0]
  const mood = byId(WIZARD_MOODS, answers.mood) || WIZARD_MOODS[0]
  const font = byId(WIZARD_FONTS, answers.font) || WIZARD_FONTS[0]
  const sectionIds = Array.isArray(answers.sections) && answers.sections.length
    ? answers.sections
    : DEFAULT_SECTIONS_BY_TYPE[type.id] || ['hero', 'about', 'contact']
  const sections = sectionIds
    .map((id) => byId(WIZARD_SECTIONS, id)?.label || id)
    .join(', ')

  const lines = [
    `Build a complete ${type.label.toLowerCase()} website. Follow your "${type.recipe}" page recipe and design system.`,
    `Brand / site name: ${answers.brand?.trim() || 'pick a fitting name yourself'}.`,
  ]
  if (answers.tagline?.trim()) lines.push(`Tagline / role: ${answers.tagline.trim()}.`)
  if (answers.description?.trim()) {
    lines.push(`About (base ALL copy on this, expanded into specific, concrete English content): ${answers.description.trim()}`)
  }
  if (answers.email?.trim()) lines.push(`Contact email for CTAs and the contact section: ${answers.email.trim()}.`)
  if (answers.socials?.trim()) lines.push(`Social profiles to link: ${answers.socials.trim()}.`)
  lines.push(`Visual direction: ${mood.prompt}. Accent color: ${answers.accent || WIZARD_ACCENTS[0]}. Heading font: "${font.family}" from Google Fonts (load it, pair with a matching body font).`)
  lines.push(`Sections, in this exact order: ${sections}. No other sections.`)
  lines.push('Write specific, believable copy for every section based on the details above — concrete numbers, names and offers, never lorem ipsum or generic filler.')
  if (answers.extra?.trim()) lines.push(`Extra wishes: ${answers.extra.trim()}.`)
  return lines.join('\n')
}

// Site metadata derived from the answers — applied alongside the generated
// HTML so the site is immediately publishable (title + Explore discovery).
export function wizardMeta(answers = {}) {
  const type = byId(WIZARD_SITE_TYPES, answers.type) || WIZARD_SITE_TYPES[0]
  const mood = byId(WIZARD_MOODS, answers.mood) || WIZARD_MOODS[0]
  const tags = [...new Set([type.id, mood.id, 'ai'])].slice(0, 8)
  return {
    title: answers.brand?.trim() || type.label,
    category: type.category,
    tags,
  }
}
