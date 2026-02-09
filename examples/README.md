# Eidou Examples

Reference implementations demonstrating Eidou's MCP capabilities.

## Prerequisites

1. Build the Eidou binary (from project root):
   ```bash
   bun tauri build
   ```
2. For **HTTP** examples, start Eidou in HTTP mode first:
   ```bash
   EIDOU_MCP_TRANSPORT=http ./src-tauri/target/release/eidou
   ```

## Examples

| # | Name | Transport | Description |
|---|------|-----------|-------------|
| 01 | [hello-world](./01-hello-world/) | Stdio | Minimal static widget. Spawns Eidou, displays a widget, listens for user events. |
| 02 | [calculator](./02-calculator/) | Stdio | Interactive calculator with real-time UI updates on button clicks. |
| 03 | [toast](./03-toast/) | HTTP | Fires all four toast variants (info, success, warning, error) in sequence. |
| 04 | [system-monitor](./04-system-monitor/) | HTTP | Simulated real-time dashboard with periodic dynamic widget updates. |
| 05 | [carbon-arsenal](./05-carbon-arsenal/) | Stdio | High-fidelity static widget using `show_widget_and_wait` to block until session ends. |
| 06 | [pokedex](./06-pokedex/) | Stdio | Interactive selection list demonstrating custom user event actions. |
| 07 | [mission-briefing](./07-mission-briefing/) | Stdio | Blocking form workflow — waits for user submission or cancellation via `show_widget_and_wait`. |
| 08 | [strawberry-theme](./08-strawberry-theme/) | HTTP | Custom theming with multiple simultaneous widgets. |
| 99 | [test-all](./99-test-all/) | Stdio | Integration test placeholder. |

## Running

```bash
# Stdio examples (auto-spawn Eidou)
bun examples/01-hello-world/client.ts

# HTTP examples (requires Eidou running in HTTP mode)
bun examples/03-toast/client.ts
```

**Stdio** examples spawn the Eidou binary automatically — just run them.

**HTTP** examples require Eidou to be running in HTTP mode beforehand. Authentication is handled automatically via the shared auth helper (reads the token from the platform-specific `auth-token` file or `EIDOU_AUTH_SECRET` env var).

## Shared Utilities

[`shared/auth-helper.ts`](./shared/auth-helper.ts) — Discovers the Eidou auth token for HTTP transport examples. Resolution order:

1. `EIDOU_AUTH_SECRET` environment variable
2. Platform-specific `auth-token` file:
   - Linux: `$XDG_RUNTIME_DIR/eidou/auth-token` (preferred) or `$XDG_CACHE_HOME/eidou/auth-token`
   - macOS: `~/Library/Caches/eidou/auth-token`
   - Windows: `%LOCALAPPDATA%\eidou\auth-token`

## Key MCP Features by Example

| Feature | Examples |
|---------|----------|
| `show_widget` (async) | 01, 02, 04, 06, 08 |
| `show_widget_and_wait` (blocking) | 05, 07 |
| `show_toast` | 03 |
| User Events (`eidou/user_event`) | 01, 02, 04, 06 |
| Dynamic UI Updates | 02, 04 |
| Custom Theming | 08 |
| Multi-Widget | 08 |
