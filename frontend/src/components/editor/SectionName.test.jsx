// The "Section name" field and the React renderer's half of section names.
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import { Renderer } from '../renderer/Renderer.jsx'
import { selectCurrentPage, useEditorStore } from '../../store/editorStore.js'
import PropertiesPanel from './PropertiesPanel.jsx'

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  localStorage.setItem('pwb_language', 'en')
})

const band = (id, y, anchor, text) => ({
  id,
  type: 'region',
  props: anchor ? { anchor } : {},
  styles: {},
  layout: { x: 0, y, w: 1000, h: 300 },
  children: [{ id: `${id}_h`, type: 'heading', props: { text }, styles: {}, layout: { x: 20, y: 20, w: 400, h: 60 } }],
})

describe('the React renderer (View mode, the plain published page)', () => {
  it('gives top-level and nested blocks their section name as id', () => {
    const components = [band('region_1', 0, 'about', 'About us')]
    components[0].children[0].props.anchor = 'about-title'
    const { container } = render(<Renderer components={components} width={1000} />)
    expect(container.querySelector('#about')).not.toBeNull()
    expect(container.querySelector('#about-title')).not.toBeNull()
    expect(container.querySelector('#region_1')).toBeNull()
  })
})

describe('Section name field', () => {
  function openPanelFor(id) {
    useEditorStore.getState().loadSchema({
      theme: {},
      pages: [{
        id: 'home',
        name: 'Home',
        components: [
          { id: 'nav', type: 'navbar', props: { brand: 'X', links: [{ label: 'About', href: '#region_1' }] }, styles: {}, layout: { x: 0, y: 0, w: 1000, h: 64 } },
          band('region_1', 100, '', 'Hakkımızda'),
          band('region_2', 400, 'team', 'Our team'),
        ],
      }],
    })
    useEditorStore.getState().selectComponent(id)
    return render(<LanguageProvider><PropertiesPanel /></LanguageProvider>)
  }
  const nav = () => selectCurrentPage(useEditorStore.getState()).components[0]
  const field = () => screen.getByPlaceholderText(/hakkimizda|e\.g\. about/)

  it('suggests a name from the block content and applies it in one click', () => {
    openPanelFor('region_1')
    fireEvent.click(screen.getByRole('button', { name: 'Use #hakkimizda' }))
    expect(nav().props.links[0].href).toBe('#hakkimizda')
    expect(screen.getByText(/Links reach this block as #hakkimizda/)).toBeInTheDocument()
  })

  it('shows the slug it will save as, and commits on Enter', () => {
    openPanelFor('region_1')
    fireEvent.change(field(), { target: { value: 'Biz Kimiz' } })
    expect(screen.getByText('Saved as #biz-kimiz')).toBeInTheDocument()
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(nav().props.links[0].href).toBe('#biz-kimiz')
  })

  it('says why a name is refused and leaves the block alone', () => {
    openPanelFor('region_1')
    fireEvent.change(field(), { target: { value: 'team' } })
    fireEvent.blur(field())
    expect(screen.getByText('Another block on this page is already called "#team".')).toBeInTheDocument()
    expect(nav().props.links[0].href).toBe('#region_1')
  })
})
