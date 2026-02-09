use crate::constants::EVENT_RENDER;
use crate::mcp::state::{McpState, PendingRender};
use serde_json::{json, Value};
use tauri::{Emitter, LogicalPosition, WebviewWindow};

/// Parameters for rendering or deferring a widget.
pub struct RenderParams<'a> {
    pub target_id: &'a str,
    pub ui: &'a Value,
    pub title: &'a str,
    pub size: (f64, f64),
    pub position: Option<LogicalPosition<f64>>,
    pub focus: bool,
}

/// Render a widget immediately or defer until the window reports ready.
///
/// When the window is ready, emits EVENT_RENDER, shows the window, applies
/// position, and optionally focuses. When not ready, stores a PendingRender
/// and force-shows the window to trigger JS execution (WebView2 fix).
pub fn render_or_defer(window: &WebviewWindow, state: &McpState, params: RenderParams<'_>) {
    let pos_tuple = params.position.map(|p| (p.x, p.y));

    if state.is_window_ready(params.target_id) {
        let _ = window.set_title(params.title);
        let _ = window.emit(
            EVENT_RENDER,
            json!({
                "target": params.target_id,
                "ui": params.ui
            }),
        );
        let _ = window.show();
        if let Some(pos) = params.position {
            let _ = window.set_position(pos);
        }
        if params.focus {
            let _ = window.set_focus();
        }
    } else {
        state.set_pending_render(
            params.target_id.to_string(),
            PendingRender {
                ui: params.ui.clone(),
                title: params.title.to_string(),
                size: params.size,
                position: pos_tuple,
                focus: params.focus,
            },
        );
        let _ = window.show();
        if let Some(pos) = params.position {
            let _ = window.set_position(pos);
        }
        tracing::info!(
            "Target {} pending render but shown to force JS execution",
            params.target_id
        );
    }
}
