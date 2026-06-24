import { describe, expect, it } from 'vitest'
import { passwordStrength } from './passwordStrength.js'

describe('passwordStrength', () => {
  it('is empty for no input', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0, label: '' })
  })

  it('caps short passwords at weak', () => {
    expect(passwordStrength('aB3$').score).toBeLessThanOrEqual(1)
  })

  it('rises with length + variety', () => {
    const weak = passwordStrength('aaaaaaaa').score
    const strong = passwordStrength('Tr0ub4dour-x9!').score
    expect(strong).toBeGreaterThan(weak)
    expect(passwordStrength('Tr0ub4dour-x9!').label).toBe('Strong')
  })
})
