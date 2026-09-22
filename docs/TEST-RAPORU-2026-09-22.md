# Arayüz ve güvenlik test raporu — 22 Eylül 2026

## Sonuç

Tam otomatik paketlerde 1.390 ön uç ve 351 arka uç testi geçti. Lint, üretim derlemesi, Django sistem kontrolü ve migration tutarlılık kontrolü başarılı. Gerçek Chrome ile aşağıdaki akışlar ayrıca doğrulandı. Test edilen temel commit: `56420b8`.

Son görsel kontrolde bulunan mobil başlık kesilmesi için yalnız Explore karşılama başlığına `overflow-wrap:anywhere` eklendi. Bu son CSS değişikliği ayrıca dosya bazında ESLint, 390/1440 px gerçek tarayıcı ölçümü ve üretim derlemesiyle doğrulandı.

## Bu incelemede bulunan ve giderilen hatalar

- **Giriş denemesi sınırını aşma:** İstemcinin değiştirdiği `X-Forwarded-For` başlığı yeni bir hız sınırı kimliği oluşturabiliyordu. Gerçek DRF throttle ile önce başarısız regresyonlar elde edildi. Varsayılan `NUM_PROXIES=0` ile güvenilmeyen başlıklar yok sayılıyor; güvenilir proxy sayısı `DJANGO_TRUSTED_PROXY_COUNT` ile açıkça tanımlanıyor. Proxy'nin başlığı güvenli üretmesi ve uygulama sunucusuna doğrudan erişimin kapatılması gerektiği DEPLOY.md içinde açıklandı.
- **Hesaplar arasında favori durumu taşınması:** Explore önbelleği hesap/oturum değişiminde temizleniyor; aynı hesapta sayfaya dönüşte korunuyor.
- **Keşfet yükleme hatasından çıkamama:** Ayrı hata durumu ve tekrar deneme eklendi. Seçili kategoriye yeniden basmak da isteği başlatıyor; hata artık boş topluluk gibi gösterilmiyor.
- **Klavye odağının kaybolması:** Hesap ve mobil menülerinde Escape, menü içindeki odağı açma düğmesine döndürüyor; dışarıdaki odağı değiştirmiyor.
- **Mobilde uzun kullanıcı adının kesilmesi:** Uzun kesintisiz isimler başlık içinde alt satıra geçiyor. 390 px ekranda başlık içerik genişliği/kutu genişliği 313/313 px, belge/ekran genişliği 390/390 px olarak ölçüldü.

## Otomatik doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npm run test:run` | 131 dosya, 1.390 test geçti |
| `npm run lint` | Hata veya uyarı yok |
| `npm run build` | Başarılı; son CSS değişikliğinden sonra tekrarlandı |
| `npm audit --json` | Bilinen 0 açık; üretim ve geliştirme bağımlılıkları dahil |
| Tüm backend pytest paketi | 351 test geçti; bellek içi SQLite |
| Django sistem kontrolü | 0 sorun |
| `makemigrations --check --dry-run` | Eksik migration yok |
| `git diff --check` | Başarılı |

Güvenlik regresyonları; kontrol karakteri içeren URL'ler, Google girişinde doğrulanmış e-posta/aktif hesap koşulları, taslak ve yönetici erişim yetkileri, gizli ayarlar, yüklenen dosyalar, paylaşım limitleri ve iframe mesaj kaynaklarını da kapsıyor. Bunların bir kısmı önceden düzeltilmişti; bu incelemede korundukları doğrulandı.

## Gerçek tarayıcı doğrulaması

Kurulu Chrome, Playwright ve kullanıcıdan bağımsız geçici bir tarayıcı profili kullanıldı:

- 1440 px masaüstü ve 390 px mobil giriş ekranı; belge genişliğinde taşma yok.
- Geçici kullanıcı kaydı ve ana sayfaya geçiş.
- Yazarken kişi önerileri; Enter ile sonuçlara geçiş; kullanıcı/site filtreleri.
- Favoriler sayfasının açılması.
- Masaüstü hesap menüsü ve mobil menüde Escape sonrası doğru düğmeye odak dönüşü.
- Mobil ana sayfa ve uzun kullanıcı adının okunabilirliği.
- Yeni boş site oluşturma ve editöre geçiş; varsayılan olarak yayımlanmamış taslak.
- Yalnız test tarayıcısında yapay 503 yanıtı verilen Explore isteğinin Tekrar dene ile başarıyla toparlanması.
- Gerçek HTML dosyası yükleme, editörde View modunda JavaScript düğmesinin çalışması.
- Aynı yüklenen betiğin ana uygulamanın belgesine erişememesi; çalışan çerçevede `allow-scripts` bulunması ve `allow-same-origin` bulunmaması.
- Tam sayfa yenilemesinden sonra HTML taslağının korunması ve JavaScript'in yeniden çalışması.

Başarılı son tarayıcı akışlarında yakalanmamış JavaScript hatası görülmedi. Geçici hesabın iki taslağı da yayımlanmadı; test sonunda hesap, taslaklar ve tarayıcı kimlik doğrulama dosyası silindi. Diğer kullanıcıların kayıtları değiştirilmedi.

## Kapsamın sınırları ve kalan uyarılar

- Bu sonuç, bütün olası kullanıcı girdilerinin veya bütün güvenlik açıklarının yokluğunun garantisi değildir.
- Google sağlayıcısıyla gerçek OAuth girişi, e-posta teslimi, üretim proxy/TLS ortamı ve diğer tarayıcı motorları bu çalışmada uçtan uca çalıştırılmadı.
- Backend bağımlılıkları için CVE tarama aracı kurulu değildi; npm sonucu Python paketleri için geçerli değildir.
- Ana JavaScript paketi yaklaşık 624 kB (gzip 208 kB). Derlemeyi engellemeyen 500 kB parça boyutu uyarısı var.
- Backend testlerinde geliştirme ortamının `staticfiles` dizininin bulunmaması uyarısı var; test başarısızlığı oluşturmadı.
- Kullanıcının tamamlandığını belirttiği rehber kartları ve kaynak kodu/sayfa ayarı eşitleme konusu yeniden ele alınmadı.
