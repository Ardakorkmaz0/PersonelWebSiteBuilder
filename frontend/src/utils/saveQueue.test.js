import { describe, expect, it, vi } from 'vitest'
import { createSaveQueue } from './saveQueue.js'

describe('site save queue', () => {
  it('runs explicit saves in order instead of allowing stale writes to race', async () => {
    const queue = createSaveQueue()
    let releaseFirst
    const firstGate = new Promise((resolve) => { releaseFirst = resolve })
    const order = []

    const first = queue.run(async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
      return 'first'
    })
    const secondTask = vi.fn(async () => {
      order.push('second')
      return 'second'
    })
    const second = queue.run(secondTask)

    await Promise.resolve()
    expect(secondTask).not.toHaveBeenCalled()
    releaseFirst()
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second'])
    expect(order).toEqual(['first:start', 'first:end', 'second'])
    expect(queue.isBusy()).toBe(false)
  })

  it('drops an automatic save while another write is pending', async () => {
    const queue = createSaveQueue()
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const active = queue.run(() => gate)
    const backgroundTask = vi.fn()

    await expect(queue.run(backgroundTask, { dropIfBusy: true })).resolves.toBeNull()
    expect(backgroundTask).not.toHaveBeenCalled()
    release('done')
    await active
  })
})
