$ErrorActionPreference = 'Stop'
$ApiBase = 'https://gabe-pokebuilder.onrender.com'
$ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PokemonDir = Join-Path $ToolsDir 'Pokemon'
$ExeCandidates = @(
    (Join-Path $ToolsDir 'gts-rs.exe'),
    (Join-Path $ToolsDir 'gts-rs\gts-rs.exe'),
    (Join-Path $ToolsDir 'gts-rs-src\target\release\gts-rs.exe')
)

function Is-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-LanIPv4 {
    try {
        $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.NextHop -ne '0.0.0.0' } |
            Sort-Object RouteMetric, InterfaceMetric |
            Select-Object -First 1
        if ($route) {
            $ip = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction Stop |
                Where-Object { $_.IPAddress -notlike '169.254.*' } |
                Select-Object -First 1 -ExpandProperty IPAddress
            if ($ip) { return $ip }
        }
    } catch {}

    $fallback = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $_.IPAddressToString -notlike '169.254.*' } |
        Select-Object -First 1
    if ($fallback) { return $fallback.IPAddressToString }
    return $null
}

function Invoke-Json([string]$Uri, [string]$Method='GET') {
    return Invoke-RestMethod -Uri $Uri -Method $Method -Headers @{ 'User-Agent'='GabeGTSBridge/6.0' } -TimeoutSec 30
}

function Ensure-Firewall([string]$ExePath) {
    if (-not (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue)) { return }
    foreach ($proto in @('TCP','UDP')) {
        $name = "Gabe Pokemon GTS Bridge $proto"
        $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
        if (-not $existing) {
            try {
                New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Program $ExePath -Protocol $proto | Out-Null
            } catch {
                Write-Host "Firewall rule could not be added automatically: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "`n==========================================================" -ForegroundColor DarkCyan
Write-Host "  Gabe's Pokemon Creator - Custom DNS GTS Bridge v6" -ForegroundColor Cyan
Write-Host "==========================================================`n" -ForegroundColor DarkCyan

if (-not (Is-Admin)) {
    Write-Host 'This must be run as Administrator so the DNS/GTS server can bind its network ports.' -ForegroundColor Red
    exit 1
}

$Exe = $ExeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Exe) {
    Write-Host 'gts-rs.exe is not installed yet.' -ForegroundColor Yellow
    Write-Host 'Run setup-gts-rs.bat once, then come back to this launcher.'
    exit 2
}

$Code = (Read-Host 'Delivery code from the website').Trim().Replace('-','').ToUpperInvariant()
if ([string]::IsNullOrWhiteSpace($Code)) { throw 'A delivery code is required.' }

Write-Host "`nFetching queued Pokemon $Code from $ApiBase ..."
try {
    $Item = Invoke-Json "$ApiBase/api/gts/queue/$Code"
} catch {
    Write-Host "Could not load that delivery code: $($_.Exception.Message)" -ForegroundColor Red
    exit 3
}

if ($Item.status -eq 'delivered') {
    Write-Host 'That delivery is already marked delivered.' -ForegroundColor Yellow
    exit 4
}

New-Item -ItemType Directory -Path $PokemonDir -Force | Out-Null
$SafeName = [IO.Path]::GetFileName([string]$Item.fileName)
if ([string]::IsNullOrWhiteSpace($SafeName)) { $SafeName = "delivery-$Code.pkm" }
$PokemonPath = Join-Path $PokemonDir $SafeName
[IO.File]::WriteAllBytes($PokemonPath, [Convert]::FromBase64String([string]$Item.dataBase64))

$LanIp = Get-LanIPv4
if (-not $LanIp) {
    Write-Host 'I could not automatically determine this PC''s LAN IPv4 address.' -ForegroundColor Yellow
    $LanIp = Read-Host 'Enter this PC''s LAN IPv4 address (example 192.168.1.42)'
}

Ensure-Firewall $Exe

Write-Host "`nQUEUED POKEMON" -ForegroundColor Green
Write-Host "  Pokemon:    $($Item.species)"
Write-Host "  Game:       $($Item.game)"
Write-Host "  Generation: $($Item.generation)"
Write-Host "  File:       $PokemonPath"

Write-Host "`nDS / DSi / 3DS NETWORK SETTINGS" -ForegroundColor Cyan
Write-Host "  Primary DNS:   $LanIp" -ForegroundColor Yellow
Write-Host "  Secondary DNS: leave blank, or use $LanIp if the menu requires a value"
Write-Host "`nYour DS must be able to reach this PC over the local network."
Write-Host "For retail Gen IV/V Wi-Fi, use a DS-compatible open/WEP network as required by the game/hardware."
Write-Host "`n1. Set the DS connection's Auto-obtain DNS to NO."
Write-Host "2. Enter the Primary DNS shown above."
Write-Host "3. Save/test the connection."
Write-Host "4. Start the Pokemon game and enter its normal in-game GTS."
Write-Host "5. Leave this window running until the Pokemon arrives.`n"

Write-Host 'Starting gts-rs local DNS + GTS server...' -ForegroundColor Green
Write-Host 'The queued Pokemon path is being preloaded into its input.'

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $Exe
$psi.WorkingDirectory = Split-Path -Parent $Exe
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
[void]$proc.Start()

# gts-rs reads the file path when its send flow requests one. Supplying the line now
# leaves it buffered until that read happens after the DS enters the GTS.
$proc.StandardInput.WriteLine($PokemonPath)
$proc.StandardInput.Flush()
$proc.WaitForExit()

Write-Host "`ngts-rs exited with code $($proc.ExitCode)."
$received = Read-Host 'Did the Pokemon arrive on the DS? [y/N]'
if ($received -match '^[Yy]') {
    try {
        Invoke-Json "$ApiBase/api/gts/queue/$Code/delivered" 'POST' | Out-Null
        Write-Host 'Delivery marked complete.' -ForegroundColor Green
    } catch {
        Write-Host "Pokemon arrived, but the website status could not be updated: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host 'The delivery remains queued until it expires, so you can retry.' -ForegroundColor Yellow
}
