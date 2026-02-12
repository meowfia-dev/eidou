# Eidou Installer for Windows -- https://github.com/meowfia-dev/eidou
# Usage:
#   irm https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.ps1 | iex
#   .\install.ps1 -Client claude-desktop
#
# Parameters:
#   -Client <name>    Configure an MCP client after install
#                     (claude-desktop, claude-code, opencode)
#   -Version <tag>    Install a specific version (default: latest)
#   -InstallDir <d>   Override install directory
#
# Forged in the Void by Meowfia.

param(
    [string]$Client = "",
    [string]$Version = "",
    [string]$InstallDir = "",
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Eidou Installer for Windows -- https://github.com/meowfia-dev/eidou

Usage:
  irm https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.ps1 | iex
  .\install.ps1 -Client claude-desktop

Parameters:
  -Client <name>    Configure an MCP client after install
                    (claude-desktop, claude-code, opencode)
  -Version <tag>    Install a specific version (default: latest)
  -InstallDir <d>   Override install directory
  -Help             Show this help
"@
    exit 0
}

# -- Constants ---------------------------------------------------------------

$Repo = "meowfia-dev/eidou"
$BinName = "eidou.exe"
$DefaultInstallDir = "$env:LOCALAPPDATA\eidou"
$AssetName = "eidou-windows-x86_64.zip"

# -- Output Helpers ----------------------------------------------------------

function Write-Info  { param([string]$Msg) Write-Host "[info]  $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "[ ok ]  $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[warn]  $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[ err]  $Msg" -ForegroundColor Red }

# -- Validate Client ---------------------------------------------------------

$ValidClients = @("", "claude-desktop", "claude-code", "opencode")
if ($Client -and $Client -notin $ValidClients) {
    Write-Err "Unknown client: $Client"
    Write-Err "Supported: claude-desktop, claude-code, opencode"
    exit 1
}

# -- Version Resolution ------------------------------------------------------

function Resolve-LatestVersion {
    Write-Info "Fetching latest release..."
    $ReleasesUrl = "https://api.github.com/repos/$Repo/releases/latest"

    try {
        $Response = Invoke-RestMethod -Uri $ReleasesUrl -UseBasicParsing -ErrorAction Stop
        $Tag = $Response.tag_name -replace '^v', ''
        if (-not $Tag) { throw "Empty tag" }
        Write-Ok "Latest version: v$Tag"
        return $Tag
    }
    catch {
        Write-Err "Failed to fetch latest release."
        Write-Err "The latest release may be a draft. Try: -Version 0.2.0"
        exit 1
    }
}

if ($Version) {
    $Version = $Version -replace '^v', ''
    Write-Info "Using specified version: v$Version"
}
else {
    $Version = Resolve-LatestVersion
}

# -- Download & Install ------------------------------------------------------

$TargetDir = if ($InstallDir) { $InstallDir } else { $DefaultInstallDir }
$TargetBin = Join-Path $TargetDir $BinName
$DownloadUrl = "https://github.com/$Repo/releases/download/v$Version/$AssetName"

Write-Info "Downloading $AssetName..."

$TmpDir = Join-Path $env:TEMP "eidou-install-$(Get-Random)"
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
$ZipPath = Join-Path $TmpDir "eidou.zip"

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing -ErrorAction Stop
}
catch {
    Write-Err "Download failed: $DownloadUrl"
    Write-Err "The release asset may not exist for this version."
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
    exit 1
}

Write-Ok "Downloaded v$Version for windows/x86_64"

# Extract
Expand-Archive -Path $ZipPath -DestinationPath $TmpDir -Force

# Install
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$ExtractedBin = Join-Path $TmpDir $BinName
if (-not (Test-Path $ExtractedBin)) {
    Write-Err "Binary not found in archive"
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
    exit 1
}

Copy-Item -Path $ExtractedBin -Destination $TargetBin -Force
Write-Ok "Installed to $TargetBin"

# Cleanup
Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue

