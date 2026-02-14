use crate::constants::{
    DEFAULT_WAIT_TIMEOUT_MS, EVENT_REQUEST_CLOSE, EVENT_RESET, HEADER_MCP_SESSION_ID,
    HEADER_X_EIDOU_SESSION_TOKEN, KEY_WIDGET_INSTANCE_ID,
};
use crate::error::EidouError;
use crate::mcp::euip_validator::validate_euip;
use crate::mcp::state::McpState;
use crate::window::layout::{resolve_position, resolve_size, resolve_toast_position};
use crate::window::render::{render_or_defer, RenderParams};

use axum::http::request::Parts;
use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, Content, ErrorData as McpError, ServerCapabilities, ServerInfo};
use rmcp::service::RequestContext;
use rmcp::RoleServer;
use rmcp::ServerHandler;
use rmcp::{tool, tool_handler, tool_router};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{json, Value};
use std::borrow::Cow;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, LogicalSize, Manager};
use uuid::Uuid;

const DEFAULT_WINDOW_TITLE: &str = "Eidou Widget";
const DEFAULT_TOAST_TITLE: &str = "Toast";

const TOAST_DEFAULT_DURATION_MS: u64 = 3000;
const CLOSE_SAFETY_TIMEOUT_MS: u64 = 1500;

use crate::window::layout::ToastLayout;

#[derive(Clone)]
pub struct EidouRouter {
    pub app: AppHandle,
    pub state: Arc<McpState>,
    pub pool_size: usize,
    pub toast_pool_size: usize,
    pub session_id: String,
    pub http_stateful: bool,
    pub toast_layout: ToastLayout,
    tool_router: ToolRouter<Self>,
}

impl EidouRouter {
    pub fn new(
        app: AppHandle,
        state: Arc<McpState>,
        pool_size: usize,
        toast_pool_size: usize,
        session_id: String,
        http_stateful: bool,
        toast_layout: ToastLayout,
    ) -> Self {
        Self {
            app,
            state,
            pool_size,
            toast_pool_size,
            session_id,
            http_stateful,
            toast_layout,
            tool_router: Self::tool_router(),
        }
    }

    fn resolve_owner_identity(&self, ctx: &RequestContext<RoleServer>) -> Result<String, McpError> {
        let Some(parts) = ctx.extensions.get::<Parts>() else {
            if self.http_stateful {
                return Ok(self.session_id.clone());
            }
            return Err(EidouError::AccessDenied(format!(
                "Missing {}",
                HEADER_X_EIDOU_SESSION_TOKEN
            ))
            .into());
        };

        if self.http_stateful {
            return header_value(parts, HEADER_MCP_SESSION_ID).ok_or_else(|| {
                EidouError::AccessDenied(format!("Missing {}", HEADER_MCP_SESSION_ID)).into()
            });
        }

        header_value(parts, HEADER_X_EIDOU_SESSION_TOKEN).ok_or_else(|| {
            EidouError::AccessDenied(format!("Missing {}", HEADER_X_EIDOU_SESSION_TOKEN)).into()
        })
    }
}

fn header_value(parts: &Parts, name: &str) -> Option<String> {
    parts
        .headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
}

#[tool_handler]
impl ServerHandler for EidouRouter {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("Eidou MCP Server".into()),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum UiInput {
    String(String),
    Object(Value),
}

// Manual JsonSchema: inline anyOf without $ref/$defs.
// Many MCP clients (including OpenCode) do not resolve $ref within
// inputSchema, so the auto-derived schema with $defs breaks tool calls.
impl JsonSchema for UiInput {
    fn schema_name() -> Cow<'static, str> {
        "UiInput".into()
    }

    fn inline_schema() -> bool {
        true
    }

    fn json_schema(_generator: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({
            "anyOf": [
                { "type": "string", "description": "EUIP JSON as a string" },
                { "type": "object", "description": "EUIP Component Tree" }
            ]
        })
    }
}

