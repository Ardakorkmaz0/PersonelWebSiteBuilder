// The ⓘ beside the search answers "what is this place?" — three ways in, each
// with the details that decide whether it is the one for you. The local-project
// caveat is part of the answer, not a footnote: it is early, and it only runs
// in a Chromium browser.
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UiThemeProvider from '../../ui/UiThemeProvider.jsx'
import AppInfo from './AppInfo.jsx'
import { APP_FEATURES } from '../../utils/appFeatures.js'

function renderInfo() {
  return render(
    <UiThemeProvider>
      <LanguageProvider>
        <AppInfo />
      </LanguageProvider>
    </UiThemeProvider>,
  )
}

const trigger = () => screen.getByRole('button', { name: 'What you can build here' })

describe('AppInfo', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('pwb_language', 'en')
  })

  it('says nothing until it is asked', () => {
    renderInfo()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens with the three ways in, each with its own points', () => {
    renderInfo()
    fireEvent.click(trigger())

    const panel = screen.getByRole('dialog', { name: 'What you can build here' })
    expect(panel).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    for (const feature of APP_FEATURES) {
      expect(screen.getByText(feature.title)).toBeInTheDocument()
      expect(screen.getByText(feature.summary)).toBeInTheDocument()
      for (const point of feature.points) expect(screen.getByText(point)).toBeInTheDocument()
    }
  })

  it('warns that the local project is early and needs a Chromium browser', () => {
    renderInfo()
    fireEvent.click(trigger())

    const caveat = screen.getByText(/Early version/)
    expect(caveat).toHaveTextContent('not recommended')
    expect(caveat).toHaveTextContent('Chromium')
    expect(caveat).toHaveTextContent(/Chrome or Edge/)
    // Only the local project carries one.
    expect(document.querySelectorAll('.app-info-caveat')).toHaveLength(1)
  })

  it('staggers the cards so the list arrives in order', () => {
    renderInfo()
    fireEvent.click(trigger())

    const delays = [...document.querySelectorAll('.app-info-card')]
      .map((card) => card.style.getPropertyValue('--app-info-delay'))
    expect(delays).toEqual(['0ms', '90ms', '180ms'])
    // Points come in after the card they belong to.
    const firstPoint = document.querySelector('.app-info-points li')
    expect(Number.parseInt(firstPoint.style.getPropertyValue('--app-info-delay'), 10)).toBeGreaterThan(0)
  })

  it.each([
    ['the ×', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['a click outside', () => fireEvent.pointerDown(document.body)],
    ['the button again', () => fireEvent.click(trigger())],
  ])('closes from %s', (_label, leave) => {
    renderInfo()
    fireEvent.click(trigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    leave()

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
