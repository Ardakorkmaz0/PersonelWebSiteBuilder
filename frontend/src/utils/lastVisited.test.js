// "Back" from the editor has to LEAVE the editor.
//
// It used to be one history step, and one step back from the editor is very
// often another editor: open a site from the dashboard, come back, open the
// next one — now the entry behind you is the first site's editor, and the
// button that says "leave" drops you into a different design instead. Moving
// between pages of a design is what the page list is for.
import { beforeEach, describe, expect, it } from 'vitest'
import { isWorkspacePath, lastPageOutside, rememberVisit, resetVisits } from './lastVisited.js'

beforeEach(() => {
  resetVisits()
})

describe('isWorkspacePath', () => {
  it('knows the full-screen workspaces', () => {
    expect(isWorkspacePath('/editor/57')).toBe(true)
    expect(isWorkspacePath('/editor')).toBe(true)
    expect(isWorkspacePath('/code')).toBe(true)
    expect(isWorkspacePath('/code/project-a')).toBe(true)
  })

  it('treats ordinary pages as pages', () => {
    expect(isWorkspacePath('/')).toBe(false)
    expect(isWorkspacePath('/profile')).toBe(false)
    expect(isWorkspacePath('/favorites')).toBe(false)
    expect(isWorkspacePath('/u/12')).toBe(false)
    // Not a prefix match on the word — a public site called "editorial" is a page.
    expect(isWorkspacePath('/editorial')).toBe(false)
  })

  it('survives nonsense', () => {
    expect(isWorkspacePath('')).toBe(false)
    expect(isWorkspacePath(null)).toBe(false)
    expect(isWorkspacePath(undefined)).toBe(false)
  })
})

describe('lastPageOutside', () => {
  it('returns the page the user was actually on', () => {
    rememberVisit('/favorites')
    rememberVisit('/editor/57')
    expect(lastPageOutside('/profile')).toBe('/favorites')
  })

  it('keeps pointing at the dashboard through a whole trip of editors', () => {
    // The case that broke it: three sites opened one after another.
    rememberVisit('/')
    rememberVisit('/editor/1')
    rememberVisit('/editor/2')
    rememberVisit('/editor/3')
    expect(lastPageOutside('/profile')).toBe('/')
  })

  it('follows the user when they move to another page', () => {
    rememberVisit('/')
    rememberVisit('/editor/1')
    rememberVisit('/profile')
    rememberVisit('/editor/2')
    expect(lastPageOutside('/')).toBe('/profile')
  })

  it('falls back when the editor was the first thing opened', () => {
    // A shared link straight into the editor: there is nowhere to go back to.
    rememberVisit('/editor/57')
    expect(lastPageOutside('/profile')).toBe('/profile')
  })

  it('ignores empty visits rather than forgetting where it was', () => {
    rememberVisit('/favorites')
    rememberVisit('')
    rememberVisit(null)
    expect(lastPageOutside('/')).toBe('/favorites')
  })
})
