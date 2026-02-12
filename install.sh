#!/bin/sh
# Eidou Installer -- https://github.com/meowfia-dev/eidou
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.sh | sh
#   curl -fsSL .../install.sh | sh -s -- --client claude-desktop
#   curl -fsSL .../install.sh | sh -s -- --client claude-code
#   curl -fsSL .../install.sh | sh -s -- --client opencode
#
# Options:
#   --client <name>   Configure an MCP client after install
#                     (claude-desktop, claude-code, opencode)
#   --version <tag>   Install a specific version (default: latest)
#   --install-dir <d> Override install directory
#   --help            Show this help
#
# Forged in the Void by Meowfia.

set -eu

# -- Constants ---------------------------------------------------------------

REPO="meowfia-dev/eidou"
BIN_NAME="eidou"
DEFAULT_INSTALL_DIR="$HOME/.local/bin"

# -- Colors & Output ---------------------------------------------------------

if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
    BOLD="$(tput bold 2>/dev/null || true)"
    DIM="$(tput setaf 8 2>/dev/null || true)"
    GREEN="$(tput setaf 2 2>/dev/null || true)"
    CYAN="$(tput setaf 6 2>/dev/null || true)"
    YELLOW="$(tput setaf 3 2>/dev/null || true)"
    RED="$(tput setaf 1 2>/dev/null || true)"
    RESET="$(tput sgr0 2>/dev/null || true)"
else
    BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" RESET=""
fi

info()  { printf '%s[info]%s  %s\n' "$CYAN" "$RESET" "$1"; }
ok()    { printf '%s[ ok ]%s  %s\n' "$GREEN" "$RESET" "$1"; }
warn()  { printf '%s[warn]%s  %s\n' "$YELLOW" "$RESET" "$1"; }
err()   { printf '%s[ err]%s  %s\n' "$RED" "$RESET" "$1" >&2; }

# -- Argument Parsing --------------------------------------------------------

CLIENT=""
VERSION=""
INSTALL_DIR=""

while [ $# -gt 0 ]; do
    case "$1" in
        --client)
            shift
            [ $# -eq 0 ] && { err "Missing value for --client"; exit 1; }
            CLIENT="$1"
            ;;
        --version)
            shift
            [ $# -eq 0 ] && { err "Missing value for --version"; exit 1; }
            VERSION="$1"
            ;;
        --install-dir)
            shift
            [ $# -eq 0 ] && { err "Missing value for --install-dir"; exit 1; }
            INSTALL_DIR="$1"
            ;;
        --help|-h)
            printf '%s\n' \
                "Eidou Installer -- https://github.com/meowfia-dev/eidou" \
                "" \
                "Usage:" \
                "  curl -fsSL https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.sh | sh" \
                "  curl -fsSL .../install.sh | sh -s -- --client claude-desktop" \
                "" \
                "Options:" \
                "  --client <name>   Configure an MCP client after install" \
                "                    (claude-desktop, claude-code, opencode)" \
                "  --version <tag>   Install a specific version (default: latest)" \
                "  --install-dir <d> Override install directory" \
                "  --help            Show this help"
            exit 0
            ;;
        *)
            err "Unknown option: $1"
            exit 1
            ;;
    esac
    shift
done

# Validate --client
case "$CLIENT" in
    ""|claude-desktop|claude-code|opencode) ;;
    *)
        err "Unknown client: $CLIENT"
        err "Supported: claude-desktop, claude-code, opencode"
        exit 1
        ;;
esac

# -- Platform Detection ------------------------------------------------------

detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Linux)  PLATFORM="linux" ;;
        Darwin) PLATFORM="macos" ;;
        *)      err "Unsupported OS: $OS"; exit 1 ;;
    esac

    case "$ARCH" in
        x86_64|amd64)   ARCH="x86_64" ;;
        arm64|aarch64)  ARCH="aarch64" ;;
        *)              err "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    # Linux aarch64 is not yet supported in releases
    if [ "$PLATFORM" = "linux" ] && [ "$ARCH" = "aarch64" ]; then
        err "Linux ARM64 is not yet supported. Only x86_64 builds are available."
        exit 1
    fi

    ASSET_NAME="${BIN_NAME}-${PLATFORM}-${ARCH}.tar.gz"
}

# -- Version Resolution ------------------------------------------------------

