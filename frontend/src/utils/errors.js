import { detectInitialLanguage, translate } from '../i18n/language.js'

const API_CODE_MESSAGES = {
  authentication_failed: 'Invalid username or password.',
  not_authenticated: 'Please sign in to continue.',
  permission_denied: 'You do not have permission to do that.',
  not_found: 'The requested item was not found.',
  method_not_allowed: 'This action is not supported.',
  throttled: 'Too many requests. Please wait and try again.',
  google_credential_missing: 'Google sign-in information is missing.',
  google_token_invalid: 'Google sign-in could not be verified.',
  google_email_missing: 'Your Google account does not provide an email address.',
  email_required: 'Email is required.',
  version_not_found: 'This saved version could not be found.',
  local_ai_invalid_url: 'The local AI address is invalid or blocked for security.',
  user_not_found: 'User not found.',
  site_not_found: 'Site not found.',
  own_site_report_forbidden: 'You cannot report your own site.',
  invalid_report_action: 'The selected report action is invalid.',
  report_not_found: 'Report not found.',
  self_suspend_forbidden: 'You cannot suspend your own account.',
  admin_suspend_forbidden: 'Another administrator cannot be suspended.',
  invalid_site_action: 'The selected site action is invalid.',
  api_error: 'The server could not complete the request.',
}

const VALIDATION_CODE_MESSAGES = {
  required: 'This field is required.',
  blank: 'This field cannot be blank.',
  invalid: 'Please enter a valid value.',
  unique: 'This value is already in use.',
  min_length: 'This value is too short.',
  max_length: 'This value is too long.',
  password_too_common: 'This password is too common.',
  password_entirely_numeric: 'This password cannot contain only numbers.',
  password_too_short: 'This password is too short.',
  password_too_similar: 'This password is too similar to your personal information.',
}

function firstLeaf(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const leaf = firstLeaf(item)
      if (leaf) return leaf
    }
    return ''
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const leaf = firstLeaf(item)
      if (leaf) return leaf
    }
    return ''
  }
  return typeof value === 'string' ? value : ''
}

function translatedIfKnown(language, message) {
  if (!message) return ''
  const localized = translate(language, message)
  return language === 'tr' && localized === message ? '' : localized
}

// Pull a localized, human-readable message out of a structured DRF response.
export function apiError(err, fallback = 'Something went wrong.') {
  const language = detectInitialLanguage()
  const data = err?.response?.data
  if (!data) {
    if (err?.code === 'ERR_NETWORK') return translate(language, 'Network error. Check your connection.')
    return translatedIfKnown(language, err?.message) || err?.message || translate(language, fallback)
  }
  if (typeof data === 'string') return translatedIfKnown(language, data) || data

  const codeMessage = API_CODE_MESSAGES[data.code]
  if (codeMessage) return translate(language, codeMessage)

  const detail = firstLeaf(data.detail)
  const localizedDetail = translatedIfKnown(language, detail)
  if (localizedDetail) return localizedDetail

  if (data.code === 'validation_error') {
    const validationCode = firstLeaf(data.error_codes)
    const validationMessage = VALIDATION_CODE_MESSAGES[validationCode]
    if (validationMessage) return translate(language, validationMessage)
  }

  const fieldMessage = firstLeaf(Object.fromEntries(
    Object.entries(data).filter(([key]) => !['code', 'detail', 'error_codes'].includes(key)),
  ))
  return translatedIfKnown(language, fieldMessage) || fieldMessage || detail || translate(language, fallback)
}
