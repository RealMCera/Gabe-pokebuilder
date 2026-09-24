$ErrorActionPreference = 'Stop'
$ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Join-Path $ToolsDir 'gts-rs-src'
$ExeOut = Join-Path $ToolsDir 'gts-rs.exe'

Write-Host "`nGabe's Pokemon Creator - gts-rs setup" -ForegroundColor Cyan
Write-Host "This helper builds the upstream gts-rs project used for the local custom-DNS/GTS transport.`n"

function Need-Command([string]$name) {
    return -not (Get-Command $name -ErrorAction SilentlyContinue)
}

if (Need-Command 'git') {
    Write-Host 'Git is not installed.' -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        $answer = Read-Host 'Install Git with winget now? [Y/n]'
        if ($answer -notmatch '^[Nn]') {
            winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
            $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
        }
    }
}

if (Need-Command 'cargo') {
    Write-Host 'Rust/Cargo is not installed.' -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        $answer = Read-Host 'Install Rustup with winget now? [Y/n]'
        if ($answer -notmatch '^[Nn]') {
            winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
            $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ';' + (Join-Path $HOME '.cargo\bin')
        }
    }
}

if (Need-Command 'git' -or Need-Command 'cargo') {
    Write-Host "`nGit and Cargo are both required. Install the missing tool(s), reopen this setup, and try again." -ForegroundColor Red
    exit 2
}

if (-not (Test-Path $RepoDir)) {
    Write-Host 'Cloning gts-rs from its current Codeberg repository...'
    git clone https://codeberg.org/bolu/gts-rs.git $RepoDir
} else {
    Write-Host 'Updating existing gts-rs source...'
    git -C $RepoDir pull --ff-only
}

Write-Host "`nBuilding release executable. This can take a few minutes the first time..." -ForegroundColor Cyan
Push-Location $RepoDir
try {
    cargo build --release
} finally {
    Pop-Location
}

$Built = Join-Path $RepoDir 'target\release\gts-rs.exe'
if (-not (Test-Path $Built)) {
    throw "Build completed but gts-rs.exe was not found at $Built"
}
Copy-Item $Built $ExeOut -Force
Write-Host "`nREADY: $ExeOut" -ForegroundColor Green
Write-Host 'You can now run start-custom-dns-gts.bat.'
