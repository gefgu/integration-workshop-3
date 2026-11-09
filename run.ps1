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

# Neon: .env.local (written by `neon link`) holds the Postgres URLs, as in run-local.sh. Migrations use the direct
# (unpooled) connection; the API uses the pooled one. Without the file the API falls back to the local SQLite
# database, whose accounts the phone app (Neon build) cannot see.
$envFile = Join-Path $root '.env.local'
$migrateUrl = $null
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      $value = $Matches[2] -replace '^"(.*)"$', '$1' -replace "^'(.*)'$", '$1'
      [Environment]::SetEnvironmentVariable($Matches[1], $value, 'Process')
    }
  }
  if (-not $env:TEDTRONICS_DATABASE_URL) { $env:TEDTRONICS_DATABASE_URL = $env:DATABASE_URL }
  $migrateUrl = if ($env:DATABASE_URL_UNPOOLED) { $env:DATABASE_URL_UNPOOLED } else { $env:TEDTRONICS_DATABASE_URL }
}
$dbLabel = if ("$env:TEDTRONICS_DATABASE_URL" -match '^postgres') { 'Neon' } else { 'SQLite local (contas nao chegam ao app do celular)' }
if ($dbLabel -eq 'Neon' -and -not $env:TEDTRONICS_BENCH_SECRET) {
  Write-Warning 'TEDTRONICS_BENCH_SECRET is not set in .env.local; bench tokens from Neon will not verify.'
}

Push-Location $app
try {
  $apiUrl = $env:TEDTRONICS_DATABASE_URL
  if ($migrateUrl) { $env:TEDTRONICS_DATABASE_URL = $migrateUrl }
  npm run migrate
  $migrated = $?
  $env:TEDTRONICS_DATABASE_URL = $apiUrl
  if (-not $migrated) { throw 'Migration failed.' }
  Write-Host "Banco de dados: $dbLabel"
  # npm.cmd, not npm: Start-Process resolves "npm" to npm.ps1, which is not an executable ("not a valid Win32 application").
  $jobs = @(
    Start-Process npm.cmd -ArgumentList 'run', 'validator' -NoNewWindow -PassThru
    Start-Process npm.cmd -ArgumentList 'run', 'bench-service' -NoNewWindow -PassThru
    Start-Process npm.cmd -ArgumentList 'run', 'dev', '--', '--host' -NoNewWindow -PassThru
  )
  Write-Host 'Site: http://localhost:5173  |  Bancada: http://localhost:5173/bench.html  |  Ctrl+C para sair'
  Wait-Process -Id ($jobs | ForEach-Object Id)
}
finally {
  # npm.cmd starts node as a child: stop the whole tree so no server keeps its port after Ctrl+C.
  $jobs | Where-Object { $_ -and -not $_.HasExited } | ForEach-Object { taskkill /PID $_.Id /T /F 2>&1 | Out-Null }
  Pop-Location
}
