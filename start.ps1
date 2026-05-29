# PersonelWebSiteBuilder - tek komutla her seyi baslatir.
# - Gerekirse Python venv'i olusturur + bagimliliklari kurar
# - Gerekirse frontend icin npm install yapar
# - Backend (Django) ve frontend (Vite) sunucularini AYRI pencerelerde baslatir
# - Tarayiciyi acar
#
# Calistirma:  .\start.ps1        (veya start.bat'a cift tikla)

$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvPy   = Join-Path $backend '.venv\Scripts\python.exe'

function Test-Port($port) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $port); $c.Close(); return $true
  } catch { return $false }
}

Write-Host "==> PersonelWebSiteBuilder baslatiliyor..." -ForegroundColor Cyan

# --- Backend kurulum (sadece ilk seferde) ---
if (-not (Test-Path $venvPy)) {
  Write-Host "==> Python venv yok, olusturuluyor + bagimliliklar kuruluyor..." -ForegroundColor Yellow
  python -m venv (Join-Path $backend '.venv')
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r (Join-Path $backend 'requirements.txt')
}

# --- Frontend kurulum (sadece ilk seferde) ---
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Write-Host "==> node_modules yok, npm install calisiyor..." -ForegroundColor Yellow
  Push-Location $frontend; npm install; Pop-Location
}

# --- Backend sunucusu ---
if (Test-Port 8000) {
  Write-Host "==> Backend zaten calisiyor (port 8000), atlaniyor." -ForegroundColor DarkGray
} else {
  Write-Host "==> Backend baslatiliyor -> http://127.0.0.1:8000" -ForegroundColor Green
  $cmd = "Set-Location '$backend'; " +
         "Write-Host 'BACKEND  http://127.0.0.1:8000' -ForegroundColor Green; " +
         "& '$venvPy' manage.py migrate; " +
         "& '$venvPy' manage.py runserver 127.0.0.1:8000"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd
}

# --- Frontend sunucusu ---
if (Test-Port 5173) {
  Write-Host "==> Frontend zaten calisiyor (port 5173), atlaniyor." -ForegroundColor DarkGray
} else {
  Write-Host "==> Frontend baslatiliyor -> http://localhost:5173" -ForegroundColor Green
  $cmd = "Set-Location '$frontend'; " +
         "Write-Host 'FRONTEND http://localhost:5173' -ForegroundColor Green; " +
         "npm run dev"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd
}

# --- Tarayiciyi ac (frontend hazir olunca) ---
Write-Host "==> Tarayici aciliyor..." -ForegroundColor Cyan
for ($i = 0; $i -lt 20; $i++) { if (Test-Port 5173) { break }; Start-Sleep -Milliseconds 500 }
Start-Process 'http://localhost:5173'

Write-Host "`nHazir! Iki sunucu da ayri pencerelerde calisiyor." -ForegroundColor Cyan
Write-Host "Durdurmak icin o pencereleri kapat (veya Ctrl+C)." -ForegroundColor DarkGray
