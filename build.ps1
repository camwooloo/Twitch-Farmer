# Twitch Farmer — full release build.
# Freezes the Python backend, stages it as a Tauri resource, and builds the
# Windows (NSIS) installer.
#
# Prereqs: Python 3.12 (py -V:3.12), Node + npm, Rust toolchain, WebView2 runtime.
#
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"

Write-Host "==> Ensuring backend venv (Python 3.12)" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $backend ".venv"))) {
    py -V:3.12 -m venv (Join-Path $backend ".venv")
}
$py = Join-Path $backend ".venv\Scripts\python.exe"
& $py -m pip install --upgrade pip | Out-Null
& $py -m pip install -r (Join-Path $backend "requirements.txt")

Write-Host "==> Freezing backend with PyInstaller" -ForegroundColor Cyan
Push-Location $backend
Get-Process twitch-farmer-backend -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path "dist\twitch-farmer-backend") { Remove-Item -Recurse -Force "dist\twitch-farmer-backend" }
& $py -m PyInstaller "twitch-farmer-backend.spec" --noconfirm --distpath dist --workpath build
Pop-Location

Write-Host "==> Staging frozen backend as Tauri resource" -ForegroundColor Cyan
$dist = Join-Path $root "backend-dist"
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $dist | Out-Null
Copy-Item -Recurse (Join-Path $backend "dist\twitch-farmer-backend") (Join-Path $dist "twitch-farmer-backend")

Write-Host "==> Installing npm deps" -ForegroundColor Cyan
Push-Location $root
npm install
Write-Host "==> Building Tauri app + NSIS installer" -ForegroundColor Cyan
npm run tauri build
Pop-Location

Write-Host "==> Done. Installer:" -ForegroundColor Green
Get-ChildItem (Join-Path $root "src-tauri\target\release\bundle\nsis\*.exe") | ForEach-Object { Write-Host $_.FullName }