# Verify
try {
    $VersionOutput = & $TargetBin --version 2>&1
    Write-Ok "Verified: $VersionOutput"
}
catch {
    Write-Warn "Could not verify installation"
}

# -- MCP Client Configuration -----------------------------------------------

function Merge-McpJson {
    param(
        [string]$ConfigFile,
        [string]$ServerKey,
        [hashtable]$ServerValue
    )

    $ConfigDir = Split-Path -Parent $ConfigFile

    if (-not (Test-Path $ConfigFile)) {
        if (-not (Test-Path $ConfigDir)) {
            New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
        }
        $NewConfig = @{ $ServerKey = @{ "eidou" = $ServerValue } }
        $NewConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8
        Write-Ok "Created $ConfigFile"
        return
    }

    # Backup
    $Timestamp = [int][double]::Parse((Get-Date -UFormat %s))
    $BackupFile = "$ConfigFile.backup.$Timestamp"
    Copy-Item -Path $ConfigFile -Destination $BackupFile
    Write-Ok "Backed up to $BackupFile"

    # Read and merge
    try {
        $Config = Get-Content -Path $ConfigFile -Raw | ConvertFrom-Json

        # Ensure the server key exists
        if (-not ($Config.PSObject.Properties.Name -contains $ServerKey)) {
            $Config | Add-Member -NotePropertyName $ServerKey -NotePropertyValue ([PSCustomObject]@{}) -Force
        }

        # Add or replace the eidou entry
        $Servers = $Config.$ServerKey
        if ($Servers -is [PSCustomObject]) {
            if ($Servers.PSObject.Properties.Name -contains "eidou") {
                $Servers.PSObject.Properties.Remove("eidou")
            }
            $EidouObj = [PSCustomObject]$ServerValue
            $Servers | Add-Member -NotePropertyName "eidou" -NotePropertyValue $EidouObj -Force
        }
        else {
            # Unexpected type; replace entirely
            $NewServers = [PSCustomObject]@{ eidou = [PSCustomObject]$ServerValue }
            $Config | Add-Member -NotePropertyName $ServerKey -NotePropertyValue $NewServers -Force
        }

        $Config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8
        Write-Ok "Updated $ConfigFile"
    }
    catch {
        Write-Warn "Failed to parse config. Please update manually."
        Write-Warn "Backup saved at: $BackupFile"
    }
}

function Configure-ClaudeDesktop {
    Write-Info "Configuring Claude Desktop..."
    $ConfigFile = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
    $ServerValue = @{
        command = $TargetBin
        args    = @("--mcp-transport", "stdio")
    }
    Merge-McpJson -ConfigFile $ConfigFile -ServerKey "mcpServers" -ServerValue $ServerValue
}

function Configure-ClaudeCode {
    Write-Info "Configuring Claude Code..."
    $ClaudeCli = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $ClaudeCli) {
        Write-Warn "Claude Code CLI ('claude') not found in PATH."
        Write-Warn "Install it first, then run:"
        Write-Host ""
        Write-Host "  claude mcp add eidou $TargetBin -- --mcp-transport stdio" -ForegroundColor White
        Write-Host ""
    }
    else {
        try {
            & claude mcp add eidou $TargetBin -- --mcp-transport stdio 2>&1 | Out-Null
            Write-Ok "Added eidou to Claude Code (user scope)"
        }
        catch {
            Write-Warn "Failed to add via CLI. You can add manually:"
            Write-Host "  claude mcp add eidou $TargetBin -- --mcp-transport stdio"
        }
    }

    # Link skill for Claude Code
    Link-SkillForClient -ClientName "claude-code"
}

function Configure-OpenCode {
    Write-Info "Configuring OpenCode..."
    $ConfigFile = Join-Path $env:APPDATA "opencode\opencode.json"
    $ServerValue = @{
        type    = "local"
        command = @($TargetBin, "--mcp-transport", "stdio")
        enabled = $true
    }
    Merge-McpJson -ConfigFile $ConfigFile -ServerKey "mcp" -ServerValue $ServerValue

    # Link skill for OpenCode
    Link-SkillForClient -ClientName "opencode"
}