impl UiInput {
    fn try_into_value(self) -> Result<Value, String> {
        match self {
            UiInput::Object(v) => Ok(v),
            UiInput::String(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
        }
    }
}

#[derive(Deserialize, JsonSchema)]
struct ShowWidgetArgs {
    /// Client-provided Widget ID (unique per session)
    widget_id: String,
    /// EUIP Component Tree
    ui: UiInput,
    /// Window title
    #[serde(default = "default_title")]
    title: String,
    /// Whether the widget should persist beyond the default TTL (default false)
    #[serde(default)]
    persistent: bool,
}

fn default_title() -> String {
    DEFAULT_WINDOW_TITLE.to_string()
}

#[derive(Deserialize, JsonSchema)]
struct CloseWidgetArgs {
    /// The widget ID to close
    widget_id: String,
}

fn default_timeout() -> Option<u64> {
    Some(DEFAULT_WAIT_TIMEOUT_MS)
}

#[derive(Clone, Copy, Debug, Deserialize, serde::Serialize, JsonSchema, Default)]
#[serde(rename_all = "lowercase")]
enum ToastVariant {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Deserialize, JsonSchema)]
struct ShowToastArgs {
    /// Toast message
    message: String,
    /// Variant (info, success, warning, error)
    #[serde(default)]
    variant: ToastVariant,
    /// Optional title
    title: Option<String>,
    /// Optional icon
    icon: Option<String>,
    /// Duration in ms (default 3000)
    #[serde(default = "default_duration")]
    duration_ms: u64,
}

fn default_duration() -> u64 {
    TOAST_DEFAULT_DURATION_MS
}

#[derive(Deserialize, JsonSchema)]
struct ShowWidgetAndWaitArgs {
    /// Client-provided Widget ID (unique per session)
    widget_id: String,
    /// EUIP Component Tree
    ui: UiInput,
    /// Window title
    #[serde(default = "default_title")]
    title: String,
    /// Action(s) that will complete the wait. If omitted, any action completes it.
    /// MUST be a list of strings.
    until_action: Option<Vec<String>>,
    /// Timeout in milliseconds (default 60000)
    #[serde(default = "default_timeout")]
    timeout_ms: Option<u64>,
    /// Automatically close the widget when done (default true)
    #[serde(default = "default_auto_close")]
    auto_close: Option<bool>,
}

fn default_auto_close() -> Option<bool> {
    Some(true)
}

