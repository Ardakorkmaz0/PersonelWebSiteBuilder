import { describe, expect, it } from 'vitest'
import { localizeTemplateHtml } from './templateLocalization.js'

describe('template localization', () => {
  const sample = '<!doctype html><html><body><nav>Home</nav><h1>About</h1><button>Get in touch</button><script>const label = "Home"</script></body></html>'

  it('sets Turkish document language and translates visible starter copy', () => {
    const html = localizeTemplateHtml(sample, 'tr')
    expect(html).toContain('lang="tr"')
    expect(html).toContain('Ana Sayfa')
    expect(html).toContain('Hakkında')
    expect(html).toContain('İletişime geçin')
    expect(html).toContain('const label = "Home"')
  })

  it('keeps English copy while setting the English document language', () => {
    const html = localizeTemplateHtml(sample, 'en')
    expect(html).toContain('lang="en"')
    expect(html).toContain('Get in touch')
  })
})
