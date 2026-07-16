import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import UiThemeProvider, { readUiThemePreference, useUiTheme } from './UiThemeProvider.jsx'

describe('UiThemeProvider', () => {
  beforeEach(() => localStorage.clear())

  it('starts in Studio dark mode when no preference exists', () => {
    expect(readUiThemePreference()).toBe('dark')
  })

  it('persists an explicit light preference', () => {
    const { result } = renderHook(() => useUiTheme(), { wrapper: UiThemeProvider })

    act(() => result.current.setPreference('light'))

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.uiTheme).toBe('light')
    expect(localStorage.getItem('pwb_ui_theme')).toBe('light')
  })
})
