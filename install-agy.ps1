# One-click Antigravity (agy) installer for agent-statusline (Windows).
#
# agy runs the statusLine `command` by splitting it on spaces WITHOUT honoring
# quotes, so the node path must be space-free. This copies the bundle into agy's
# home (a space-free location) and writes settings.json to point at it.
#
#   Usage:  powershell -ExecutionPolicy Bypass -File .\install-agy.ps1
$ErrorActionPreference = 'Stop'

$src = Join-Path $PSScriptRoot 'dist\index.js'
if (-not (Test-Path $src)) {
  throw "dist\index.js not found. Run 'npm install; npm run build' in this folder first."
}

$agyHome = Join-Path $env:USERPROFILE '.gemini\antigravity-cli'
$destDir = Join-Path $agyHome 'agent-statusline'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir 'index.js'
Copy-Item -Force -LiteralPath $src -Destination $dest

# Path must be space-free for agy's naive command split; fall back to the 8.3
# short name if the user's profile path contains a space.
$nodePath = $dest
if ($nodePath -match ' ') {
  try { $nodePath = (New-Object -ComObject Scripting.FileSystemObject).GetFile($dest).ShortPath } catch {}
}
$cmd = "node $nodePath"

$settings = Join-Path $agyHome 'settings.json'
$s = if (Test-Path $settings) { [System.IO.File]::ReadAllText($settings) | ConvertFrom-Json } else { [pscustomobject]@{} }
$s | Add-Member -NotePropertyName statusLine -NotePropertyValue ([pscustomobject]@{ type = 'command'; command = $cmd; enabled = $true }) -Force
[System.IO.File]::WriteAllText($settings, ($s | ConvertTo-Json -Depth 20))

Write-Host "[OK] agent-statusline installed for Antigravity (agy)."
Write-Host "     bundle:   $dest"
Write-Host "     command:  $cmd"
Write-Host "     settings: $settings"
Write-Host "     config:   $(Join-Path $agyHome 'agent-statusline.local.json')  (optional; defaults to normal)"
if ($nodePath -match ' ') {
  Write-Warning "Path still contains a space (no 8.3 short name). Move the repo to a space-free path if agy fails to launch it."
}
Write-Host ""
Write-Host "Restart agy to see the status line.  (Uninstall: remove the statusLine key from settings.json)"
