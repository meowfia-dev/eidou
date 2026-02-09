# Eidou MCP Protocol Reference

> Protocol specification for Eidou's MCP interface.
> For EUIP (UI Schema) definitions, see [`/specification/v0_1/euip_schema_v0_1.md`](/specification/v0_1/euip_schema_v0_1.md).

**Version:** 0.1.0

---

## 1. Overview

Eidou exposes its capabilities as an **MCP Server** (Model Context Protocol).
AI Agents connect via **Stdio** (default) or **HTTP/SSE** transport and invoke tools to display widgets, toasts, and collect user interactions.

### Transport Modes

| Mode | Use Case | Connection |
|------|----------|------------|
| **Stdio** (default) | Local parent process | Stdin/Stdout JSON-RPC |
| **HTTP/SSE** | Remote / container / multi-client | `http://host:port/mcp` |

---

## 2. MCP Tools

### 2.1 `show_widget`

Displays an interactive widget. Returns immediately (fire-and-forget). User events are delivered asynchronously via the `eidou/user_event` notification.

**Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `widget_id` | `string` | Yes | -- | Client-provided unique identifier for this widget. |
| `ui` | `object \| string` | Yes | -- | EUIP tree (JSON object or stringified JSON). |
| `title` | `string` | No | `"Eidou Widget"` | Window title. |
| `persistent` | `boolean` | No | `false` | If true, widget survives idle TTL cleanup. |

**Returns:**