# -- Skill Installation (shared) --------------------------------------------

$SkillSharedDir = Join-Path $env:LOCALAPPDATA "eidou\skill\eidou-usage"

function Install-Skill {
    $SkillUrl = "https://github.com/$Repo/releases/download/v$Version/eidou-usage-skill.zip"

    Write-Info "Installing eidou-usage-skill..."

    $SkillTmp = Join-Path $env:TEMP "eidou-skill-$(Get-Random)"
    New-Item -ItemType Directory -Path $SkillTmp -Force | Out-Null
    $ZipPath = Join-Path $SkillTmp "skill.zip"

    try {
        Invoke-WebRequest -Uri $SkillUrl -OutFile $ZipPath -UseBasicParsing -ErrorAction Stop
    }
    catch {
        Write-Warn "Could not download eidou-usage-skill."
        Write-Warn "The skill asset may not exist for v$Version."
        Write-Warn "You can install it manually later."
        Remove-Item -Recurse -Force $SkillTmp -ErrorAction SilentlyContinue
        return $false
    }

    # Extract zip
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $SkillTmp -Force
    }
    catch {
        Write-Warn "Failed to extract skill package."
        Remove-Item -Recurse -Force $SkillTmp -ErrorAction SilentlyContinue
        return $false
    }

    # Install to shared directory
    if (Test-Path $SkillSharedDir) {
        Remove-Item -Recurse -Force $SkillSharedDir -ErrorAction SilentlyContinue
    }
    $SkillParent = Split-Path -Parent $SkillSharedDir
    if (-not (Test-Path $SkillParent)) {
        New-Item -ItemType Directory -Path $SkillParent -Force | Out-Null
    }
    $ExtractedSkill = Join-Path $SkillTmp "eidou-usage-skill"
    Move-Item -Path $ExtractedSkill -Destination $SkillSharedDir -Force

    Remove-Item -Recurse -Force $SkillTmp -ErrorAction SilentlyContinue

    $SkillMd = Join-Path $SkillSharedDir "SKILL.md"
    $ComposePy = Join-Path $SkillSharedDir "scripts\compose.py"
    if ((Test-Path $SkillMd) -and (Test-Path $ComposePy)) {
        Write-Ok "Installed skill to $SkillSharedDir"
        return $true
    }
    else {
        Write-Warn "Skill installation may be incomplete. Check $SkillSharedDir"
        return $false
    }
}

function Link-SkillForClient {
    param([string]$ClientName)

    switch ($ClientName) {
        "opencode" {
            $LinkTarget = Join-Path $env:APPDATA "opencode\skill\eidou-usage"
        }
        "claude-code" {
            $LinkTarget = Join-Path $env:USERPROFILE ".claude\skills\eidou-usage"
        }
        default { return }
    }

    # Remove existing
    if (Test-Path $LinkTarget) {
        Remove-Item -Recurse -Force $LinkTarget -ErrorAction SilentlyContinue
    }

    $LinkParent = Split-Path -Parent $LinkTarget
    if (-not (Test-Path $LinkParent)) {
        New-Item -ItemType Directory -Path $LinkParent -Force | Out-Null
    }

    # Try directory junction first (no admin required), fall back to copy
    try {
        New-Item -ItemType Junction -Path $LinkTarget -Target $SkillSharedDir -ErrorAction Stop | Out-Null
        Write-Ok "Linked skill: $LinkTarget -> $SkillSharedDir"
    }
    catch {
        # Fallback: copy
        Copy-Item -Path $SkillSharedDir -Destination $LinkTarget -Recurse -Force
        Write-Ok "Copied skill to $LinkTarget"
    }
}

# Run client configuration
Install-Skill

