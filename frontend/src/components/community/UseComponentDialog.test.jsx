// Taking a block is the one action in the library with a consequence: it
// changes somebody's site. So the dialog has to ask WHICH site, send exactly
// what was picked, and then put the person in front of the result.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import UseComponentDialog from './UseComponentDialog.jsx'
import { takeComponent } from '../../api/community.js'
import { listSites, getSite } from '../../api/sites.js'

vi.mock('../../api/community.js', () => ({ takeComponent: vi.fn() }))
vi.mock('../../api/sites.js', () => ({ listSites: vi.fn(), getSite: vi.fn() }))

const COMPONENT = { id: 3, title: 'Pricing card', html: '<div>Pro</div>', css: '' }

// Where the router actually ended up — a spy on useNavigate would only prove
// the call was made, not that it goes anywhere real.
function Location() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

function renderDialog(props = {}) {
  localStorage.setItem('pwb_language', 'en')
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/community']}>
        <Location />
        <Routes>
          <Route
            path="*"
            element={<UseComponentDialog component={COMPONENT} onClose={vi.fn()} {...props} />}
          />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listSites.mockResolvedValue([
    { id: 11, title: 'Portfolio' },
    { id: 22, title: 'Bakery' },
  ])
  getSite.mockResolvedValue({ id: 11, schema: { pages: [{ id: 'home', name: 'Home' }] } })
  takeComponent.mockResolvedValue({ site_id: 11, page_id: 'home', block_id: 'c9' })
})

describe('choosing where the block lands', () => {
  it('lists the sites you own and starts on the first one', async () => {
    renderDialog()
    const picker = await screen.findByRole('combobox', { name: 'Site' })
    expect([...picker.options].map((option) => option.textContent)).toEqual(['Portfolio', 'Bakery'])
    expect(picker.value).toBe('11')
  })

  it('hides the page picker for a one-page site, and shows it otherwise', async () => {
    const { unmount } = renderDialog()
    await screen.findByRole('combobox', { name: 'Site' })
    // One page is not a choice — asking would be noise.
    expect(screen.queryByRole('combobox', { name: 'Page' })).toBeNull()
    unmount()

    getSite.mockResolvedValue({
      id: 11,
      schema: { pages: [{ id: 'home', name: 'Home' }, { id: 'about', name: 'About' }] },
    })
    renderDialog()
    expect(await screen.findByRole('combobox', { name: 'Page' })).toBeInTheDocument()
  })

  it('re-reads the pages when a different site is picked', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('combobox', { name: 'Site' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Site' }), '22')

    await waitFor(() => expect(getSite).toHaveBeenLastCalledWith('22'))
  })
})

describe('adding it', () => {
  it('sends the chosen site and page, then goes to that editor', async () => {
    const user = userEvent.setup()
    const onUsed = vi.fn()
    renderDialog({ onUsed })
    await screen.findByRole('combobox', { name: 'Site' })

    await user.click(screen.getByRole('button', { name: 'Add to my site' }))

    expect(takeComponent).toHaveBeenCalledWith(3, { siteId: 11, pageId: 'home' })
    // A number, not the string the <select> hands back — the API expects an id.
    expect(typeof takeComponent.mock.calls[0][1].siteId).toBe('number')
    expect(onUsed).toHaveBeenCalledWith({ site_id: 11, page_id: 'home', block_id: 'c9' })
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/editor/11'))
  })

  it('stays put and says why when the server refuses', async () => {
    const user = userEvent.setup()
    takeComponent.mockRejectedValue({ response: { data: { detail: 'Site not found.' } } })
    renderDialog()
    await screen.findByRole('combobox', { name: 'Site' })

    await user.click(screen.getByRole('button', { name: 'Add to my site' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Site not found.')
    expect(screen.getByTestId('path')).toHaveTextContent('/community')
  })
})

describe('when there is nowhere to put it', () => {
  it('says to make a site first, and cannot be submitted', async () => {
    listSites.mockResolvedValue([])
    renderDialog()

    expect(await screen.findByText('You have no sites yet — create one first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to my site' })).toBeDisabled()
  })
})
