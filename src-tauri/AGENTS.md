# Eidou Backend — AGENTS.md

**Scope:** `/src-tauri/`
**Stack:** Rust + Axum + Tauri v2

---

## 1) Role & Responsibility
The Backend is the **Dumb Pipe**. It manages the physical windows and routes messages.

- **Primary Job:** Bridge `MCP (Stdio/Http/Sse)` <-> `Tauri Windows`.
- **Secondary Job:** Lifecycle Management (Open/Close windows) & Protocol Safety.
- **Invariant:** `EidouConfig` is the single source of truth.

---

## 2) Code Structure Rules

### 2.1 Configuration (`/src-tauri/src/config.rs`)
- **Single Source of Truth:** `EidouConfig` (clap-derived).
- **Injection:** Parsed once in `lib.rs`, injected into `McpState` and `WindowPool`.
- **Debug Flags:** `EIDOU_DEBUG_*` knobs allow modifying window/toast behavior.
  - Startup warns if any debug overrides are active.

### 2.2 State (`/src-tauri/src/mcp/state.rs`)
- **Consolidated Window State:** Per-window properties MUST be grouped in `WindowEntry` to ensure transactional consistency and simplified cleanup.
- **Minimal DashMaps:** Prefer a single `windows: DashMap<String, WindowEntry>` over fragmented maps.
- **Rule:** Never hold a `Mutex` across an `await` point (deadlock risk). Use DashMap's lock-free patterns.
- **Lifecycle:** `window_ready` status may remain separate to handle frontend-backend handshake races before ownership is established.

### 2.3 Window Pool (`/src-tauri/src/window/pool.rs`)
- **Initialization:** Creates a pool of hidden windows (labeled `pool-0`..`pool-N`) at startup.
- **Properties:** Windows are created with `visible(false)`.
  - OS-level flags like decorations/transparency/resizable/shadow are controlled by `EidouConfig` and may be overridden only via `EIDOU_DEBUG_*` flags.
- **Lifecycle:** Windows are **claimed** by MCP sessions via `McpState`, not created on demand.
- **Toast Layout:** Host-controlled via config (not per-call).

### 2.4 MCP & Transports (`/src-tauri/src/mcp/`)
- **Router:** `/src-tauri/src/mcp/router.rs` using `rmcp`.
- **Thin Handlers:** MCP tool handlers should be thin orchestrators, delegating logic to Layout/Render services.
- **Modes:** Controlled by `EIDOU_MCP_TRANSPORT` (stdio, http, sse).

### 2.5 Services (`/src-tauri/src/window/`)
- **Layout Service (`layout.rs`):** Single source of truth for sizing, positioning, and anchor calculations.
- **Render Service (`render.rs`):** Handles the "render-or-pending" logic to prevent race conditions during window initialization.

### 2.6 Commands (`/src-tauri/src/commands.rs`)
- **Decoupled IPC:** Tauri IPC commands (`#[tauri::command]`) MUST live in `commands.rs`, keeping `lib.rs` focused on application lifecycle and setup.

---

## 3) Protocol Invariants (Phase 3)

### 3.1 Interaction Model
- **show_widget**: Interactive (`collecting: true`). Supports real-time UX via `eidou/user_event` notifications.
- **show_widget_and_wait**: Interactive. Blocks until `until_action` matches or widget terminates.
  - Returns: `{ target_id, widget_instance_id, events, terminated_by }`
- **submit_action**: Rejects events for non-collecting windows.

### 3.2 No Mid-Wait Updates
- For real-time loops (calc, games, input mirroring), use `show_widget` and handle events via notifications, then call `show_widget` again to update UI.

---

## 4) Safety & Error Handling
- **Unified Errors:** Use `EidouError` enum (via `thiserror`) in `/src-tauri/src/error.rs` for all backend operations.
- **Implicit Conversion:** `EidouError` must implement `From` for both `McpError` and `String` to support seamless tool and command returns.
- **Runtime Safety:** No panics in runtime paths. Use `?` with `EidouError`.
- **Async/Tokio:** Use `tauri::async_runtime::spawn` for background tasks to align with Tauri's lifecycle.
- **Constants:** Drift-sensitive strings/codes live in `/src-tauri/src/constants.rs`.
- **Strict Parsing:** `EIDOU_MCP_HTTP_STATEFUL` must be a strict boolean (startup fails if invalid).
- **Docs:** Do not duplicate the full env var list here; keep `/README.md` as user-facing documentation.

---

## 5) Quality Gates (Backend)
- **ASCII-Only Code:** No emoji or non-ASCII characters in source code.
- **Zero Warnings:** Treat warnings as failures.
- **Verification:**
  - `cargo fmt --check`
  - `cargo clippy -- -D warnings`
  - `cargo test`

---

## 6) Anti-Patterns (Backend)
- **NO Brain Logic:** Do not implement "AI thinking" here. That belongs in the MCP Client.
- **NO HTML Generation:** Do not serve HTML. Serve JSON events.
- **NO Hardcoded Config:** Always read from `EidouConfig`.
- **NO Silent Failures:** Avoid `let _ = ...` for critical operations like permission settings or render emissions. Log or propagate errors.
- **NO God Modules:** Keep `lib.rs` and `router.rs` below 800 LOC by extracting logic to services/commands.

---

## 7) Commands

- **Run Full App:** `bun run tauri dev` (from Repo Root)
- **Rust Test:** `cargo test` (in `/src-tauri`)
- **Rust Fmt:** `cargo fmt` (in `/src-tauri`)
