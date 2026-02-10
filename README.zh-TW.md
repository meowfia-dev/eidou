<div align="center">
  <a href="README.md">English</a> | <strong>繁體中文</strong>
  <br><br>
  <img src="src-tauri/icons/app-icon.svg" width="120" alt="Eidou" />
  <h1>Eidou</h1>
  <p><strong>透過 MCP，為 AI Agents 打造桌面 UI。</strong></p>
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

> 你的 AI Agent 擁有大腦。Eidou 賦予它軀體。

AI Agent 能推理、規劃、執行 — 但它沒辦法「秀」給你看。

- **文字頻寬太低。** Agent 需要 Dashboard，卻只能輸出一牆文字。
- **聊天是被動的。** 聊天視窗無法收集結構化輸入，也無法顯示即時資料。
- **自建 UI 太慢。** 為每個 Agent 寫一套 React App，浪費時間。

**Eidou 解決這件事。** 傳送 JSON，取得原生桌面視窗，收集使用者輸入。任何 MCP 相容的 Agent、任何語言 — 無需撰寫前端程式碼。

---

## 功能特色

- **Schema-Driven UI** - Agent 傳送 JSON，Eidou 渲染原生桌面 Widgets。無需撰寫 frontend 程式碼。
- **Interactive Widgets** - Buttons、inputs、forms、grids。收集使用者回應並將事件串流回 Agent。
- **Toast Notifications** - 支援 variant（info、success、warning、error）的 fire-and-forget 通知。
- **Blocking & Async Modes** - `show_widget` 用於非同步事件串流，`show_widget_and_wait` 用於同步表單收集。
- **Window Pooling** - 預熱視窗實現即時渲染。零閃爍、零延遲。
- **Dual Transport** - Stdio 適用本機程序，HTTP/SSE 適用遠端或容器部署。
- **Custom Theming** - 透過主題設定檔覆寫色彩、字體與視覺 tokens。
- **EUIP Validation** - 嚴格 schema 驗證可在渲染前攔截格式錯誤的 UI。

---

## 架構

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

- **Host (Backend):** Rust + Tauri v2 + Axum。負責視窗生命週期、MCP 路由、事件橋接、視窗池化。支援 Stdio（預設）或 HTTP/SSE transport。
- **Renderer (Frontend):** React 19 + Tailwind CSS v3 + Radix UI。純函式 `f(EUIP_JSON) -> UI`。不承載商業邏輯。採用 schema-driven 的 `Projection -> Field -> Content` 階層。

---

## 快速開始

