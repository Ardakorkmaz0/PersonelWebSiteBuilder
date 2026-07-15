import { beforeEach, describe, expect, it, vi } from 'vitest'

const fsMocks = vi.hoisted(() => ({
  writeFileToHandle: vi.fn(),
}))

vi.mock('../utils/projectFs.js', () => ({
  buildTree: vi.fn(() => ({ children: [] })),
  compactTree: vi.fn((tree) => tree),
  copyProjectTo: vi.fn(),
  rememberProjectRoot: vi.fn(),
  clearProjectRoot: vi.fn(),
  writeFileToHandle: fsMocks.writeFileToHandle,
}))

import { useProjectStore } from './projectStore.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function openProject(files) {
  useProjectStore.getState().setProject({
    rootHandle: { name: 'demo' },
    files: files.map(({ path, content }) => ({
      path,
      name: path.split('/').at(-1),
      kind: 'html',
      content,
      handle: { path },
    })),
  })
}

describe('project save revisions', () => {
  beforeEach(() => {
    fsMocks.writeFileToHandle.mockReset()
    useProjectStore.setState({
      rootHandle: null,
      rootName: '',
      files: new Map(),
      tree: null,
      dirty: new Set(),
      activePath: null,
      saving: false,
      error: '',
    })
  })

  it('keeps edits made while saveFile is in flight dirty', async () => {
    const write = deferred()
    fsMocks.writeFileToHandle.mockReturnValueOnce(write.promise)
    openProject([{ path: 'index.html', content: 'initial' }])
    useProjectStore.getState().updateFile('index.html', 'sent')

    const saving = useProjectStore.getState().saveFile('index.html')
    expect(fsMocks.writeFileToHandle).toHaveBeenCalledWith({ path: 'index.html' }, 'sent')
    useProjectStore.getState().updateFile('index.html', 'typed later')
    write.resolve()
    await saving

    const state = useProjectStore.getState()
    expect(state.files.get('index.html')).toMatchObject({
      content: 'typed later',
      original: 'sent',
    })
    expect(state.dirty.has('index.html')).toBe(true)
  })

  it('acknowledges each saveAll snapshot without overwriting newer text', async () => {
    const first = deferred()
    const second = deferred()
    fsMocks.writeFileToHandle
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    openProject([
      { path: 'a.html', content: 'a0' },
      { path: 'b.html', content: 'b0' },
    ])
    useProjectStore.getState().updateFile('a.html', 'a1')
    useProjectStore.getState().updateFile('b.html', 'b1')

    const saving = useProjectStore.getState().saveAll()
    useProjectStore.getState().updateFile('a.html', 'a2')
    useProjectStore.getState().updateFile('b.html', 'b2')
    first.resolve()
    await vi.waitFor(() => expect(fsMocks.writeFileToHandle).toHaveBeenCalledTimes(2))
    second.resolve()
    await saving

    const state = useProjectStore.getState()
    expect(state.files.get('a.html')).toMatchObject({ content: 'a2', original: 'a1' })
    expect(state.files.get('b.html')).toMatchObject({ content: 'b2', original: 'b1' })
    expect([...state.dirty].sort()).toEqual(['a.html', 'b.html'])
  })

  it('keeps successful earlier writes accurate when a later write fails', async () => {
    fsMocks.writeFileToHandle
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk full'))
    openProject([
      { path: 'a.html', content: 'a0' },
      { path: 'b.html', content: 'b0' },
    ])
    useProjectStore.getState().updateFile('a.html', 'a1')
    useProjectStore.getState().updateFile('b.html', 'b1')

    await useProjectStore.getState().saveAll()

    const state = useProjectStore.getState()
    expect(state.dirty.has('a.html')).toBe(false)
    expect(state.dirty.has('b.html')).toBe(true)
    expect(state.error).toBe('disk full')
  })
})
