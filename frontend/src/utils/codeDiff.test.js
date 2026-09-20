import { describe, expect, it } from 'vitest'
import { changedCodeLines, changedLines } from './codeDiff.js'

const doc = (...lines) => lines.join('\n')

describe('changedLines', () => {
  it('finds nothing in an unchanged document', () => {
    expect(changedLines(doc('<html>', '<body>', '</html>'), doc('<html>', '<body>', '</html>'))).toBeNull()
    expect(changedLines('', '')).toBeNull()
  })

  it('reports the rewritten line with its real line number', () => {
    const before = doc('<!doctype html>', '<html lang="en">', '<head>', '</head>')
    const after = doc('<!doctype html>', '<html lang="tr">', '<head>', '</head>')

    expect(changedLines(before, after)).toEqual({
      lines: [{ number: 2, text: '<html lang="tr">', removed: false }],
      hiddenCount: 0,
      addedCount: 1,
      removedCount: 1,
    })
  })

  it('shows inserted lines and keeps the untouched tail out of the diff', () => {
    const before = doc('<head>', '</head>')
    const after = doc('<head>', '<meta name="robots" content="noindex">', '</head>')
    const change = changedLines(before, after)

    expect(change.lines).toEqual([{ number: 2, text: '<meta name="robots" content="noindex">', removed: false }])
    expect(change.removedCount).toBe(0)
  })

  it('marks a pure deletion as removed lines', () => {
    const change = changedLines(doc('a', 'b', 'c'), doc('a', 'c'))

    expect(change.lines).toEqual([{ number: 2, text: 'b', removed: true }])
    expect(change.addedCount).toBe(0)
    expect(change.removedCount).toBe(1)
  })

  it('caps how many lines it hands back and counts the rest', () => {
    const before = doc('start', 'end')
    const after = doc('start', '1', '2', '3', '4', '5', '6', '7', 'end')
    const change = changedLines(before, after, 3)

    expect(change.lines.map((line) => line.text)).toEqual(['1', '2', '3'])
    expect(change.lines.map((line) => line.number)).toEqual([2, 3, 4])
    expect(change.hiddenCount).toBe(4)
  })

  it('treats a repeated line at both ends without swallowing the change', () => {
    const change = changedLines(doc('x', 'x', 'x'), doc('x', 'y', 'x'))

    expect(change.lines).toEqual([{ number: 2, text: 'y', removed: false }])
  })
})

describe('changedCodeLines', () => {
  it('splits a one-line body into tags but keeps the file line number', () => {
    const before = '<html>\n<body><h1>Hi</h1><p>Old</p></body>\n</html>'
    const after = '<html>\n<body><h1>Hi</h1><p>New</p></body>\n</html>'
    const change = changedCodeLines(before, after)

    expect(change.lines).toEqual([{ number: 2, text: '<p>New</p>', removed: false }])
  })

  it('numbers a change from a later line correctly', () => {
    const before = 'a\nb\n<head><title>One</title></head>'
    const after = 'a\nb\n<head><title>Two</title></head>'

    expect(changedCodeLines(before, after).lines[0]).toEqual({ number: 3, text: '<title>Two</title>', removed: false })
  })
})
