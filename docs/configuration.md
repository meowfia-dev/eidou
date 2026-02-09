# Eidou Configuration

This document outlines how to configure the Eidou Host, including environment variables, daemon configuration, and theme customization.

## Configuration Resolution

Eidou uses a hierarchical configuration system. Values are resolved in the following order (highest priority first):

1.  **CLI Arguments**: Flags passed directly to the binary (e.g., `--mcp-transport sse`).
2.  **Environment Variables**: Variables set in the shell (e.g., `EIDOU_MCP_TRANSPORT=sse`).
3.  **Config File**: `config.json5` in the OS-standard config directory.
4.  **Built-in Defaults**: Hardcoded values in the Eidou binary.

---

## Daemon Configuration (config.json5)

Eidou supports two primary deployment modes:

- **Stdio Mode** (default): An MCP Client (Claude Desktop, Cursor, etc.) spawns Eidou as a subprocess. Communication flows over stdin/stdout.
- **Daemon Mode**: The user launches Eidou directly (double-click, startup item, etc.). It runs as a System Tray daemon. MCP Clients connect over HTTP/SSE.

To use Daemon Mode without CLI arguments or environment variables, create a `config.json5` file.

### Config File Location

| Platform | Path |
|----------|------|
| **Linux** | `~/.config/eidou/config.json5` |
| **macOS** | `~/Library/Application Support/eidou/config.json5` |
| **Windows** | `%APPDATA%\eidou\config\config.json5` |

The config file path can be overridden with the `EIDOU_CONFIG` environment variable.

### Config File Format

The configuration file uses **JSON5** syntax (comments allowed). All fields are optional; only specified keys override the built-in defaults.

```json5
{
  // MCP transport mode: "stdio", "http", "sse"
  // Default: "stdio"
  mcp_transport: "sse",

  // HTTP/SSE server port
  // Default: 3100
  mcp_port: 3100,

  // Widget window pool size
  // Default: 5
  pool_size: 5,

  // Toast window pool size
  // Default: 3
  toast_pool_size: 3,

  // HTTP stateful sessions (true/false)
  // Default: true
  mcp_http_stateful: true,

  // Per-session event queue limit (16..16384)
  // Default: 256
  user_event_queue_limit: 256,

  // Fixed auth token for HTTP/SSE mode
  // Default: auto-generated per session
  // auth_secret: "my-secret-token",

  // Path to theme configuration file
  // Default: auto-discovered (see Theme Configuration below)
  // theme_config: "/path/to/theme.json5",
}
```

### Coexisting: Daemon Mode + Stdio Agent Clients

If you have a `config.json5` that sets `mcp_transport: "sse"` for daemon use, but also want to use Eidou with an MCP Client that expects stdio, add an explicit environment variable override in the client's configuration:

```json
{
  "mcpServers": {
    "eidou": {
      "command": "/path/to/eidou",
      "env": {
        "EIDOU_MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

The environment variable takes priority over the config file, so the agent client will always get stdio mode.

> **Note:** Debug/Experimental flags (e.g., `EIDOU_DEBUG_WINDOW_DECORATIONS`) are not supported in `config.json5`. They remain available only via environment variables or CLI arguments.

---

## Theme Configuration

You can customize the visual appearance of Eidou windows (colors, border radius, mode) using a JSON5 configuration file.

### Theme Resolution Order

The path to the theme configuration file is determined as follows:

1.  `--theme-config <PATH>` CLI argument.
2.  `EIDOU_THEME_CONFIG=<PATH>` environment variable.
3.  **OS Default Path** (if the file exists):
    *   **Linux**: `~/.config/eidou/theme.json5`
    *   **macOS**: `~/Library/Application Support/eidou/theme.json5`
    *   **Windows**: `%APPDATA%\eidou\config\theme.json5`

If no file is found, the built-in CSS defaults (Neon Cyberpunk) are used.

### Theme Layering

The final visual style is composed of layers (highest priority first):

1.  **Protocol Theme** (`EUIP`): The `theme` object in the widget schema (e.g., `"theme": { "mode": "dark" }`). This sets the content's specific intent and overrides the host.
2.  **Host Theme** (`theme.json5`): User-defined overrides for colors and radii. This sets the base environment preference.
3.  **CSS Defaults** (Tailwind): The fallback values defined in the frontend's CSS/Tailwind configuration.

> **Note: Transparency by Default**
> Eidou windows are transparent. Setting `colors.bg` in `theme.json5` defines the *token* for the background color, but it does not automatically force the OS window to be opaque.
> To draw a visible surface, you must use a UI component like `Shard` or `Box` that consumes this background token.

### Configuration Schema

The configuration file uses **JSON5** syntax (comments allowed). All fields are optional; you can override only what you need.

```json5
{
  // "dark" or "light"
  mode: "dark",

  colors: {
    bg: "#000000",      // Main background
    surface: "#111111", // Card/Container background
    text: "#ffffff",    // Primary text
    primary: "#ff0000", // Accent color
    border: "#333333"   // Border color
  },

  radii: {
    base: "0.5rem"      // Base border radius (string, e.g. "0.5rem" or "8px")
  },

  // Legacy: Supported only if 'colors' and 'radii' are absent
  tokens: {
    primary: "#ff0000",
    bg: "#000000",
    text: "#ffffff",
    radius: "0.5rem",
    border: "#333333"
  }
}
```

---

## Environment Variables

See the [README](/README.md) for the authoritative list of supported environment variables.