#[tool_router]
impl EidouRouter {
    #[tool(description = "Show a temporary toast notification.")]
    fn show_toast(
        &self,
        Parameters(args): Parameters<ShowToastArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session_id = self.resolve_owner_identity(&ctx)?;
        self.state
            .register_peer(session_id.clone(), ctx.peer.clone());

        // 1. Claim Toast Window
        let mut assigned_window = None;
        let mut assigned_index = 0;

        for i in 0..self.toast_pool_size {
            let label = format!("toast-{}", i);
            if self
                .state
                .claim_vacant_window(label.clone(), session_id.clone())
            {
                assigned_window = Some(label);
                assigned_index = i;
                break;
            }
        }

        let target_id = match assigned_window {
            Some(id) => id,
            None => return Err(EidouError::PoolExhausted.into()),
        };

        // Toasts are non-collecting by default
        self.state.set_collecting(target_id.clone(), false);

        let window = match self.app.get_webview_window(&target_id) {
            Some(w) => w,
            None => {
                self.state.release_window(&target_id);
                return Err(EidouError::WindowNotFound(target_id).into());
            }
        };

        // 2. Configure Window (Positioning)
        // Fixed size for toast
        let width = self.toast_layout.width;
        let height = self.toast_layout.height;
        let _ = window.set_size(LogicalSize::new(width, height));

        // Deterministic positioning (logical coordinates)
        let toast_pos = resolve_toast_position(&window, &self.toast_layout, assigned_index);
        if let Some(pos) = toast_pos {
            let _ = window.set_position(pos);
        }

        // 3. Construct UI
        // Toast projections must skip Seed and use fixed size (no auto-resize).
        let ui = json!({
            "type": "projection",
            "props": {
                "transition": { "seed": false },
                "size": { "width": width, "height": height }
            },
            "children": [{
                "type": "field",
                "children": [{
                    "type": "toast",
                    "props": {
                        "message": args.message,
                        "variant": args.variant,
                        "title": args.title,
                        "icon": args.icon
                    }
                }]
            }]
        });

        // 4. Render and Show
        // Toasts are always-on-top and transparent, so we just show them.
        // We assume frontend is ready or we just emit.
        // For toasts, we might want to ensure they are ready, but usually they are pre-warmed.
        // If not ready, we use the pending render mechanism same as widgets.

        render_or_defer(
            &window,
            &self.state,
            RenderParams {
                target_id: &target_id,
                ui: &ui,
                title: DEFAULT_TOAST_TITLE,
                size: (width, height),
                position: toast_pos,
                focus: false,
            },
        );

        // 5. Auto-release task
        let state_clone = self.state.clone();
        let target_id_clone = target_id.clone();
        let session_id_clone = session_id.clone();
        let duration = Duration::from_millis(args.duration_ms);
        let window_clone = window.clone(); // Clone handle for thread

        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(duration).await;
            tracing::info!("Auto-releasing toast: {}", target_id_clone);

            // If ownership changed, do not interfere.
            if !state_clone.check_owner(&target_id_clone, &session_id_clone) {
                tracing::info!("Skip auto-release for {} (owner changed)", target_id_clone);
                return;
            }

            // Hide first
            let _ = window_clone.hide();

            // Release logic
            state_clone.release_window(&target_id_clone);

            // Reset content
            let _ = window_clone.emit(
                EVENT_RESET,
                json!({
                    "target": target_id_clone
                }),
            );
        });

        Ok(CallToolResult::success(vec![Content::text(format!(
            "Toast shown in {}",
            target_id
        ))]))
    }

    #[tool(description = "Show widget and wait for interaction.")]
    async fn show_widget_and_wait(
        &self,
        Parameters(args): Parameters<ShowWidgetAndWaitArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session_id = self.resolve_owner_identity(&ctx)?;
        self.state
            .register_peer(session_id.clone(), ctx.peer.clone());
        let ui_val = args
            .ui
            .try_into_value()
            .map_err(|e| EidouError::InvalidParams(format!("Invalid UI JSON: {}", e)))?;

        // Validate EUIP hierarchy
        validate_euip(&ui_val)?;

        let props = ui_val.get("props");
        let size_prop = props.and_then(|p| p.get("size"));
        let pos_prop = props.and_then(|p| p.get("position"));

        // 1. Resolve or Claim Window (Upsert)
        let (target_id, is_update) = if let Some(existing) =
            self.state.resolve_window(&session_id, &args.widget_id)
        {
            (existing, true)
        } else {
            let mut assigned_window = None;
            for i in 0..self.pool_size {
                let label = format!("pool-{}", i);
                if self
                    .state
                    .claim_vacant_window(label.clone(), session_id.clone())
                {
                    assigned_window = Some(label);
                    break;
                }
            }
            let label = assigned_window.ok_or(EidouError::PoolExhausted)?;
            self.state
                .register_mapping(session_id.clone(), args.widget_id.clone(), label.clone());
            (label, false)
        };

        // Refresh TTL
        self.state.refresh_ttl(&target_id);
        // Waiting widgets are generally not persistent in terms of background,
        // but while waiting they are protected. We don't set persistent flag here usually,
        // unless we want it to survive after wait? Note says: "TTL should not kill a window while show_widget_and_wait is actively waiting".
        // This is handled by cleanup logic checking is_waiting.

        self.state.set_collecting(target_id.clone(), true);
        let widget_instance_id = Uuid::new_v4().to_string();
        self.state
            .set_window_instance(target_id.clone(), widget_instance_id.clone());

        let window = match self.app.get_webview_window(&target_id) {
            Some(w) => w,
            None => {
                self.state.release_window(&target_id);
                return Err(EidouError::WindowNotFound(target_id.clone()).into());
            }
        };

        // 2. Apply Size
        let (width, height) = resolve_size(&window, size_prop);
        let _ = window.set_size(LogicalSize::new(width, height));

        // 3. Position (logical coordinates for HiDPI correctness)
        // Skip repositioning on updates entirely. The position prop in EUIP JSON
        // is for initial placement only. Once a window is placed, its position is
        // owned by the backend/user. Only new windows get positioned.
        let position_to_set = if !is_update {
            resolve_position(&window, width, height, pos_prop)
        } else {
            None
        };
        if let Some(pos) = position_to_set {
            let _ = window.set_position(pos);
        }

        // 4. Render/Show
        render_or_defer(
            &window,
            &self.state,
            RenderParams {
                target_id: &target_id,
                ui: &ui_val,
                title: &args.title,
                size: (width, height),
                position: position_to_set,
                focus: true,
            },
        );

        // --- Wait Loop Logic ---
        let timeout_ms = args.timeout_ms.unwrap_or(DEFAULT_WAIT_TIMEOUT_MS);
        let auto_close = args.auto_close.unwrap_or(true);
        let start_instant = std::time::Instant::now();
        let notifier = self.state.get_notifier(&session_id);

        self.state.set_waiting(target_id.clone(), true);

        let mut collected_events = Vec::new();
        let mut terminated_by = "timeout";
        let mut terminating_action = None;

        // We use a block to capture the result so we can ensure cleanup happens
        let result: Result<Value, String> = async {
            loop {
                // Check diagnostic
                if let Some(event) = self.state.pop_diagnostic_notice(&session_id) {
                    collected_events.push(event);
                    terminated_by = "diagnostic";
                    break;
                }

                // Check buffered events
                // We drain all events to preserve order and check for termination
                let events = self.state.take_buffered_events(&target_id);
                let mut termination_found = false;

                for e in events {
                    let is_close = e.action == crate::constants::ACTION_CLOSE;

                    // Instance check (skip stale if not close)
                    if !is_close {
                        if let Some(val) = e.payload.get(KEY_WIDGET_INSTANCE_ID) {
                            if let Some(s) = val.as_str() {
                                if s != widget_instance_id {
                                    continue;
                                }
                            } else {
                                continue;
                            }
                        } else {
                            // If missing instance ID, we skip it to be safe/consistent with filtering
                            continue;
                        }
                    }

                    // Add to collected
                    // RFC: "do NOT include close in events" -> handled below?
                    // "close: terminated_by="closed" (do NOT include close in events)"
                    if !is_close {
                        collected_events.push(e.clone());
                    }

                    if is_close {
                        terminated_by = "closed";
                        termination_found = true;
                        break;
                    }

                    // Check until_action
                    let matches_until = match &args.until_action {
                        Some(list) => list.contains(&e.action),
                        None => true, // If no until_action, any action triggers it (old behavior?)
                                      // Note: A004 says "until_action is optional but when present must be string[] only"
                                      // If optional, what is default?
                                      // "If omitted, any action completes it." (doc comment)
                    };

                    if matches_until {
                        terminated_by = "action";
                        terminating_action = Some(e.action.clone());
                        termination_found = true;
                        break;
                    }
                }

                if termination_found {
                    break;
                }

                // Check timeout
                let elapsed = start_instant.elapsed().as_millis() as u64;
                if elapsed >= timeout_ms {
                    terminated_by = "timeout";
                    break;
                }

                let remaining = timeout_ms - elapsed;
                // Wait for notification
                let _ = tokio::time::timeout(Duration::from_millis(remaining), notifier.notified())
                    .await;
                // Loop again
            }

            // Construct RFC-aligned JSON
            let mut response = json!({
                "target_id": target_id,
                "widget_instance_id": widget_instance_id,
                "events": collected_events,
                "terminated_by": terminated_by
            });

            if let Some(act) = terminating_action {
                response
                    .as_object_mut()
                    .unwrap()
                    .insert("terminating_action".to_string(), json!(act));
            }

            Ok(response)
        }
        .await;

        // Cleanup
        self.state.set_waiting(target_id.clone(), false);
        // Note: we do NOT set collecting=false here immediately if we are NOT releasing.
        // But if auto_close=false, what is the state?
        // Usually collecting state persists.

        // Determine if we should release the window
        // "always release on closed" (window is already gone/hidden/reset by submit_action logic?)
        // Wait, submit_action for SYS_CLOSE in waiting mode HIDES but does NOT RELEASE.
        // So we MUST release here if terminated_by == "closed".
        let should_release = match terminated_by {
            "closed" => true,
            _ => auto_close,
        };

        if should_release {
            let _ = window.hide();
            self.state.release_window(&target_id);
            let _ = window.emit(EVENT_RESET, json!({"target": target_id}));
        } else {
            // If not releasing, we should probably set collecting=false?
            // "show_widget_and_wait" puts it in collecting mode.
            // If we leave it open, it should probably stay collecting if we want to support further interaction?
            // But usually show_widget_and_wait implies we are done collecting.
            self.state.set_collecting(target_id.clone(), false);
        }

        match result {
            Ok(val) => Ok(CallToolResult::success(vec![Content::text(
                serde_json::to_string(&val).map_err(EidouError::Serialization)?,
            )])),
            Err(e) => Err(EidouError::Internal(e).into()),
        }
    }

    #[tool(description = "Show an interactive widget.")]
    fn show_widget(
        &self,
        Parameters(args): Parameters<ShowWidgetArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session_id = self.resolve_owner_identity(&ctx)?;
        self.state
            .register_peer(session_id.clone(), ctx.peer.clone());
        let ui_val = args
            .ui
            .try_into_value()
            .map_err(|e| EidouError::InvalidParams(format!("Invalid UI JSON: {}", e)))?;

        // Validate EUIP hierarchy
        validate_euip(&ui_val)?;

        let props = ui_val.get("props");
        let size_prop = props.and_then(|p| p.get("size"));
        let pos_prop = props.and_then(|p| p.get("position"));

        // 1. Resolve or Claim Window (Upsert)
        let (target_id, is_update) = if let Some(existing) =
            self.state.resolve_window(&session_id, &args.widget_id)
        {
            (existing, true)
        } else {
            let mut assigned_window = None;
            for i in 0..self.pool_size {
                let label = format!("pool-{}", i);
                if self
                    .state
                    .claim_vacant_window(label.clone(), session_id.clone())
                {
                    assigned_window = Some(label);
                    break;
                }
            }
            let label = assigned_window.ok_or(EidouError::PoolExhausted)?;
            self.state
                .register_mapping(session_id.clone(), args.widget_id.clone(), label.clone());
            (label, false)
        };

        // Refresh TTL and set persistent
        self.state.refresh_ttl(&target_id);
        self.state
            .set_persistent(target_id.clone(), args.persistent);

        // Widgets are collecting by default (Interactive Phase)
        self.state.set_collecting(target_id.clone(), true);

        // Generate Widget Instance ID
        let widget_instance_id = Uuid::new_v4().to_string();
        self.state
            .set_window_instance(target_id.clone(), widget_instance_id.clone());

        let window = match self.app.get_webview_window(&target_id) {
            Some(w) => w,
            None => {
                self.state.release_window(&target_id);
                return Err(EidouError::WindowNotFound(target_id.clone()).into());
            }
        };

        // 2. Apply Size
        let (width, height) = resolve_size(&window, size_prop);
        let _ = window.set_size(LogicalSize::new(width, height));

        // 3. Calculate Position (logical coordinates for HiDPI correctness)
        // Skip repositioning on updates entirely. The position prop in EUIP JSON
        // is for initial placement only. Once a window is placed, its position is
        // owned by the backend/user. Only new windows get positioned.
        let position_to_set = if !is_update {
            resolve_position(&window, width, height, pos_prop)
        } else {
            None
        };

        if let Some(pos) = position_to_set {
            let _ = window.set_position(pos);
        }

        // 4. Defer show/render until frontend is ready (no placeholder flash)
        render_or_defer(
            &window,
            &self.state,
            RenderParams {
                target_id: &target_id,
                ui: &ui_val,
                title: &args.title,
                size: (width, height),
                position: position_to_set,
                focus: true,
            },
        );

        let result_json = json!({
            "target_id": target_id,
            "widget_instance_id": widget_instance_id
        });

        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&result_json).map_err(EidouError::Serialization)?,
        )]))
    }

    #[tool(description = "Close a widget.")]
    fn close_widget(
        &self,
        Parameters(args): Parameters<CloseWidgetArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let session_id = self.resolve_owner_identity(&ctx)?;
        self.state
            .register_peer(session_id.clone(), ctx.peer.clone());

        let target_id = self
            .state
            .resolve_window(&session_id, &args.widget_id)
            .ok_or_else(|| EidouError::WindowNotFound(args.widget_id.clone()))?;

        // Note: Owner check is implicit in resolve_window logic (client_mapping keyed by session_id)
        // But double check doesn't hurt if we had direct window access
        // Here we just use target_id found via session mapping.

        if let Some(window) = self.app.get_webview_window(&target_id) {
            // Graceful close: ask React to play exit animation first.
            // React will call finalize_close when animation completes.
            let _ = window.emit(EVENT_REQUEST_CLOSE, json!({ "window_label": target_id }));

            // Safety timeout: force-close if React never calls finalize_close
            // (e.g. crash, stuck animation, pre-IDLE phase that skips to VOID).
            let app_handle = self.app.clone();
            let state_clone = self.state.clone();
            let target_clone = target_id.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(CLOSE_SAFETY_TIMEOUT_MS)).await;
                // Check if the window is still owned (not yet finalized)
                if state_clone.get_owner(&target_clone).is_some() {
                    tracing::warn!(
                        "[Eidou] close_widget safety timeout: force-closing {}",
                        target_clone
                    );
                    state_clone.release_window(&target_clone);
                    if let Some(w) = app_handle.get_webview_window(&target_clone) {
                        let _ = w.emit(EVENT_RESET, json!({ "target": target_clone }));
                        let _ = w.hide();
                    }
                }
            });

            Ok(CallToolResult::success(vec![Content::text(
                "Widget closing",
            )]))
        } else {
            Err(EidouError::WindowNotFound(target_id.clone()).into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::from_str;

    #[test]
    fn test_show_widget_args_string_ui() {
        // Claude Desktop sends ui as string
        let json_str = r#"{
            "widget_id": "test-1",
            "ui": "{\"type\": \"projection\", \"props\": {}}",
            "title": "Test"
        }"#;
        let args: ShowWidgetArgs = from_str(json_str).unwrap();
        match args.ui {
            UiInput::String(_) => {}
            _ => panic!("Expected UiInput::String"),
        }

        // Verify parsing to value
        let val = args.ui.try_into_value().unwrap();
        assert!(val.is_object());
        assert_eq!(val["type"], "projection");
    }

    #[test]
    fn test_show_widget_args_object_ui() {
        // Standard client sends ui as object
        let json_str = r#"{
            "widget_id": "test-2",
            "ui": {
                "type": "projection",
                "props": {}
            },
            "title": "Test"
        }"#;
        let args: ShowWidgetArgs = from_str(json_str).unwrap();
        match args.ui {
            UiInput::Object(_) => {}
            _ => panic!("Expected UiInput::Object"),
        }

        // Verify parsing to value
        let val = args.ui.try_into_value().unwrap();
        assert!(val.is_object());
        assert_eq!(val["type"], "projection");
    }

    #[test]
    fn test_show_widget_args_schema_no_refs() {
        use schemars::generate::SchemaSettings;

        let mut settings = SchemaSettings::draft2020_12();
        settings.transforms = vec![Box::new(schemars::transform::AddNullable::default())];
        let generator = settings.into_generator();
        let schema = generator.into_root_schema_for::<ShowWidgetArgs>();
        let json = serde_json::to_string_pretty(&schema).unwrap();

        // Schema must NOT contain $ref or $defs (breaks MCP clients)
        assert!(
            !json.contains("\"$ref\""),
            "Schema must not use $ref (MCP clients cannot resolve it)"
        );
        assert!(!json.contains("\"$defs\""), "Schema must not contain $defs");

        // ui property must have inline anyOf
        let val: Value = serde_json::from_str(&json).unwrap();
        let ui_prop = &val["properties"]["ui"];
        assert!(
            ui_prop.get("anyOf").is_some(),
            "ui property must have inline anyOf"
        );
    }

    #[test]
    fn test_show_widget_and_wait_args_schema_no_refs() {
        use schemars::generate::SchemaSettings;

        let mut settings = SchemaSettings::draft2020_12();
        settings.transforms = vec![Box::new(schemars::transform::AddNullable::default())];
        let generator = settings.into_generator();
        let schema = generator.into_root_schema_for::<ShowWidgetAndWaitArgs>();
        let json = serde_json::to_string_pretty(&schema).unwrap();

        assert!(
            !json.contains("\"$ref\""),
            "ShowWidgetAndWaitArgs schema must not use $ref"
        );
        assert!(
            !json.contains("\"$defs\""),
            "ShowWidgetAndWaitArgs schema must not contain $defs"
        );
    }
}
