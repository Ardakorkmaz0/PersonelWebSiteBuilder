
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
