// Serializes site writes so an older auto-save can never finish after and
// overwrite a newer manual save. Background saves are disposable while a
// write is already active; explicit user saves wait their turn.
export function createSaveQueue() {
  let tail = Promise.resolve()
  let pending = 0

  return {
    isBusy: () => pending > 0,
    run(task, { dropIfBusy = false } = {}) {
      if (dropIfBusy && pending > 0) return Promise.resolve(null)
      pending += 1
      const execution = tail.catch(() => undefined).then(task)
      tail = execution
      return execution.finally(() => {
        pending = Math.max(0, pending - 1)
      })
    },
  }
}