### 先決條件
- [Bun](https://bun.sh)
- [Rust](https://rustup.rs)

### Build
```bash
bun tauri build
```
這會在 `src-tauri/target/release/eidou` 產生執行檔。

### 試跑
```bash
# Hello World — spawns Eidou and displays a widget
bun examples/01-hello-world/client.ts
```

完整範例目錄（calculator、toasts、system monitor、theming 等）請見 [`examples/`](examples/)。

---

## MCP 設定

要讓 Eidou 連接到 MCP Client（例如 Claude Desktop），請將以下內容加入你的 MCP 設定檔。

### Stdio 模式（建議）
請將 `/ABSOLUTE/PATH/TO` 替換成你的實際路徑。

```json
{
  "mcpServers": {
    "eidou": {
      "command": "/ABSOLUTE/PATH/TO/eidou/src-tauri/target/release/eidou",
      "args": [],
      "env": {
        "EIDOU_POOL_SIZE": "5"
      }
    }
  }
}
```

Stdio 模式會自動處理驗證，不需要額外設定。

### HTTP/SSE 模式

首先，以 HTTP 模式啟動 Eidou：
```bash
./src-tauri/target/release/eidou --mcp-transport http --mcp-port 3100
```

或者，若要以常駐 Daemon 方式啟動（雙擊執行 / 開機自動啟動），請建立設定檔來取代 CLI 參數。請參閱下方 [Daemon 模式](#daemon-模式設定檔)。

Eidou 會在啟動時產生 auth token 並輸出其位置。讀取 token：
```bash
# Linux
cat "${XDG_RUNTIME_DIR:-$HOME/.cache}/eidou/auth-token"

# macOS
cat ~/Library/Caches/eidou/auth-token

# Windows (PowerShell)
Get-Content "$env:LOCALAPPDATA\eidou\auth-token"
```

接著使用 token 設定 client：
```json
{
  "mcpServers": {
    "eidou-http": {
      "endpoint": "http://localhost:3100/mcp?token=<YOUR_TOKEN>"
    }
  }
}
```

或是透過環境變數指定固定 token：
```bash
EIDOU_AUTH_SECRET=my-secret-token ./src-tauri/target/release/eidou --mcp-transport http
```

> **Authentication:** HTTP 模式要求每個 request 都必須帶有 Bearer token 或 `?token=` query parameter。
> 若未設定 `EIDOU_AUTH_SECRET`，每個 session 會隨機產生 token，並寫入平台對應的檔案。
> 完整協定細節請見 [docs/protocol.md](docs/protocol.md)。

### Daemon 模式（設定檔）

如果你想直接雙擊執行檔啟動 Eidou，或是將其設為開機自動啟動（無需傳入 CLI 參數），請建立 `config.json5` 設定檔：

| 平台 | 路徑 |
|------|------|
| **Linux** | `~/.config/eidou/config.json5` |
| **macOS** | `~/Library/Application Support/eidou/config.json5` |
| **Windows** | `%APPDATA%\eidou\config\config.json5` |

Daemon 模式的 `config.json5` 範例：
```json5
{
  // 以 HTTP/SSE daemon 模式啟動，而非 stdio
  mcp_transport: "sse",
  mcp_port: 3100,
}
```

**優先順序：** CLI 參數 > 環境變數 > 設定檔 > 內建預設值。

若你同時也使用 MCP Client 以 stdio 模式連接 Eidou，請在 client 的環境變數設定中加入 `EIDOU_MCP_TRANSPORT=stdio` 來覆蓋設定檔。完整說明請見 [docs/configuration.md](docs/configuration.md)。

---

## 環境變數

### 穩定版
| Variable | Default | Description |
|----------|---------|-------------|
| `EIDOU_MCP_TRANSPORT` | `stdio` | Transport 模式：`stdio`、`http`、`sse` |
| `EIDOU_MCP_PORT` | `3100` | HTTP 伺服器埠號 |
| `EIDOU_MCP_HTTP_STATEFUL` | `1` | HTTP 有狀態 session（`1/0` 或 `true/false`） |
| `EIDOU_AUTH_SECRET` | *(generated)* | HTTP 模式固定 auth token。未設定時會隨機產生 token。 |
| `EIDOU_CONFIG` | *(none)* | `config.json5` 路徑覆蓋（取代預設位置） |
| `EIDOU_POOL_SIZE` | `5` | Widget 視窗池大小 |
| `EIDOU_TOAST_POOL_SIZE` | `3` | Toast 視窗池大小 |
| `EIDOU_USER_EVENT_QUEUE_LIMIT` | `256` | 每個 session 的事件佇列上限（限制為 `16..16384`） |
| `EIDOU_THEME_CONFIG` | *(none)* | `theme.json5` 設定檔路徑 |

### 主題設定

Eidou 支援透過設定檔自訂視覺主題。
關於 theming 與解析順序的完整細節請見 [docs/configuration.md](docs/configuration.md)。

### Debug/Experimental
> 非穩定；依平台而異；可能破壞 UX。

| Variable | Default | Description |
|----------|---------|-------------|
| `EIDOU_DEBUG_WINDOW_DECORATIONS` | `false` | 顯示 OS 視窗裝飾 |
| `EIDOU_DEBUG_WINDOW_TRANSPARENT` | `true` | 透明視窗背景 |
| `EIDOU_DEBUG_WINDOW_RESIZABLE` | `false` | 允許視窗縮放 |
| `EIDOU_DEBUG_WINDOW_SHADOW` | `false` | 視窗陰影 |
| `EIDOU_DEBUG_TOAST_SKIP_TASKBAR` | `true` | 不在 taskbar 顯示 toast |
| `EIDOU_DEBUG_TOAST_ALWAYS_ON_TOP` | `true` | Toast 永遠置頂 |
| `EIDOU_DEBUG_TOAST_WIDTH` | `320.0` | Toast 寬度（px） |
| `EIDOU_DEBUG_TOAST_HEIGHT` | `72.0` | Toast 高度（px） |
| `EIDOU_DEBUG_TOAST_MARGIN_OUTER` | `24.0` | Toast 外邊距（px） |
| `EIDOU_DEBUG_TOAST_SPACING` | `92.0` | Toast 垂直間距（px） |

---

## 開發

### 開發指令
| Action | Command |
|--------|---------|
| Install dependencies | `bun install` |
| Frontend dev | `bun run dev` |
| Full-stack dev | `bun run tauri dev` |
| Build | `bun run build && bun run tauri build` |
| Rust tests | `cargo test` (in `src-tauri/`) |
| Rust format | `cargo fmt` (in `src-tauri/`) |

### 自訂開發埠號
預設的 Vite 開發埠號是 `1420`。
若你需要改成其他埠號（例如 `3311`），請在 `src-tauri/tauri.conf.json` 的兩處同步更新：

1.  **Build URL:** 將 `build.devUrl` 改為新埠號。
2.  **Security CSP:** 在 `app.security.csp`（`script-src`、`style-src`、`img-src`、`connect-src`）中，把所有 `1420` 全部替換為新埠號。

*若未同步更新 CSP，開發期間會出現空白白屏視窗。*

---

## 專案結構

| Path | Description |
|------|-------------|
| `/specification/v0_1/` | 可機器驗證的 EUIP schema（JSON + Markdown）。**最高權威。** |
| `/docs/protocol.md` | MCP 工具定義、notifications 與互動生命週期。 |
| `/docs/configuration.md` | 主題與環境設定指南。 |
| `/docs/guidelines/` | 元件標準與開發指南。 |
| `/src-tauri/` | Rust Host（Tauri v2、Axum、Window Manager）。 |
| `/src/` | React Renderer（Shards、Components）。 |
| `/examples/` | [Reference implementations](examples/) 與測試 fixtures。 |

---

## 授權

[MIT](LICENSE) &copy; Meowfia

<div align="center">
  <sub>由 Meowfia 於虛空中鍛造。 <a href="https://ko-fi.com/meowfia">Buy us an energy drink?</a></sub>
</div>