resolve_version() {
    if [ -n "$VERSION" ]; then
        # Strip leading 'v' if user provides it
        VERSION="${VERSION#v}"
        info "Using specified version: v${VERSION}"
        return
    fi

    info "Fetching latest release..."
    RELEASES_URL="https://api.github.com/repos/${REPO}/releases/latest"

    if command -v curl >/dev/null 2>&1; then
        RESPONSE="$(curl -fsSL "$RELEASES_URL" 2>/dev/null)" || {
            err "Failed to fetch latest release. Check your network or try --version <tag>"
            exit 1
        }
    elif command -v wget >/dev/null 2>&1; then
        RESPONSE="$(wget -qO- "$RELEASES_URL" 2>/dev/null)" || {
            err "Failed to fetch latest release. Check your network or try --version <tag>"
            exit 1
        }
    else
        err "Neither curl nor wget found. Cannot download."
        exit 1
    fi

    # Parse version from JSON without jq (POSIX-compatible)
    VERSION="$(printf '%s' "$RESPONSE" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/')"

    if [ -z "$VERSION" ]; then
        err "Could not determine latest version."
        err "The latest release may be a draft. Try: --version 0.2.0"
        exit 1
    fi

    ok "Latest version: v${VERSION}"
}

# -- Download & Install ------------------------------------------------------

download_and_install() {
    TARGET_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    TARGET_BIN="${TARGET_DIR}/${BIN_NAME}"

    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET_NAME}"

    info "Downloading ${ASSET_NAME}..."

    # Create temp directory
    TMPDIR="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR"' 0

    # Download
    if command -v curl >/dev/null 2>&1; then
        curl -fSL "$DOWNLOAD_URL" -o "${TMPDIR}/archive.tar.gz" 2>/dev/null || {
            err "Download failed: ${DOWNLOAD_URL}"
            err "The release asset may not exist for this platform/version."
            exit 1
        }
    else
        wget -q "$DOWNLOAD_URL" -O "${TMPDIR}/archive.tar.gz" 2>/dev/null || {
            err "Download failed: ${DOWNLOAD_URL}"
            exit 1
        }
    fi

    ok "Downloaded v${VERSION} for ${PLATFORM}/${ARCH}"

    # Extract
    tar xzf "${TMPDIR}/archive.tar.gz" -C "$TMPDIR"

    # Ensure install directory exists
    mkdir -p "$TARGET_DIR"

    # Install binary
    mv "${TMPDIR}/${BIN_NAME}" "$TARGET_BIN"
    chmod +x "$TARGET_BIN"

    ok "Installed to ${TARGET_BIN}"

    # macOS: remove quarantine attribute (unsigned binary)
    if [ "$PLATFORM" = "macos" ]; then
        if xattr -l "$TARGET_BIN" 2>/dev/null | grep -q "com.apple.quarantine"; then
            xattr -d com.apple.quarantine "$TARGET_BIN" 2>/dev/null || true
            ok "Removed macOS quarantine flag"
        fi
    fi

    # Verify
    if "$TARGET_BIN" --version >/dev/null 2>&1; then
        INSTALLED_VERSION="$("$TARGET_BIN" --version 2>/dev/null | head -1)"
        ok "Verified: ${INSTALLED_VERSION}"
    else
        warn "Could not verify installation (binary may require runtime dependencies)"
    fi
}

# -- MCP Client Configuration -----------------------------------------------

# Merges {"mcpServers":{"eidou":{...}}} into an existing JSON config file.
# Uses only POSIX tools (no jq). Handles:
#   - File does not exist -> create
#   - File exists, no mcpServers -> add key
#   - File exists, has mcpServers -> merge eidou entry
#   - Preserves other mcpServers entries
#
# This is intentionally conservative: we use simple line-based manipulation
# rather than a full JSON parser, because we cannot assume jq is available.
# For robustness, we always back up before modifying.

