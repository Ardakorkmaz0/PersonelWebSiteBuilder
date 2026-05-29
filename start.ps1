# PersonelWebSiteBuilder - starts everything with one command.
# - Creates the Python venv and installs dependencies when needed
# - Runs npm install for the frontend when needed
# - Starts the backend (Django) and frontend (Vite) servers in separate windows
# - Opens the browser
#
# Run:  .\start.ps1        (or double-click start.bat)

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

Write-Host "==> Starting PersonelWebSiteBuilder..." -ForegroundColor Cyan

# --- Backend setup (first run only) ---
if (-not (Test-Path $venvPy)) {
  Write-Host "==> Python venv is missing; creating it and installing dependencies..." -ForegroundColor Yellow
  python -m venv (Join-Path $backend '.venv')
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r (Join-Path $backend 'requirements.txt')
}

# --- Frontend setup (first run only) ---
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Write-Host "==> node_modules is missing; running npm install..." -ForegroundColor Yellow
  Push-Location $frontend; npm install; Pop-Location
}

# --- Backend server ---
if (Test-Port 8000) {
  Write-Host "==> Backend is already running (port 8000), skipping." -ForegroundColor DarkGray
} else {
  Write-Host "==> Starting backend -> http://127.0.0.1:8000" -ForegroundColor Green
  $cmd = "Set-Location '$backend'; " +
         "Write-Host 'BACKEND  http://127.0.0.1:8000' -ForegroundColor Green; " +
         "& '$venvPy' manage.py migrate; " +
         "& '$venvPy' manage.py runserver 127.0.0.1:8000"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd
}

# --- Frontend server ---
if (Test-Port 5173) {
  Write-Host "==> Frontend is already running (port 5173), skipping." -ForegroundColor DarkGray
} else {
  Write-Host "==> Starting frontend -> http://localhost:5173" -ForegroundColor Green
  $cmd = "Set-Location '$frontend'; " +
         "Write-Host 'FRONTEND http://localhost:5173' -ForegroundColor Green; " +
         "npm run dev"
  Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd
}

# --- Open the browser once the frontend is ready ---
Write-Host "==> Opening browser..." -ForegroundColor Cyan
for ($i = 0; $i -lt 20; $i++) { if (Test-Port 5173) { break }; Start-Sleep -Milliseconds 500 }
Start-Process 'http://localhost:5173'

Write-Host "`nReady! Both servers are running in separate windows." -ForegroundColor Cyan
Write-Host "Close those windows (or press Ctrl+C) to stop them." -ForegroundColor DarkGray
