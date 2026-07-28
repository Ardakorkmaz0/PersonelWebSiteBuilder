import { describe, expect, it } from 'vitest'
import { phoneModel } from './phoneFrameMetrics.js'

describe('real phone frame profiles', () => {
  it('keeps the default 390px artboard vendor-neutral', () => {
    expect(phoneModel(390, 0).id).toBe('generic')
    expect(phoneModel(390, 0).name).toBe('Standard mobile')
  })

  it.each([
    [390, 'iphone-notch', 'iPhone 14'],
    [375, 'iphone-classic', 'iPhone SE'],
    [393, 'iphone-island', 'iPhone 15 Pro'],
    [360, 'galaxy-s24', 'Galaxy S24'],
    [384, 'galaxy-s24-ultra', 'Galaxy S24 Ultra'],
    [412, 'pixel-7', 'Pixel 7'],
  ])('maps %ipx to its actual device body', (width, id, name) => {
    const model = phoneModel(width)
    expect(model.id).toBe(id)
    expect(model.name).toContain(name)
  })
})