merge_mcp_json() {
    CONFIG_FILE="$1"
    CONFIG_DIR="$(dirname "$CONFIG_FILE")"

    EIDOU_ENTRY="\"eidou\": { \"command\": \"${TARGET_BIN}\", \"args\": [\"--mcp-transport\", \"stdio\"] }"

    # If file does not exist, create it fresh
    if [ ! -f "$CONFIG_FILE" ]; then
        mkdir -p "$CONFIG_DIR"
        printf '{\n  "mcpServers": {\n    %s\n  }\n}\n' "$EIDOU_ENTRY" > "$CONFIG_FILE"
        ok "Created ${CONFIG_FILE}"
        return
    fi

    # Back up existing file
    BACKUP="${CONFIG_FILE}.backup.$(date +%s)"
    cp "$CONFIG_FILE" "$BACKUP"
    ok "Backed up to ${BACKUP}"

    # Strategy: use jq if available, otherwise use sed-based approach
    if command -v jq >/dev/null 2>&1; then
        # jq available -- proper JSON merge
        TMPFILE="${CONFIG_FILE}.tmp.$$"
        if jq --arg bin "$TARGET_BIN" '
            .mcpServers = (.mcpServers // {}) |
            .mcpServers.eidou = {
                "command": $bin,
                "args": ["--mcp-transport", "stdio"]
            }
        ' "$CONFIG_FILE" > "$TMPFILE"; then
            mv "$TMPFILE" "$CONFIG_FILE"
            ok "Updated ${CONFIG_FILE} (via jq)"
        else
            rm -f "$TMPFILE"
            warn "jq merge failed. Please update manually."
            warn "Backup saved at: ${BACKUP}"
        fi
    else
        # No jq -- check if eidou entry already exists
        if grep -q '"eidou"' "$CONFIG_FILE" 2>/dev/null; then
            warn "Config already contains an 'eidou' entry."
            warn "Please update it manually (jq not available for safe merge)."
            warn "Backup saved at: ${BACKUP}"
            return
        fi

        # Check if mcpServers key exists
        if grep -q '"mcpServers"' "$CONFIG_FILE" 2>/dev/null; then
            warn "jq is not available for safe JSON merge."
            warn "Please add the eidou entry to mcpServers manually."
            warn "Backup saved at: ${BACKUP}"
        else
            # No mcpServers key -- this is unusual; warn and skip
            warn "Config exists but has no 'mcpServers' key."
            warn "Please add manually. Backup saved at: ${BACKUP}"
            return
        fi
    fi
}

configure_claude_desktop() {
    info "Configuring Claude Desktop..."

    case "$PLATFORM" in
        macos)  CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
        linux)  CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json" ;;
        *)      warn "Claude Desktop config path unknown for ${PLATFORM}"; return ;;
    esac

    merge_mcp_json "$CONFIG_FILE"
}

configure_claude_code() {
    info "Configuring Claude Code..."

    if ! command -v claude >/dev/null 2>&1; then
        warn "Claude Code CLI ('claude') not found in PATH."
        warn "Install it first, then run:"
        printf '\n  %sclaude mcp add eidou %s -- --mcp-transport stdio%s\n\n' \
            "$BOLD" "$TARGET_BIN" "$RESET"
    else
        claude mcp add eidou "$TARGET_BIN" -- --mcp-transport stdio 2>/dev/null && {
            ok "Added eidou to Claude Code (user scope)"
        } || {
            warn "Failed to add via CLI. You can add manually:"
            printf '\n  claude mcp add eidou %s -- --mcp-transport stdio\n\n' "$TARGET_BIN"
        }
    fi

    # Link skill for Claude Code
    link_skill_for_client "claude-code"
}

configure_opencode() {
    info "Configuring OpenCode..."

    CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"
    CONFIG_DIR="$(dirname "$CONFIG_FILE")"

    EIDOU_BLOCK="\"eidou\": { \"type\": \"local\", \"command\": [\"${TARGET_BIN}\", \"--mcp-transport\", \"stdio\"], \"enabled\": true }"

    # If file does not exist, create it fresh
    if [ ! -f "$CONFIG_FILE" ]; then
        mkdir -p "$CONFIG_DIR"
        printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "mcp": {\n    %s\n  }\n}\n' "$EIDOU_BLOCK" > "$CONFIG_FILE"
        ok "Created ${CONFIG_FILE}"
    else
        # Back up existing file
        BACKUP="${CONFIG_FILE}.backup.$(date +%s)"
        cp "$CONFIG_FILE" "$BACKUP"
        ok "Backed up to ${BACKUP}"

        if command -v jq >/dev/null 2>&1; then
            TMPFILE="${CONFIG_FILE}.tmp.$$"
            if jq --arg bin "$TARGET_BIN" '
                .mcp = (.mcp // {}) |
                .mcp.eidou = {
                    "type": "local",
                    "command": [$bin, "--mcp-transport", "stdio"],
                    "enabled": true
                }
            ' "$CONFIG_FILE" > "$TMPFILE"; then
                mv "$TMPFILE" "$CONFIG_FILE"
                ok "Updated ${CONFIG_FILE} (via jq)"
            else
                rm -f "$TMPFILE"
                warn "jq merge failed. Please update manually."
                warn "Backup saved at: ${BACKUP}"
            fi
        else
            if grep -q '"eidou"' "$CONFIG_FILE" 2>/dev/null; then
                warn "Config already contains an 'eidou' entry."
                warn "Please update it manually. Backup saved at: ${BACKUP}"
            elif grep -q '"mcp"' "$CONFIG_FILE" 2>/dev/null; then
                warn "jq is not available for safe JSON merge."
                warn "Please add the eidou entry to mcp manually."
                warn "Backup saved at: ${BACKUP}"
            else
                warn "Config exists but has no 'mcp' key."
                warn "Please add manually. Backup saved at: ${BACKUP}"
            fi
        fi
    fi

    # Link skill for OpenCode
    link_skill_for_client "opencode"
}

