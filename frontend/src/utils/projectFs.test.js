// compactTree folds single-child directory chains the way the Code-project
// explorer renders them ("compact folders"), so a deep wrapper folder never
// buries the files inside it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTree, compactTree, detectDevServer, frameworkFromPackageJson } from './projectFs.js'

const filesOf = (...paths) =>
  paths.map((p) => ({ path: p, name: p.split('/').pop(), kind: 'html' }))

describe('compactTree', () => {
  it('folds a single-child directory chain into one node, keeping the deepest path', () => {
    const tree = compactTree(buildTree(filesOf('frontend/src/index.html')))
    expect(tree.children).toHaveLength(1)
    const node = tree.children[0]
    expect(node.type).toBe('dir')
    expect(node.name).toBe('frontend/src')
    expect(node.path).toBe('frontend/src')
    expect(node.children.map((c) => c.name)).toEqual(['index.html'])
  })

  it('does NOT fold a directory that branches', () => {
    const tree = compactTree(buildTree([
      { path: 'a/style.css', name: 'style.css', kind: 'css' },
      { path: 'a/main.js', name: 'main.js', kind: 'js' },
    ]))
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].name).toBe('a')
    expect(tree.children[0].children).toHaveLength(2)
  })

  it('folds the chain up to the first branch, then recurses', () => {
    const tree = compactTree(buildTree(filesOf(
      'dist/assets/css/site.html',
      'dist/assets/js/app.html',
    )))
    // dist/assets folds (single child each step) down to the branch point.
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].name).toBe('dist/assets')
    const names = tree.children[0].children.map((c) => c.name).sort()
    expect(names).toEqual(['css', 'js'])
  })

  it('keeps root-level files at the top untouched', () => {
    const tree = compactTree(buildTree(filesOf('index.html', 'about.html')))
    expect(tree.children.map((c) => c.name).sort()).toEqual(['about.html', 'index.html'])
  })
})

describe('frameworkFromPackageJson', () => {
  const fw = (deps, scripts) => frameworkFromPackageJson({ dependencies: deps, scripts })
  it('maps Vite to :5173 / npm run dev', () => {
    expect(fw({ vite: '^5' })).toMatchObject({ label: 'Vite', url: 'http://localhost:5173', command: 'npm run dev' })
  })
  it('maps Next.js to :3000', () => {
    expect(fw({ next: '^14' }).url).toBe('http://localhost:3000')
  })
  it('maps Create React App to npm start', () => {
    expect(fw({ 'react-scripts': '5' })).toMatchObject({ label: 'Create React App', command: 'npm start' })
  })
  it('falls back to a generic Node dev server', () => {
    expect(fw({}, { dev: 'node server.js' })).toMatchObject({ label: 'Node', command: 'npm run dev' })
    expect(fw({}, { start: 'node server.js' }).command).toBe('npm start')
  })
})

describe('detectDevServer', () => {
  // Force every port probe to look free so the test is deterministic regardless
  // of what's actually running on the machine.
  afterEach(() => vi.unstubAllGlobals())
  const stubPortsFree = () => vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('refused'))))

  const fileHandle = (text) => ({ getFile: async () => ({ text: async () => text }) })
  const dir = (files) => ({
    name: '',
    kind: 'directory',
    async *values() {},
    async getFileHandle(name) {
      if (name in files) return fileHandle(files[name])
      throw new Error('not found')
    },
  })
  const root = (children) => ({
    async *values() { for (const [name, h] of Object.entries(children)) yield { ...h, name, kind: 'directory' } },
    async getFileHandle() { throw new Error('not found') },
  })

  it('detects Django (127.0.0.1:8000) + Vite from subfolders, frontend first', async () => {
    stubPortsFree()
    const handle = root({
      backend: dir({ 'manage.py': '' }),
      frontend: dir({ 'package.json': JSON.stringify({ devDependencies: { vite: '^5' } }) }),
    })
    const cands = await detectDevServer(handle)
    expect(cands.map((c) => c.label)).toEqual(['Vite', 'Django'])
    const django = cands.find((c) => c.label === 'Django')
    expect(django).toMatchObject({ url: 'http://127.0.0.1:8000', command: 'python manage.py runserver', cwd: 'backend' })
    expect(cands.every((c) => c.busy === false)).toBe(true) // nothing running → no port collision
  })

  it('returns [] for a static folder with no server markers', async () => {
    stubPortsFree()
    expect(await detectDevServer(root({}))).toEqual([])
  })
})