switch ($Client) {
    "claude-desktop" { Configure-ClaudeDesktop }
    "claude-code"    { Configure-ClaudeCode }
    "opencode"       { Configure-OpenCode }
}

# -- Post-install Message ----------------------------------------------------

Write-Host ""
Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host "   Eidou installed successfully" -ForegroundColor White
Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host "  Binary:   $TargetBin" -ForegroundColor Green
Write-Host "  Version:  v$Version" -ForegroundColor Green
if ($Client) {
    Write-Host "  Client:   $Client (configured)" -ForegroundColor Green
}
if (Test-Path $SkillSharedDir) {
    Write-Host "  Skill:    $SkillSharedDir" -ForegroundColor Green
}
Write-Host "  =================================================" -ForegroundColor DarkGray

# Check PATH
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$TargetDir*") {
    Write-Host ""
    Write-Warn "$TargetDir is not in your PATH."
    Write-Host "  To add it permanently, run:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    `$Path = [Environment]::GetEnvironmentVariable('PATH', 'User')" -ForegroundColor White
    Write-Host "    [Environment]::SetEnvironmentVariable('PATH', `"`$Path;$TargetDir`", 'User')" -ForegroundColor White
    Write-Host ""
}

# -- Client Guide (if no --client specified) ---------------------------------

if (-not $Client) {
    Write-Host ""
    Write-Host "  To connect Eidou to your MCP client:" -ForegroundColor White
    Write-Host ""

    # Claude Desktop
    Write-Host "  -- Claude Desktop --" -ForegroundColor DarkGray
    Write-Host "  File: $env:APPDATA\Claude\claude_desktop_config.json"
    Write-Host ""
    Write-Host "    {"
    Write-Host "      `"mcpServers`": {"
    Write-Host "        `"eidou`": {"
    Write-Host "          `"command`": `"$($TargetBin -replace '\\', '\\')`","
    Write-Host "          `"args`": [`"--mcp-transport`", `"stdio`"]"
    Write-Host "        }"
    Write-Host "      }"
    Write-Host "    }"
    Write-Host ""

    # Claude Code
    Write-Host "  -- Claude Code --" -ForegroundColor DarkGray
    Write-Host "  Run:"
    Write-Host "    claude mcp add eidou $TargetBin -- --mcp-transport stdio" -ForegroundColor White
    Write-Host ""

    # OpenCode
    Write-Host "  -- OpenCode --" -ForegroundColor DarkGray
    Write-Host "  File: $env:APPDATA\opencode\opencode.json"
    Write-Host ""
    Write-Host "    {"
    Write-Host "      `"mcp`": {"
    Write-Host "        `"eidou`": {"
    Write-Host "          `"type`": `"local`","
    Write-Host "          `"command`": [`"$($TargetBin -replace '\\', '\\')`", `"--mcp-transport`", `"stdio`"],"
    Write-Host "          `"enabled`": true"
    Write-Host "        }"
    Write-Host "      }"
    Write-Host "    }"
    Write-Host ""

    # Skill linking guide
    if (Test-Path $SkillSharedDir) {
        Write-Host "  -- Link eidou-usage-skill to your client --" -ForegroundColor DarkGray
        Write-Host "  The skill is installed at: $SkillSharedDir"
        Write-Host "  Link it to your client:"
        Write-Host ""
        Write-Host "    # OpenCode" -ForegroundColor DarkGray
        Write-Host "    New-Item -ItemType Junction -Path `"$env:APPDATA\opencode\skill\eidou-usage`" -Target `"$SkillSharedDir`""
        Write-Host ""
        Write-Host "    # Claude Code" -ForegroundColor DarkGray
        Write-Host "    New-Item -ItemType Junction -Path `"$env:USERPROFILE\.claude\skills\eidou-usage`" -Target `"$SkillSharedDir`""
        Write-Host ""
    }

    Write-Host "  Or re-run with -Client to auto-configure:" -ForegroundColor DarkGray
    Write-Host "    .\install.ps1 -Client claude-desktop"
    Write-Host ""
}
