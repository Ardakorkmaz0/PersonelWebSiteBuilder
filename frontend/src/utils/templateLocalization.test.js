import { describe, expect, it } from 'vitest'
import { localizeTemplateHtml } from './templateLocalization.js'
import { TEMPLATE_LIBRARY } from './templateLibrary.js'

describe('template localization', () => {
  const sample = '<!doctype html><html><body><nav aria-label="Open menu">Home</nav><h1>About</h1><button title="Get in touch">Get in touch</button><script>const label = "Home"</script></body></html>'

  it('sets Turkish document language and translates visible starter copy', () => {
    const html = localizeTemplateHtml(sample, 'tr')
    expect(html).toContain('lang="tr"')
    expect(html).toContain('Ana Sayfa')
    expect(html).toContain('Hakkında')
    expect(html).toContain('İletişime geçin')
    expect(html).toContain('aria-label="Menüyü aç"')
    expect(html).toContain('title="İletişime geçin"')
    expect(html).toContain('const label = "Home"')
  })

  it('keeps English copy while setting the English document language', () => {
    const html = localizeTemplateHtml(sample, 'en')
    expect(html).toContain('lang="en"')
    expect(html).toContain('Get in touch')
  })

  it('meaningfully translates every template category and switches back to English', () => {
    const expectedTurkish = {
      cv: 'Kıdemli Ürün Tasarımcısı',
      portfolio: 'Seçili çalışmalar',
      landing: 'Gerçekten ihtiyacınız olan her şey',
      business: 'Neler yapıyoruz',
      cafe: 'İyi kahve.',
      photo: 'Son kareler',
      blog: 'Atölyeden notlar.',
      event: 'Evleniyoruz.',
      shop: 'Çok satanlar',
      links: 'Son podcast bölümü',
    }

    for (const category of TEMPLATE_LIBRARY) {
      const source = category.variants[0].build('Example')
      const turkish = localizeTemplateHtml(source, 'tr')
      const english = localizeTemplateHtml(source, 'en')

      expect(turkish, category.id).toContain(expectedTurkish[category.id])
      expect(turkish, category.id).not.toBe(english)
      expect(english, category.id).toContain('lang="en"')
    }
  })
})
