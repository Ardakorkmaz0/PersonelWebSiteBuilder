import { beforeEach, describe, expect, it } from 'vitest'
import { apiError } from './errors.js'

describe('apiError', () => {
  beforeEach(() => localStorage.setItem('pwb_language', 'tr'))

  it('localizes stable backend error codes', () => {
    expect(apiError({ response: { data: { code: 'site_not_found', detail: 'Site not found.' } } }))
      .toBe('Site bulunamadı.')
  })

  it('localizes DRF validation codes without relying on English details', () => {
    expect(apiError({ response: { data: {
      code: 'validation_error',
      username: ['This field is required.'],
      error_codes: { username: ['required'] },
    } } })).toBe('Bu alan zorunludur.')
  })

  it('keeps English messages when English is selected', () => {
    localStorage.setItem('pwb_language', 'en')
    expect(apiError({ response: { data: { code: 'permission_denied', detail: 'Forbidden' } } }))
      .toBe('You do not have permission to do that.')
  })
})
