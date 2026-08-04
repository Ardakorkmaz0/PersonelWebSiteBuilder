// The dialog's job is honesty before the fact. The author is about to put this
// on strangers' pages, so a refusal has to be shown as a refusal, a caveat as a
// caveat, and neither may be discovered afterwards.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageProvider from '../../i18n/LanguageProvider.jsx'
import ShareComponentDialog from './ShareComponentDialog.jsx'
import { shareComponent } from '../../api/community.js'

vi.mock('../../api/community.js', () => ({ shareComponent: vi.fn() }))

function mount(html, css = '.card { padding: 24px; }') {
  document.head.innerHTML = `<style>${css}</style>`
  document.body.innerHTML = `<div id="root">${html}</div>`
  return document.getElementById('root').firstElementChild
}

function renderDialog(element, props = {}) {
  localStorage.setItem('pwb_language', 'en')
  return render(
    <LanguageProvider>
      <ShareComponentDialog open element={element} onClose={vi.fn()} {...props} />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  shareComponent.mockResolvedValue({ id: 7, title: 'Pricing card' })
})

describe('a block that can be shared', () => {
  it('previews what the person taking it will get, not the page it came from', () => {
    renderDialog(mount('<div class="card">Pro</div>'))
    const frame = screen.getByTitle('What others will get')
    // The artefact, with its styles — the only preview worth showing.
    expect(frame.getAttribute('srcdoc')).toContain('Pro')
    expect(frame.getAttribute('srcdoc')).toContain('padding: 24px')
    // Rendered without scripts, like the community grid will render it.
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts')
  })

  it('will not publish without a name', async () => {
    renderDialog(mount('<div class="card">Pro</div>'))
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
  })

  it('sends the artefact, not the live element', async () => {
    const user = userEvent.setup()
    renderDialog(mount('<div class="card">Pro</div>'), { sourceSiteId: 42 })

    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Pricing card')
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(shareComponent).toHaveBeenCalledTimes(1)
    const payload = shareComponent.mock.calls[0][0]
    expect(payload.title).toBe('Pricing card')
    expect(payload.html).toContain('Pro')
    expect(payload.css).toContain('padding: 24px')
    expect(payload.source_site_id).toBe(42)
  })

  it('tells the author what could not travel', () => {
    // A local file reference is not a policy problem — nothing malicious about
    // it — but it cannot follow the block to somebody else's site. That is a
    // caveat, and it has to be said before publishing rather than discovered
    // by whoever takes the block and sees a broken image.
    renderDialog(mount('<div class="card"><img src="file:///photos/a.jpg" /></div>'))
    expect(screen.getByText(/could not travel/i)).toBeInTheDocument()
    // Still shareable — the rest of the block is fine.
    expect(screen.getByTitle('What others will get')).toBeInTheDocument()
  })
})

describe('a block that cannot', () => {
  it('refuses a script and says why, in the author’s words', () => {
    renderDialog(mount('<div class="card"><script>steal()</script></div>'))

    expect(screen.getByText('This block cannot be shared as it is.')).toBeInTheDocument()
    expect(screen.getByText(/Scripts cannot be shared/)).toBeInTheDocument()
    expect(screen.queryByTitle('What others will get')).toBeNull()
  })

  it('refuses an off-site form — the shape the sandbox does nothing about', () => {
    renderDialog(mount('<div class="card"><form action="https://evil.example"><input name="p"></form></div>'))
    expect(screen.getByText(/posts to another address/i)).toBeInTheDocument()
  })

  it('cannot be published even with a name filled in', async () => {
    const user = userEvent.setup()
    renderDialog(mount('<div class="card"><script>steal()</script></div>'))

    const name = screen.queryByRole('textbox', { name: /Name/i })
    if (name) await user.type(name, 'Sneaky')
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
    expect(shareComponent).not.toHaveBeenCalled()
  })
})

describe('when the server refuses too', () => {
  it('shows every reason it gave, not just the first', async () => {
    const user = userEvent.setup()
    shareComponent.mockRejectedValue({
      response: { data: { code: 'component_refused', detail: 'no', problems: ['First reason.', 'Second reason.'] } },
    })
    renderDialog(mount('<div class="card">Pro</div>'))

    await user.type(screen.getByRole('textbox', { name: /Name/i }), 'Card')
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByText('First reason.')).toBeInTheDocument()
    expect(screen.getByText('Second reason.')).toBeInTheDocument()
  })
})
