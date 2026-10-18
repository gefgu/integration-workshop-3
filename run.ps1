# Windows: starts the server API (8000), the simulated bench service (8765) and Vite.
# Usage: powershell -ExecutionPolicy Bypass -File run.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $root 'teacher_authoring_app'

if (-not (Test-Path (Join-Path $root 'graph_validator\.venv\Scripts\uvicorn.exe'))) {
  Write-Error "API not installed. Run: cd graph_validator; python -m venv .venv; .venv\Scripts\pip install -e '.[dev]' -e ..\bench\service"
}
if (-not (Test-Path (Join-Path $app 'node_modules'))) {
  Write-Error "Run 'npm install' in teacher_authoring_app first."
}

Push-Location $app
try {
  npm run migrate
  if (-not $?) { throw 'Migration failed.' }
  $jobs = @(
    Start-Process npm -ArgumentList 'run', 'validator' -NoNewWindow -PassThru
    Start-Process npm -ArgumentList 'run', 'bench-service' -NoNewWindow -PassThru
    Start-Process npm -ArgumentList 'run', 'dev', '--', '--host' -NoNewWindow -PassThru
  )
  Write-Host 'Site: http://localhost:5173  |  Bancada: http://localhost:5173/bench.html  |  Ctrl+C para sair'
  Wait-Process -Id ($jobs | ForEach-Object Id)
}
finally {
  $jobs | Where-Object { -not $_.HasExited } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  Pop-Location
}
