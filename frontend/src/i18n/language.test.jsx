import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import LanguageProvider from './LanguageProvider.jsx'
import { LANGUAGE_STORAGE_KEY, translate } from './language.js'
import { useLanguage } from './useLanguage.js'

function Probe() {
  const { t } = useLanguage()
  return <div>{t('Welcome back')}</div>
}

describe('language selection', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = ''
  })

  it('falls back to the English source and interpolates Turkish variables', () => {
    expect(translate('en', 'Unknown text')).toBe('Unknown text')
    expect(translate('tr', 'Reopen “{name}”', { name: 'demo' })).toBe('“demo” klasörünü yeniden aç')
  })

  it('switches immediately, persists the choice, and updates document language', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    const user = userEvent.setup()
    render(
      <LanguageProvider>
        <LanguageSwitcher />
        <Probe />
      </LanguageProvider>,
    )

    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'tr')

    expect(screen.getByText('Tekrar hoş geldiniz')).toBeInTheDocument()
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr')
    expect(document.documentElement.lang).toBe('tr')
    expect(screen.getByRole('combobox', { name: 'Dil' })).toHaveValue('tr')
  })
})
