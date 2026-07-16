// Serializes site writes so an older save can never finish after and
// overwrite a newer one. No write is discarded: an automatic save that fires
// while a manual save is in flight must run afterwards, otherwise the editor
// can stay dirty forever without scheduling another retry.
export function createSaveQueue() {
  let tail = Promise.resolve()
  let pending = 0

  return {
    isBusy: () => pending > 0,
    run(task) {
      pending += 1
      const execution = tail.catch(() => undefined).then(task)
      tail = execution
      return execution.finally(() => {
        pending = Math.max(0, pending - 1)
      })
    },
  }
}