```json
{
  "target_id": "pool-0",
  "widget_instance_id": "e6b64a6a-9c8f-4c2b-9a0c-7f5c6c5b7a1f"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `target_id` | `string` | Window label assigned from the pool. |
| `widget_instance_id` | `string` | UUID v4 identifying this widget instance. Used to correlate events. |

---

### 2.2 `show_widget_and_wait`

Displays a widget and **blocks** until the interaction completes. Events are buffered locally and returned in the response (they are NOT broadcast via `eidou/user_event` during the wait).

**Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `widget_id` | `string` | Yes | -- | Client-provided unique identifier. |
| `ui` | `object \| string` | Yes | -- | EUIP tree. |
| `title` | `string` | No | `"Eidou Widget"` | Window title. |
| `until_action` | `string[]` | No | `null` | Actions that trigger completion (e.g., `["form:submit", "confirm"]`). |
| `timeout_ms` | `integer` | No | `60000` | Max wait time in milliseconds. |
| `auto_close` | `boolean` | No | `true` | Close the widget window on completion. |

**Returns:**

```json
{
  "target_id": "pool-0",
  "widget_instance_id": "e6b64a6a-...",
  "events": [ ... ],
  "terminated_by": "action",
  "terminating_action": "form:submit"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `target_id` | `string` | Window label. |
| `widget_instance_id` | `string` | Instance UUID. |
| `events` | `UserEvent[]` | All buffered events collected during the wait. |
| `terminated_by` | `string` | One of: `"action"`, `"timeout"`, `"closed"`, `"diagnostic"`. |
| `terminating_action` | `string?` | Present only when `terminated_by` is `"action"`. The action string that triggered completion. |

**Termination conditions (first match wins):**

| Condition | `terminated_by` | Description |
|-----------|-----------------|-------------|
| `until_action` match | `"action"` | A user event's `action` matched one of the `until_action` strings. |
| Timeout | `"timeout"` | `timeout_ms` elapsed. |
| Window closed | `"closed"` | User closed the window (OS close button or programmatic close). |
| System diagnostic | `"diagnostic"` | Internal error surfaced as a diagnostic event. |

---

### 2.3 `show_toast`

Displays a temporary, non-interactive notification.

**Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | `string` | Yes | -- | Toast message content. |
| `variant` | `string` | No | `"info"` | One of: `"info"`, `"success"`, `"warning"`, `"error"`. |
| `title` | `string` | No | `null` | Optional toast title. |
| `icon` | `string` | No | `null` | Optional icon name. |
| `duration_ms` | `integer` | No | `3000` | Display duration in milliseconds. |

**Behavior:**
- Auto-allocates a toast window from the toast pool.
- Auto-dismisses after `duration_ms`.
- No user interaction is collected.

---

### 2.4 `close_widget`

Closes a specific widget by its `widget_id`.

**Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `widget_id` | `string` | Yes | -- | The `widget_id` used when showing the widget. |

**Behavior:**
- Sends `eidou:request_close` to the frontend for graceful exit animation.
- Safety timeout (1500ms) forces window release if the frontend does not respond.

---

## 3. Notifications

### 3.1 `eidou/user_event`

**Direction:** Eidou (Server) -> MCP Client

Delivers user interaction events from widgets. Sent as a JSON-RPC notification (fire-and-forget, no response expected).

> **Note:** Events from widgets opened with `show_widget_and_wait` are buffered and returned in the tool response. They are NOT broadcast as `eidou/user_event` notifications during the wait.

**Payload (`UserEvent`):**

```json
{
  "source": "pool-0",
  "action": "button:click",
  "payload": {
    "value": "confirm",
    "_eidou_widget_instance_id": "e6b64a6a-..."
  },
  "timestamp": 1706500000000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Window label where the event originated (e.g., `"pool-0"`). |
| `action` | `string` | Action identifier. Recommended format: `namespace:verb` (e.g., `form:submit`, `button:click`). |
| `payload` | `object` | Event data. The backend always injects `_eidou_widget_instance_id` into this object. |
| `timestamp` | `integer` | Unix timestamp in milliseconds (set by the daemon). |

**Payload injection rules:**
- If the frontend sends an object payload: `_eidou_widget_instance_id` is added as a field.
- If the frontend sends a non-object payload: it is wrapped as `{ "value": <original>, "_eidou_widget_instance_id": "..." }`.

---

### 3.2 System Diagnostics

System diagnostic events are delivered as `UserEvent` notifications with reserved action strings.

| Action | Meaning |
|--------|---------|
| `eidou/system/diagnostic` | Internal error or warning from the daemon. |

**Diagnostic payload:**

```json
{
  "kind": "serialization_error",
  "message": "Failed to serialize widget response",
  "context": { ... }
}
```

---

## 4. Interaction Lifecycle

### 4.1 Async Flow (`show_widget`)

```
Agent                         Eidou Daemon                      User
  |                               |                               |
  |--- show_widget(schema) ------>|                               |
  |<-- { target_id, instance } ---|                               |
  |                               |--- Render Widget ------------>|
  |                               |                               |
  |                               |<-- User clicks button --------|
  |<-- eidou/user_event ----------|                               |
  |                               |                               |
  |--- close_widget(id) -------->|                               |
  |                               |--- Close window ------------->|
```

1. Agent calls `show_widget` with a EUIP schema.
2. Daemon claims a window from the pool, renders the schema, returns `target_id` + `widget_instance_id`.
3. User interacts with the widget.
4. Each interaction fires an `eidou/user_event` notification to the agent.
5. Agent calls `close_widget` when done (or the user closes the window).

### 4.2 Blocking Flow (`show_widget_and_wait`)

```
Agent                         Eidou Daemon                      User
  |                               |                               |
  |--- show_widget_and_wait ----->|                               |
  |         (blocks)              |--- Render Widget ------------>|
  |                               |                               |
  |                               |<-- User interacts ------------|
  |                               |    (events buffered)          |
  |                               |                               |
  |                               |<-- User submits / timeout ----|
  |<-- { events, terminated_by } -|                               |
  |                               |--- Auto-close window -------->|
```

1. Agent calls `show_widget_and_wait` with a EUIP schema and optional `until_action` filter.
2. Daemon renders the widget. The tool call **blocks**.
3. User events are buffered locally (not broadcast).
4. When a termination condition is met, the daemon returns all buffered events.
5. If `auto_close` is true (default), the window is released automatically.

### 4.3 Toast Flow (`show_toast`)

```
Agent                         Eidou Daemon                      User
  |                               |                               |
  |--- show_toast(msg) ---------->|                               |
  |<-- (success) ----------------|--- Show toast notification --->|
  |                               |                               |
  |                               |--- Auto-dismiss (duration) -->|
```

Toasts are non-interactive and auto-dismiss. No events are generated.

---

## 5. Reserved Action Strings

These actions are generated by the system (not user-defined):

| Action | Origin | Meaning |
|--------|--------|---------|
| `_eidou_sys_close` | Frontend | User clicked the OS window close button. |
| `eidou:close` | Frontend | Explicit close request from frontend logic. |
| `close` | Backend | Normalized close action (internal). |
| `eidou/system/diagnostic` | Backend | System diagnostic event. |

---

## 6. EUIP Validation

All `ui` payloads are validated against the EUIP schema before rendering. Invalid structures return a JSON-RPC error:

```json
{
  "code": -32602,
  "message": "EUIP Validation Failed",
  "data": {
    "code": "EUIP_VALIDATION_ERROR",
    "violations": [
      {
        "rule": "SINGLE_FIELD",
        "message": "Projection must have exactly 1 field child",
        "path": "$.children"
      }
    ],
    "hint": "EUIP hierarchy: projection -> field (exactly 1) -> shard (optional) -> layouts/atoms"
  }
}
```

For the full EUIP schema, see [`/specification/v0_1/euip_schema_v0_1.md`](/specification/v0_1/euip_schema_v0_1.md).

---

## 7. `ui` Input Handling

The `ui` parameter in `show_widget` and `show_widget_and_wait` accepts two formats:

- **JSON Object:** Passed directly as the EUIP tree.
- **JSON String:** Parsed as JSON first. This handles "double-encoded" payloads common with some LLM clients.

Both forms are validated identically after parsing.

---

*Forged in the Void by Meowfia.*
