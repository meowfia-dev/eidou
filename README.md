<div align="center">
  <strong>English</strong> | <a href="README.zh-TW.md">繁體中文</a>
  <br><br>
  <img src="src-tauri/icons/app-icon.svg" width="120" alt="Eidou" />
  <h1>Eidou</h1>
  <p><strong>Desktop UI for AI Agents, via MCP.</strong></p>
  <p>
    <a href="https://github.com/meowfia-dev/eidou/actions/workflows/ci.yml"><img src="https://github.com/meowfia-dev/eidou/actions/workflows/ci.yml/badge.svg?branch=0x0" alt="CI" /></a>
    <a href="https://github.com/meowfia-dev/eidou/releases/latest"><img src="https://img.shields.io/github/v/release/meowfia-dev/eidou" alt="Release" /></a>
    <br>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-blue" alt="Platform" />
    <img src="https://img.shields.io/badge/MCP-Compatible-green" alt="MCP Compatible" />
    <a href="https://ko-fi.com/meowfia"><img src="https://img.shields.io/badge/Ko--fi-Support%20Us-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi" /></a>
  </p>

  <video src="https://github.com/user-attachments/assets/f7fa8756-4a73-41d2-96cb-9e7452eaa97a" controls muted autoplay loop>[demo.webm](https://github.com/user-attachments/assets/f7fa8756-4a73-41d2-96cb-9e7452eaa97a)</video>
</div>

> Your AI agent has a brain. Eidou gives it a body.

AI agents can reason, plan, and execute — but they can't *show* you anything.

- **Text is low bandwidth.** Agents dump walls of text when they need a dashboard.
- **Chat is passive.** Chat windows can't collect structured input or show real-time data.
- **Custom UIs are slow.** Building a React app for every agent is a waste of time.

**Eidou fixes this.** Send JSON. Get native desktop windows. Collect user input. Any MCP-compatible agent, any language — no frontend code required.

---

## Features

- **Schema-Driven UI** — Agents send JSON, Eidou renders native desktop widgets. No frontend code needed.
- **Interactive Widgets** — Buttons, inputs, forms, grids. Collect user responses and stream events back to the agent.
- **Toast Notifications** — Fire-and-forget notifications with variant support (info, success, warning, error).
- **Blocking & Async Modes** — `show_widget` for async event streams, `show_widget_and_wait` for synchronous form collection.
- **Window Pooling** — Pre-warmed windows for instant rendering. Zero flash, zero delay.
- **Dual Transport** — Stdio for local processes, HTTP/SSE for remote or container deployments.
- **Custom Theming** — Override colors, fonts, and visual tokens via theme configuration files.
- **EUIP Validation** — Strict schema validation catches malformed UIs before they render.

---

## Architecture

```
+-----------------+        MCP (Stdio / HTTP)         +------------------+
|                 | --------------------------------> |                  |
|   MCP Client    |   show_widget / show_toast / ...  |   Eidou Daemon   |
|   (AI Agent)    | <-------------------------------- |   (Rust + Axum)  |
|                 |   eidou/user_event notifications  |                  |
+-----------------+                                   +--------+---------+
                                                               |
                                                          IPC (Tauri)
                                                               |
                                                      +--------v---------+
                                                      |                  |
                                                      |    Renderer      |
                                                      |    (React 19)    |
                                                      |                  |
                                                      |   f(EUIP) -> UI  |
                                                      |                  |
                                                      +------------------+
```

- **Host (Backend):** Rust + Tauri v2 + Axum. Window lifecycle, MCP routing, event bridging, window pooling. Transport auto-detected (Stdio when piped, SSE otherwise) or explicit via config.
- **Renderer (Frontend):** React 19 + Tailwind CSS v3 + Radix UI. Pure function `f(EUIP_JSON) -> UI`. No business logic. Schema-driven `Projection -> Field -> Content` hierarchy.

---

## Install

**One-liner (macOS / Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.ps1 | iex
```

Auto-configure your MCP client in one step:
```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/meowfia-dev/eidou/0x0/install.sh | sh -s -- --client claude-desktop

# Windows
.\install.ps1 -Client claude-desktop
```

Supported clients: `claude-desktop`, `claude-code`, `opencode`.

### Manual Download

Download the latest release from [GitHub Releases](https://github.com/meowfia-dev/eidou/releases/latest).

| Use Case | Format | Platform |
|----------|--------|----------|
| MCP Client integration | `.tar.gz` / `.zip` (portable binary) | Linux / macOS / Windows |
| GUI Daemon (install) | `.dmg` / `.exe` / `.msi` / `.deb` / `.rpm` | macOS / Windows / Linux |
| GUI Daemon (portable) | `.AppImage` / `.app.tar.gz` | Linux / macOS |

> **Note:** All builds are currently unsigned. You may see security warnings on macOS and Windows.

---

## Quick Start

### Prerequisites
- [Bun](https://bun.sh)
- [Rust](https://rustup.rs)

### Build
```bash
bun tauri build
```
This generates the binary at `src-tauri/target/release/eidou`.

### Try It
```bash
# Hello World — spawns Eidou and displays a widget
bun examples/01-hello-world/client.ts
```

See [`examples/`](examples/) for the full catalog (calculator, toasts, system monitor, theming, and more).

---

## MCP Configuration

To connect Eidou to an MCP Client (like Claude Desktop), add this to your MCP config.

> **Tip:** Eidou auto-detects transport mode: when an MCP Client spawns it (stdin is a pipe), it uses Stdio automatically. Specifying `--mcp-transport stdio` explicitly is recommended as a best practice.

### Stdio Mode (Recommended)
Replace `/ABSOLUTE/PATH/TO` with your actual path.

```json
{
  "mcpServers": {
    "eidou": {
      "command": "/ABSOLUTE/PATH/TO/eidou",
      "args": ["--mcp-transport", "stdio"],
      "env": {
        "EIDOU_POOL_SIZE": "5"
      }
    }
  }
}
```

Stdio mode handles authentication automatically — no extra configuration needed.

### HTTP/SSE Mode

First, start Eidou in HTTP mode:
```bash
./src-tauri/target/release/eidou --mcp-transport http --mcp-port 3100
```

Or, for a persistent daemon setup (double-click launch / startup item), create a config file instead of passing CLI flags. See [Daemon Mode](#daemon-mode-config-file) below.

Eidou will generate an auth token and print its location at startup. Read the token:
```bash
# Linux
cat "${XDG_RUNTIME_DIR:-$HOME/.cache}/eidou/auth-token"

# macOS
cat ~/Library/Caches/eidou/auth-token

# Windows (PowerShell)
Get-Content "$env:LOCALAPPDATA\eidou\auth-token"
```

Then configure the client with the token:
```json
{
  "mcpServers": {
    "eidou-http": {
      "endpoint": "http://localhost:3100/mcp?token=<YOUR_TOKEN>"
    }
  }
}
```

Alternatively, set a fixed token via environment variable:
```bash
EIDOU_AUTH_SECRET=my-secret-token ./src-tauri/target/release/eidou --mcp-transport http
```

> **Authentication:** HTTP mode requires a Bearer token or `?token=` query parameter on every request.
> Without `EIDOU_AUTH_SECRET`, a random token is generated per session and written to a platform-specific file.
> See [docs/protocol.md](docs/protocol.md) for full protocol details.

### Daemon Mode (Config File)

When you double-click Eidou or run it from a terminal (without piped stdin), it **automatically** starts in SSE mode on port 3100. No configuration needed for basic daemon usage.

For customization (port, auth secret, pool size, etc.), create a `config.json5` file:

| Platform | Path |
|----------|------|
| **Linux** | `~/.config/eidou/config.json5` |
| **macOS** | `~/Library/Application Support/eidou/config.json5` |
| **Windows** | `%APPDATA%\eidou\config\config.json5` |

Example `config.json5` for daemon mode:
```json5
{
  // Start as HTTP/SSE daemon instead of stdio
  mcp_transport: "sse",
  mcp_port: 3100,
}
```

**Priority order:** CLI arguments > environment variables > config file > auto-detection > built-in defaults.

If you also use Eidou with an MCP Client (stdio), add `EIDOU_MCP_TRANSPORT=stdio` to the client's env config to override the config file. See [docs/configuration.md](docs/configuration.md) for full details.

---

## Environment Variables

### Stable
| Variable | Default | Description |
|----------|---------|-------------|
| `EIDOU_MCP_TRANSPORT` | *(auto-detected)* | Transport mode: `stdio`, `http`, `sse`. Auto-detected from stdin (pipe=stdio, otherwise=sse). |
| `EIDOU_MCP_PORT` | `3100` | HTTP server port |
| `EIDOU_MCP_HTTP_STATEFUL` | `1` | HTTP stateful sessions (`1/0` or `true/false`) |
| `EIDOU_AUTH_SECRET` | *(generated)* | Fixed auth token for HTTP mode. If unset, a random token is generated. |
| `EIDOU_CONFIG` | *(none)* | Path to config.json5 (overrides default location) |
| `EIDOU_POOL_SIZE` | `5` | Widget window pool size |
| `EIDOU_TOAST_POOL_SIZE` | `3` | Toast window pool size |
| `EIDOU_USER_EVENT_QUEUE_LIMIT` | `256` | Per-session event queue limit (clamped `16..16384`) |
| `EIDOU_THEME_CONFIG` | *(none)* | Path to theme.json5 configuration file |

### Theme Configuration

Eidou supports custom visual themes via a configuration file.
See [docs/configuration.md](docs/configuration.md) for full details on theming and resolution order.

### Debug/Experimental
> Not stable; platform-dependent; may break UX.

| Variable | Default | Description |
|----------|---------|-------------|
| `EIDOU_DEBUG_WINDOW_DECORATIONS` | `false` | Show OS window decorations |
| `EIDOU_DEBUG_WINDOW_TRANSPARENT` | `true` | Transparent window background |
| `EIDOU_DEBUG_WINDOW_RESIZABLE` | `false` | Allow window resizing |
| `EIDOU_DEBUG_WINDOW_SHADOW` | `false` | Window shadow |
| `EIDOU_DEBUG_TOAST_SKIP_TASKBAR` | `true` | Hide toast from taskbar |
| `EIDOU_DEBUG_TOAST_ALWAYS_ON_TOP` | `true` | Toast always on top |
| `EIDOU_DEBUG_TOAST_WIDTH` | `320.0` | Toast width (px) |
| `EIDOU_DEBUG_TOAST_HEIGHT` | `72.0` | Toast height (px) |
| `EIDOU_DEBUG_TOAST_MARGIN_OUTER` | `24.0` | Toast outer margin (px) |
| `EIDOU_DEBUG_TOAST_SPACING` | `92.0` | Toast vertical spacing (px) |

---

## Development

### Dev Commands
| Action | Command |
|--------|---------|
| Install dependencies | `bun install` |
| Frontend dev | `bun run dev` |
| Full-stack dev | `bun run tauri dev` |
| Build | `bun run build && bun run tauri build` |
| Rust tests | `cargo test` (in `src-tauri/`) |
| Rust format | `cargo fmt` (in `src-tauri/`) |

### Customizing the Dev Port
The default Vite development port is `1420`.
If you need to change this (e.g. to `3311`), update `src-tauri/tauri.conf.json` in two places:

1.  **Build URL:** Change `build.devUrl` to your new port.
2.  **Security CSP:** Replace ALL references to `1420` with your new port in `app.security.csp` (`script-src`, `style-src`, `img-src`, `connect-src`).

*Failure to update the CSP will result in a blank white window during development.*

---

## Project Structure

| Path | Description |
|------|-------------|
| `/specification/v0_1/` | Machine-verifiable EUIP schema (JSON + Markdown). **Supreme authority.** |
| `/docs/protocol.md` | MCP tool definitions, notifications, and interaction lifecycle. |
| `/docs/configuration.md` | Theme and environment configuration guide. |
| `/docs/guidelines/` | Component standards and development guidelines. |
| `/src-tauri/` | Rust Host (Tauri v2, Axum, Window Manager). |
| `/src/` | React Renderer (Shards, Components). |
| `/examples/` | [Reference implementations](examples/) and test fixtures. |

---

## License

[MIT](LICENSE) &copy; Meowfia

<div align="center">
  <sub>Forged in the Void by Meowfia. <a href="https://ko-fi.com/meowfia">Buy us an energy drink?</a></sub>
</div>
