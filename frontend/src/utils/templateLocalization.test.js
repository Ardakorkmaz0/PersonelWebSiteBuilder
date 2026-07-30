import { describe, expect, it } from 'vitest'
import { localizeTemplateHtml } from './templateLocalization.js'
import { VERTICAL_CATEGORY_SEEDS, VERTICAL_TEMPLATE_TRANSLATIONS } from './templateCatalogData.js'
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
      wellness: 'Daha güçlü bir rutine hazır mısınız?',
      ...Object.fromEntries(
        VERTICAL_CATEGORY_SEEDS.map((category) => [category.id, category.profile.title.tr]),
      ),
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

  it('keeps every Fitness & Wellness starter meaningfully localised', () => {
    const wellness = TEMPLATE_LIBRARY.find((category) => category.id === 'wellness')
    const markers = {
      'wellness-iron-club': 'Daha güçlü bir rutine hazır mısınız?',
      'wellness-yoga-bloom': 'Matınız sizi bekliyor',
      'wellness-pilates-house': 'İlk seansla başlayın',
      'wellness-personal-coach': 'Önümüzdeki on iki haftayı değerlendirin',
      'wellness-run-collective': 'Başlangıç çizgisinde görüşürüz',
      'wellness-retreat': 'Masadaki yerinizi alın',
      'wellness-nutrition-studio': 'Tek bir görüşmeyle başlayın',
      'wellness-calm-practice': 'İlk dersiniz basit olabilir',
      'wellness-martial-arts': 'Mata adım at',
      'wellness-recovery-studio': 'Haftanıza bir reset verin',
    }

    for (const template of wellness.variants) {
      const turkish = localizeTemplateHtml(template.build('Example'), 'tr')
      expect(turkish, template.id).toContain(markers[template.id])
    }
  })

  it('localises every text item in the vertical template catalog', () => {
    const escapeHtml = (value) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')

    const source = `<!doctype html><html><body>${Object.keys(VERTICAL_TEMPLATE_TRANSLATIONS)
      .map((text) => `<span>${escapeHtml(text)}</span>`)
      .join('')}</body></html>`
    const localized = localizeTemplateHtml(source, 'tr')
    const localizedText = new DOMParser().parseFromString(localized, 'text/html').body.textContent

    for (const [english, turkish] of Object.entries(VERTICAL_TEMPLATE_TRANSLATIONS)) {
      expect(localizedText, english).toContain(turkish)
    }
  })
})