# -- Skill Installation (shared) --------------------------------------------

SKILL_SHARED_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/eidou/skill/eidou-usage"

install_skill() {
    SKILL_URL="https://github.com/${REPO}/releases/download/v${VERSION}/eidou-usage-skill.tar.gz"

    info "Installing eidou-usage-skill..."

    SKILL_TMP="$(mktemp -d)"

    DOWNLOAD_OK=""
    if command -v curl >/dev/null 2>&1; then
        curl -fSL "$SKILL_URL" -o "${SKILL_TMP}/skill.tar.gz" 2>/dev/null && DOWNLOAD_OK=1
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$SKILL_URL" -O "${SKILL_TMP}/skill.tar.gz" 2>/dev/null && DOWNLOAD_OK=1
    fi

    if [ -z "$DOWNLOAD_OK" ]; then
        warn "Could not download eidou-usage-skill."
        warn "The skill asset may not exist for v${VERSION}."
        warn "You can install it manually later."
        rm -rf "$SKILL_TMP"
        return 1
    fi

    # Extract (tarball contains eidou-usage-skill/ directory)
    tar xzf "${SKILL_TMP}/skill.tar.gz" -C "$SKILL_TMP"

    # Install to shared directory
    rm -rf "$SKILL_SHARED_DIR"
    mkdir -p "$(dirname "$SKILL_SHARED_DIR")"
    mv "${SKILL_TMP}/eidou-usage-skill" "$SKILL_SHARED_DIR"

    rm -rf "$SKILL_TMP"

    if [ -f "${SKILL_SHARED_DIR}/SKILL.md" ] && [ -f "${SKILL_SHARED_DIR}/scripts/compose.py" ]; then
        ok "Installed skill to ${SKILL_SHARED_DIR}"
        return 0
    else
        warn "Skill installation may be incomplete. Check ${SKILL_SHARED_DIR}"
        return 1
    fi
}

link_skill_for_client() {
    LINK_CLIENT="$1"
    case "$LINK_CLIENT" in
        opencode)
            LINK_TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skill/eidou-usage"
            ;;
        claude-code)
            LINK_TARGET="$HOME/.claude/skills/eidou-usage"
            ;;
        *)
            return
            ;;
    esac

    # Remove existing (symlink, directory, or file)
    if [ -e "$LINK_TARGET" ] || [ -L "$LINK_TARGET" ]; then
        rm -rf "$LINK_TARGET"
    fi

    mkdir -p "$(dirname "$LINK_TARGET")"
    ln -s "$SKILL_SHARED_DIR" "$LINK_TARGET"
    ok "Linked skill: ${LINK_TARGET} -> ${SKILL_SHARED_DIR}"
}

# -- Post-install Message ----------------------------------------------------

print_result() {
    printf '\n'
    printf '  %s=================================================%s\n' "$DIM" "$RESET"
    printf '  %s Eidou installed successfully%s\n' "$BOLD" "$RESET"
    printf '  %s=================================================%s\n' "$DIM" "$RESET"
    printf '  Binary:   %s%s%s\n' "$GREEN" "$TARGET_BIN" "$RESET"
    printf '  Version:  %s%s%s\n' "$GREEN" "v${VERSION}" "$RESET"

    if [ -n "$CLIENT" ]; then
        printf '  Client:   %s%s (configured)%s\n' "$GREEN" "$CLIENT" "$RESET"
    fi

    if [ -d "$SKILL_SHARED_DIR" ]; then
        printf '  Skill:    %s%s%s\n' "$GREEN" "$SKILL_SHARED_DIR" "$RESET"
    fi

    printf '  %s=================================================%s\n' "$DIM" "$RESET"

    # Check PATH
    case ":${PATH}:" in
        *":${TARGET_DIR}:"*) ;;
        *)
            printf '\n'
            warn "${TARGET_DIR} is not in your PATH."
            printf '  Add it to your shell profile:\n'
            printf '\n'
            printf '    %sexport PATH="%s:$PATH"%s\n' "$BOLD" "$TARGET_DIR" "$RESET"
            printf '\n'
            ;;
    esac
}

