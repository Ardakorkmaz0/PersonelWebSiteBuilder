#!/usr/bin/env bash
# Tek komutla dağıtım.
#
# Bu uygulama üç ayrı katman: Django konteynerde çalışır, arayüz DERLENMİŞ
# statik dosyalardır, ve Caddy hangi isteğin hangisine gideceğine karar verir.
# Sunucuda "git pull" yalnızca birincisini günceller — arayüz derlenip
# yüklenmezse tarayıcı eski paketi almaya devam eder ve hiçbir şey değişmemiş
# gibi görünür. Bu betik üçünü de sırayla yapar ve sonunda CANLIDAN doğrular.
#
# Kullanım:  bash deploy.sh
set -euo pipefail

HOST="${SITEBUILDER_HOST:-SiteBuilt}"   # ~/.ssh/config içindeki isim
REMOTE_APP="/home/ubuntu/sitebuilder"
REMOTE_WEB="/srv/sitebuilder/dist"
SITE="${SITEBUILDER_URL:-https://sitebuilt.app}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n\033[1;35m==> %s\033[0m\n' "$1"; }

# --- 0. Gönderilmemiş commit var mı ----------------------------------------
say "Depo durumu"
cd "$ROOT"
if [ -n "$(git status --porcelain)" ]; then
  echo "UYARI: kaydedilmemiş değişiklikler var, bunlar dağıtılmayacak:"
  git status --short
fi
AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
if [ "$AHEAD" != "0" ]; then
  echo "HATA: $AHEAD commit push edilmemiş. Önce: git push"
  exit 1
fi
echo "yerel HEAD: $(git rev-parse --short HEAD)"

# --- 1. Arayüzü derle -------------------------------------------------------
# VITE_API_URL derleme anında gömülür; frontend/.env.production'dan gelir.
say "Arayüz derleniyor"
cd "$ROOT/frontend"
npm run build
BUNDLE="$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)"
echo "derlenen paket: $BUNDLE"

# --- 2. Backend: kodu çek, yeniden derle, migration'ları uygula -------------
say "Backend güncelleniyor"
ssh "$HOST" "cd $REMOTE_APP && git pull --ff-only && sudo docker compose up -d --build"

# --- 3. Arayüzü yükle -------------------------------------------------------
# Önce eskisini siliyoruz: hash'li dosya adları biriktiği için silinmezse
# /srv altı her dağıtımda büyür ve hangi sürümün canlı olduğu belirsizleşir.
say "Arayüz yükleniyor"
cd "$ROOT/frontend"
tar czf /tmp/sb-dist.tgz -C dist .
scp -q /tmp/sb-dist.tgz "$HOST:/tmp/"
ssh "$HOST" "sudo rm -rf $REMOTE_WEB/* && sudo tar xzf /tmp/sb-dist.tgz -C $REMOTE_WEB && rm /tmp/sb-dist.tgz"
rm -f /tmp/sb-dist.tgz

# --- 4. CANLIDAN doğrula ----------------------------------------------------
# "Yükledim" ile "çalışıyor" farklı şeyler. Servis edilen index.html gerçekten
# az önce derlediğimiz paketi mi çağırıyor, ona bakılır.
say "Canlı doğrulama"
LIVE="$(curl -s -H 'Cache-Control: no-cache' "$SITE/" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
if [ "$LIVE" != "$BUNDLE" ]; then
  echo "HATA: canlıdaki paket '$LIVE', derlenen '$BUNDLE'. Yükleme geçmemiş."
  exit 1
fi
echo "servis edilen paket doğru: $LIVE"

fail=0
check() { # yol  beklenen_kod  açıklama
  code="$(curl -s -o /dev/null -w '%{http_code}' "$SITE/$1")"
  if [ "$code" = "$2" ]; then
    printf '  %-22s %s  %s\n' "/$1" "$code" "$3"
  else
    printf '  %-22s %s  BEKLENEN %s — %s\n' "/$1" "$code" "$2" "$3"
    fail=1
  fi
}
# Bu satırlar Caddy'nin yönlendirmesini sınar. Django'nun sahip olduğu bir yol
# değiştiğinde /etc/caddy/Caddyfile de güncellenmeli; unutulursa burada patlar.
check "api/public/config/" 200 "API"
check "admin"              200 "uygulamanın kendi paneli (SPA)"
check "admin/settings"     200 "ayar sayfası (SPA)"
check "django-admin/"      302 "Django admin"
check "yok-boyle-bir-sayfa" 200 "404 ekranı (SPA)"

if [ "$fail" != "0" ]; then
  echo
  echo "Bazı yollar beklenen yere gitmiyor. Büyük ihtimalle /etc/caddy/Caddyfile"
  echo "içindeki '@backend path ...' satırı kodla uyumsuz. Bak ve düzelt:"
  echo "  ssh $HOST 'sudo nano /etc/caddy/Caddyfile && sudo systemctl reload caddy'"
  exit 1
fi

say "Bitti — $SITE güncel"
