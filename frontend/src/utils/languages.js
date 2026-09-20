// The languages a published page can declare, by their own names — a language
// picker that says "Deutsch" rather than "German" is the one people find.
//
// The list drives the editor's picker only. A stored value is validated by
// SHAPE (see normalizeLanguageTag), so a site saved with a tag that is not on
// this list still round-trips instead of silently snapping back to English.

export const RTL_LANGUAGES = new Set(['ar', 'arc', 'dv', 'fa', 'he', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi'])

// Sorted by the name shown in the picker.
export const LANGUAGES = [
  ['af', 'Afrikaans'],
  ['sq', 'Shqip'],
  ['am', 'አማርኛ'],
  ['ar', 'العربية'],
  ['hy', 'Հայերեն'],
  ['az', 'Azərbaycanca'],
  ['eu', 'Euskara'],
  ['be', 'Беларуская'],
  ['bn', 'বাংলা'],
  ['bs', 'Bosanski'],
  ['bg', 'Български'],
  ['ca', 'Català'],
  ['zh', '中文（简体）'],
  ['zh-TW', '中文（繁體）'],
  ['hr', 'Hrvatski'],
  ['cs', 'Čeština'],
  ['da', 'Dansk'],
  ['nl', 'Nederlands'],
  ['en', 'English'],
  ['et', 'Eesti'],
  ['fil', 'Filipino'],
  ['fi', 'Suomi'],
  ['fr', 'Français'],
  ['gl', 'Galego'],
  ['ka', 'ქართული'],
  ['de', 'Deutsch'],
  ['el', 'Ελληνικά'],
  ['he', 'עברית'],
  ['hi', 'हिन्दी'],
  ['hu', 'Magyar'],
  ['is', 'Íslenska'],
  ['id', 'Bahasa Indonesia'],
  ['ga', 'Gaeilge'],
  ['it', 'Italiano'],
  ['ja', '日本語'],
  ['kk', 'Қазақша'],
  ['km', 'ភាសាខ្មែរ'],
  ['ko', '한국어'],
  ['ky', 'Кыргызча'],
  ['lv', 'Latviešu'],
  ['lt', 'Lietuvių'],
  ['mk', 'Македонски'],
  ['ms', 'Bahasa Melayu'],
  ['ml', 'മലയാളം'],
  ['mn', 'Монгол'],
  ['ne', 'नेपाली'],
  ['no', 'Norsk'],
  ['fa', 'فارسی'],
  ['pl', 'Polski'],
  ['pt', 'Português'],
  ['pt-BR', 'Português (Brasil)'],
  ['pa', 'ਪੰਜਾਬੀ'],
  ['ro', 'Română'],
  ['ru', 'Русский'],
  ['sr', 'Српски'],
  ['si', 'සිංහල'],
  ['sk', 'Slovenčina'],
  ['sl', 'Slovenščina'],
  ['es', 'Español'],
  ['es-419', 'Español (Latinoamérica)'],
  ['sw', 'Kiswahili'],
  ['sv', 'Svenska'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['th', 'ไทย'],
  ['tr', 'Türkçe'],
  ['uk', 'Українська'],
  ['ur', 'اردو'],
  ['uz', 'Oʻzbekcha'],
  ['vi', 'Tiếng Việt'],
  ['cy', 'Cymraeg'],
]

// A BCP 47 tag we are willing to put in lang="": a primary subtag plus optional
// script/region/numeric subtags. Anything else falls back to English rather
// than reaching the document.
const TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/

export function normalizeLanguageTag(value, fallback = 'en') {
  const tag = String(value ?? '').trim()
  return TAG.test(tag) ? tag : fallback
}

export function isRtlLanguage(value) {
  return RTL_LANGUAGES.has(normalizeLanguageTag(value).split('-')[0].toLowerCase())
}
