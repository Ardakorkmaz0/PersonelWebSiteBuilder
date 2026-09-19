// LabeledPx used to read only the leading number and write every edit back as
// px — so -0.02em (the letter-spacing every heading ships with) became 0.98px
// on one click, 1.5rem became 2.5px and "10px 24px" lost its second value.
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { LabeledPx } from './controls.jsx'
import { registry } from '../registry.jsx'

function field(value) {
  const onChange = vi.fn()
  const view = render(
    <LanguageProvider><LabeledPx label="Size" value={value} onChange={onChange} /></LanguageProvider>,
  )
  return { onChange, input: view.container.querySelector('input'), view }
}

describe('LabeledPx keeps the unit it was given', () => {
  it.each([
    ['-0.02em', '-0.02', 'em', '0.1', '0.1em'],
    ['1.5rem', '1.5', 'rem', '2', '2rem'],
    ['50%', '50', '%', '40', '40%'],
    ['16px', '16', 'px', '18', '18px'],
    ['12', '12', 'px', '14', '14px'],
    ['', '', 'px', '8', '8px'],
  ])('%s', (stored, shown, unit, typed, written) => {
    const { onChange, input, view } = field(stored)
    expect(input.value).toBe(shown)
    expect(view.container.textContent).toContain(unit)
    fireEvent.change(input, { target: { value: typed } })
    expect(onChange).toHaveBeenLastCalledWith(written)
  })

  it('clears to an empty value, not to "px"', () => {
    const { onChange, input } = field('10px')
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it.each(['10px 24px', 'clamp(1rem, 2vw, 2rem)', 'calc(100% - 8px)'])(
    'edits %s as text instead of truncating it',
    (stored) => {
      const { onChange, input } = field(stored)
      expect(input.type).toBe('text')
      expect(input.value).toBe(stored)
      fireEvent.change(input, { target: { value: `${stored} ` } })
      expect(onChange).toHaveBeenLastCalledWith(`${stored} `)
    },
  )

  it('shows the heading default letter-spacing with its real unit', () => {
    const { input, view } = field(registry.heading.defaultStyles.letterSpacing)
    expect(input.value).toBe('-0.02')
    expect(view.container.textContent).toContain('em')
  })
})