print_client_guide() {
    # Skip guide if a client was already configured
    [ -n "$CLIENT" ] && return

    printf '\n'
    printf '  %sTo connect Eidou to your MCP client:%s\n' "$BOLD" "$RESET"

    # -- Claude Desktop --
    printf '\n'
    printf '  %s-- Claude Desktop --%s\n' "$DIM" "$RESET"

    case "$PLATFORM" in
        macos)  CLAUDE_CFG="\$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
        linux)  CLAUDE_CFG="\${XDG_CONFIG_HOME:-\$HOME/.config}/Claude/claude_desktop_config.json" ;;
        *)      CLAUDE_CFG="(see Claude Desktop docs)" ;;
    esac

    printf '  File: %s\n' "$CLAUDE_CFG"
    printf '\n'
    printf '    {\n'
    printf '      "mcpServers": {\n'
    printf '        "eidou": {\n'
    printf '          "command": "%s",\n' "$TARGET_BIN"
    printf '          "args": ["--mcp-transport", "stdio"]\n'
    printf '        }\n'
    printf '      }\n'
    printf '    }\n'

    # -- Claude Code --
    printf '\n'
    printf '  %s-- Claude Code --%s\n' "$DIM" "$RESET"
    printf '  Run:\n'
    printf '    %sclaude mcp add eidou %s -- --mcp-transport stdio%s\n' "$BOLD" "$TARGET_BIN" "$RESET"

    # -- OpenCode --
    printf '\n'
    printf '  %s-- OpenCode --%s\n' "$DIM" "$RESET"
    printf '  File: ~/.config/opencode/opencode.json\n'
    printf '\n'
    printf '    {\n'
    printf '      "mcp": {\n'
    printf '        "eidou": {\n'
    printf '          "type": "local",\n'
    printf '          "command": ["%s", "--mcp-transport", "stdio"],\n' "$TARGET_BIN"
    printf '          "enabled": true\n'
    printf '        }\n'
    printf '      }\n'
    printf '    }\n'

    # -- Skill linking guide --
    if [ -d "$SKILL_SHARED_DIR" ]; then
        printf '\n'
        printf '  %s-- Link eidou-usage-skill to your client --%s\n' "$DIM" "$RESET"
        printf '  The skill is installed at: %s\n' "$SKILL_SHARED_DIR"
        printf '  Link it to your client:\n'
        printf '\n'
        printf '    %s# OpenCode%s\n' "$DIM" "$RESET"
        printf '    ln -sf %s ~/.config/opencode/skill/eidou-usage\n' "$SKILL_SHARED_DIR"
        printf '\n'
        printf '    %s# Claude Code%s\n' "$DIM" "$RESET"
        printf '    ln -sf %s ~/.claude/skills/eidou-usage\n' "$SKILL_SHARED_DIR"
        printf '\n'
        printf '    %s# Or in your project%s\n' "$DIM" "$RESET"
        printf '    ln -sf %s .opencode/skill/eidou-usage\n' "$SKILL_SHARED_DIR"
        printf '    ln -sf %s .claude/skills/eidou-usage\n' "$SKILL_SHARED_DIR"
    fi

    printf '\n'
    printf '  %sOr re-run with --client to auto-configure:%s\n' "$DIM" "$RESET"
    printf '    curl -fsSL https://raw.githubusercontent.com/%s/0x0/install.sh | sh -s -- --client claude-desktop\n' "$REPO"
    printf '\n'
}

# -- Main --------------------------------------------------------------------

main() {
    printf '\n  %sEidou Installer%s\n\n' "$BOLD" "$RESET"

    detect_platform
    info "Detected: ${PLATFORM}/${ARCH}"

    resolve_version
    download_and_install

    # Install skill to shared location (always)
    install_skill

    # Configure client if requested
    case "$CLIENT" in
        claude-desktop) configure_claude_desktop ;;
        claude-code)    configure_claude_code ;;
        opencode)       configure_opencode ;;
    esac

    print_result
    print_client_guide
}

main
