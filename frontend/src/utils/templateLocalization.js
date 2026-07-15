const TEMPLATE_TEXT_TR = {
  Home: 'Ana Sayfa',
  About: 'Hakkında',
  Contact: 'İletişim',
  Elsewhere: 'Diğer bağlantılar',
  Work: 'Çalışmalar',
  Services: 'Hizmetler',
  Menu: 'Menü',
  Visit: 'Ziyaret',
  Product: 'Ürün',
  Features: 'Özellikler',
  Gallery: 'Galeri',
  Subscribe: 'Abone ol',
  Schedule: 'Program',
  RSVP: 'Katılım bildir',
  Shop: 'Mağaza',
  Experience: 'Deneyim',
  Skills: 'Beceriler',
  Pricing: 'Fiyatlandırma',
  Reviews: 'Yorumlar',
  Articles: 'Yazılar',
  Venue: 'Mekân',
  Booking: 'Rezervasyon',
  'Our story': 'Hikâyemiz',
  'Work with me': 'Birlikte çalışalım',
  'Get in touch': 'İletişime geçin',
  'Start free': 'Ücretsiz başla',
  Download: 'İndir',
  'Get a quote': 'Teklif alın',
  'Start a project': 'Projeyi başlat',
  'See results': 'Sonuçları görün',
  'What we do': 'Neler yapıyoruz',
  'Case studies': 'Vaka çalışmaları',
  'Recent results': 'Son sonuçlar',
  'Tell us about your project': 'Projenizi bize anlatın',
  'See the menu': 'Menüyü görün',
  'What we serve': 'Neler sunuyoruz',
  Breakfast: 'Kahvaltı',
  Lunch: 'Öğle yemeği',
  'Coffee & more': 'Kahve ve daha fazlası',
  'Hours & location': 'Saatler ve konum',
  'Open in Maps': 'Haritada aç',
  'Private events & catering': 'Özel etkinlikler ve catering',
  'Ask about dates': 'Tarihleri sorun',
  'Book a shoot': 'Çekim ayırtın',
  'View gallery': 'Galeriyi görün',
  'Check dates': 'Tarihleri kontrol edin',
  'Recent frames': 'Son kareler',
  'Check availability': 'Uygunluğu kontrol edin',
  'Notes from the workshop.': 'Atölyeden notlar.',
  Engineering: 'Mühendislik',
  Design: 'Tasarım',
  Writing: 'Yazı',
  'One essay a month': 'Ayda bir yazı',
  'Subscribe by email': 'E-posta ile abone olun',
  'See the schedule': 'Programı görün',
  'The day': 'Günün programı',
  'Guests arrive': 'Misafirlerin gelişi',
  Ceremony: 'Tören',
  Dinner: 'Akşam yemeği',
  Party: 'Kutlama',
  Where: 'Nerede',
  'The venue': 'Mekân',
  'Will you join us?': 'Bize katılacak mısınız?',
  'RSVP by email': 'E-posta ile katılım bildirin',
  'Shop now': 'Şimdi alışveriş yap',
  'Browse the shop': 'Mağazayı gezin',
  Bestsellers: 'Çok satanlar',
  'Why small batches': 'Neden küçük üretim?',
  'Questions about an order?': 'Sipariş hakkında sorunuz mu var?',
  'Built with care.': 'Özenle hazırlandı.',
  'All rights reserved.': 'Tüm hakları saklıdır.',
}

const PHRASE_REPLACEMENTS_TR = [
  ['All rights reserved.', 'Tüm hakları saklıdır.'],
  ['Read more', 'Devamını oku'],
  ['Learn more', 'Daha fazla bilgi'],
  ['View project', 'Projeyi görüntüle'],
  ['View work', 'Çalışmaları görüntüle'],
  ['Send a message', 'Mesaj gönder'],
  ['Your email', 'E-posta adresiniz'],
  ['Email address', 'E-posta adresi'],
]

function translateText(value) {
  const raw = String(value || '')
  const leading = raw.match(/^\s*/)?.[0] || ''
  const trailing = raw.match(/\s*$/)?.[0] || ''
  const text = raw.trim()
  if (!text) return raw
  let translated = TEMPLATE_TEXT_TR[text] || text
  for (const [source, target] of PHRASE_REPLACEMENTS_TR) {
    translated = translated.replaceAll(source, target)
  }
  return `${leading}${translated}${trailing}`
}

export function localizeTemplateHtml(html, language = 'en') {
  const source = String(html || '')
  if (!source) return source
  if (typeof DOMParser === 'undefined') {
    return source.replace(/<html([^>]*)>/i, `<html$1 lang="${language}">`)
  }
  const doc = new DOMParser().parseFromString(source, 'text/html')
  doc.documentElement.lang = language
  if (language === 'tr') {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (!node.parentElement?.closest('style,script,code,pre')) node.nodeValue = translateText(node.nodeValue)
      node = walker.nextNode()
    }
  }
  return `<!doctype html>\n${doc.documentElement.outerHTML}`
}
