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

# Is the thing on that port OUR backend, or somebody else's?
#
# "Port is busy" used to be read as "we are already running", and that is how a
# different Django project on the same machine got mistaken for this one: the
# script skipped starting the backend, the app talked to a stranger's API, and
# every request came back 404 as a "network error" with nothing to point at.
# So the port is asked what it is, not just whether it answers.
function Test-OurBackend($port) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/public/config/" `
         -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $r.StatusCode -eq 200
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
# 8001, not Django's 8000: 8000 is what every Django project defaults to, so on
# a machine with more than one the first to start takes it and the rest quietly
# point at the wrong API.
$backendPort = 8001
if (Test-OurBackend $backendPort) {
  Write-Host "==> Backend is already running (port $backendPort), skipping." -ForegroundColor DarkGray
} elseif (Test-Port $backendPort) {
  Write-Host "==> Port $backendPort is taken by something that is NOT this backend." -ForegroundColor Red
  Write-Host "    Stop whatever is on it, or set a free port in start.ps1 and frontend/.env" -ForegroundColor Red
  Write-Host "    (VITE_API_URL=http://127.0.0.1:<port>/api)." -ForegroundColor Red
  exit 1
} else {
  Write-Host "==> Starting backend -> http://127.0.0.1:$backendPort" -ForegroundColor Green
  $cmd = "Set-Location '$backend'; " +
         "Write-Host 'BACKEND  http://127.0.0.1:$backendPort' -ForegroundColor Green; " +
         "& '$venvPy' manage.py migrate; " +
         "& '$venvPy' manage.py runserver 127.0.0.1:$backendPort"
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
