use crate::constants::{ACTION_CLOSE, ACTION_SYS_CLOSE, EVENT_RESET, KEY_WIDGET_INSTANCE_ID};
use crate::mcp;
use crate::mcp::types::UserEvent;

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ActionPayload {
    pub action: String,
    pub payload: serde_json::Value,
}

#[derive(serde::Serialize)]
pub struct SubmitActionAck {
    pub accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

fn inject_instance_id(mut payload: serde_json::Value, instance_id: String) -> serde_json::Value {
    if let Some(obj) = payload.as_object_mut() {
        obj.insert(
            KEY_WIDGET_INSTANCE_ID.to_string(),
            serde_json::Value::String(instance_id),
        );
        payload
    } else {
        serde_json::json!({
            "value": payload,
            KEY_WIDGET_INSTANCE_ID: instance_id
        })
    }
}

#[tauri::command]
pub fn submit_action(
    window: tauri::Window,
    state: tauri::State<Arc<mcp::state::McpState>>, // No Mutex!
    payload: ActionPayload,
) -> SubmitActionAck {
    // Check for System Events (Close)
    if payload.action == ACTION_SYS_CLOSE || payload.action == "eidou:close" {
        tracing::info!("[Eidou] System Close requested for {}", window.label());
        let is_waiting = state.is_waiting(window.label());

        // Notify owner before releasing
        if let Some(session_id) = state.get_owner(window.label()) {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            let event = UserEvent {
                source: window.label().to_string(),
                action: ACTION_CLOSE.to_string(),
                payload: serde_json::json!({}),
                timestamp,
            };

            let was_empty = state.buffer_user_event(window.label().to_string(), event.clone());

            if is_waiting {
                // If waiting, notify the waiter but do NOT pollute the global session queue
                if was_empty {
                    state.get_notifier(&session_id).notify_one();
                }
            } else if let Some((peer, notification)) = state.send_user_event(&session_id, event) {
                let session_id_clone = session_id.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = peer.send_notification(notification).await {
                        tracing::warn!(
                            "[Eidou] user_event (close) send failed for session {}: {}",
                            session_id_clone,
                            e
                        );
                    }
                });
            }
        }

        // If waiting, do NOT release yet. The waiter will see the close event and release.
        // But we MUST hide the window immediately for UX.
        if is_waiting {
            if let Err(e) = window.hide() {
                tracing::error!("Failed to hide window: {}", e);
            }
            return SubmitActionAck {
                accepted: true,
                reason: None,
            };
        }

        // Release ownership (Direct call)
        state.release_window(window.label());

        // Reset and Hide
        if let Err(e) = window.emit(
            EVENT_RESET,
            serde_json::json!({
                "target": window.label()
            }),
        ) {
            tracing::error!("Failed to emit reset event: {}", e);
        }

        if let Err(e) = window.hide() {
            tracing::error!("Failed to hide window: {}", e);
        }
        return SubmitActionAck {
            accepted: true,
            reason: None,
        };
    }

    let session_id = match state.get_owner(window.label()) {
        Some(id) => id,
        None => {
            tracing::warn!(
                "[Eidou] user_event dropped: no owner for window {}",
                window.label()
            );
            return SubmitActionAck {
                accepted: false,
                reason: Some("no_owner".to_string()),
            };
        }
    };

    if !state.is_collecting(window.label()) {
        tracing::warn!(
            "[Eidou] user_event rejected: window {} is not collecting",
            window.label()
        );
        return SubmitActionAck {
            accepted: false,
            reason: Some("not_collecting".to_string()),
        };
    }

    state.refresh_ttl(window.label());

    // Attach Widget Instance ID if available
    let mut final_payload = payload.payload;
    if let Some(instance_id) = state.get_window_instance(window.label()) {
        final_payload = inject_instance_id(final_payload, instance_id);
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let event = UserEvent {
        source: window.label().to_string(),
        action: payload.action,
        payload: final_payload,
        timestamp,
    };

    let was_empty = state.buffer_user_event(window.label().to_string(), event.clone());

    if state.is_waiting(window.label()) {
        // If waiting, notify the waiter but do NOT pollute the global session queue
        if was_empty {
            state.get_notifier(&session_id).notify_one();
        }
    } else {
        let Some((peer, notification)) = state.send_user_event(&session_id, event) else {
            // Enqueued but no push peer available (stateless or disconnected)
            // OR queue overflow / serialization error (but send_user_event returns None for those too?)
            // Wait, send_user_event returns None if:
            // 1. Peer not found (stateless/disconnected) -> Event IS enqueued/dropped based on queue logic.
            // 2. Serialization failed -> Event NOT sent, diagnostic emitted.

            // In all cases, from the frontend perspective, we accepted the submission attempt.
            // Unless it was a serialization error?
            // state.send_user_event handles queue overflow (drops oldest) and serialization error (emits diagnostic).
            // So we can say accepted: true.
            return SubmitActionAck {
                accepted: true,
                reason: None,
            };
        };

        tauri::async_runtime::spawn(async move {
            if let Err(e) = peer.send_notification(notification).await {
                tracing::warn!(
                    "[Eidou] user_event send failed for session {}: {}",
                    session_id,
                    e
                );
            }
        });
    }

    SubmitActionAck {
        accepted: true,
        reason: None,
    }
}

#[derive(serde::Deserialize)]
#[serde(tag = "strategy", rename_all = "snake_case")]
pub enum RepositionStrategy {
    Center,
    Anchor {
        anchor: String,
        #[serde(default)]
        offset_x: f64,
        #[serde(default)]
        offset_y: f64,
    },
    None,
}

#[tauri::command]
pub async fn adjust_projection_size(
    app: tauri::AppHandle,
    window_label: String,
    width: f64,
    height: f64,
    reposition: Option<RepositionStrategy>,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&window_label)
        .ok_or("Window not found")?;

    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;

    match reposition.unwrap_or(RepositionStrategy::Center) {
        RepositionStrategy::Center => {
            window.center().map_err(|e| e.to_string())?;
        }
        RepositionStrategy::Anchor {
            anchor,
            offset_x,
            offset_y,
        } => {
            if let Some(pos) = crate::window::layout::resolve_anchor_position(
                &window, width, height, &anchor, offset_x, offset_y,
            ) {
                window.set_position(pos).map_err(|e| e.to_string())?;
            } else {
                window.center().map_err(|e| e.to_string())?;
            }
        }
        RepositionStrategy::None => {}
    }

    Ok(())
}

/// Finalize a graceful close after React has played the exit animation.
///
/// Called from the frontend when the EXITING phase animation completes.
/// Releases the window from state, emits `eidou:reset`, and hides it
/// so it returns to the pool for reuse.
#[tauri::command]
pub fn finalize_close(
    app: tauri::AppHandle,
    state: tauri::State<Arc<mcp::state::McpState>>,
    window_label: String,
) {
    let Some(window) = app.get_webview_window(&window_label) else {
        tracing::warn!(
            "[Eidou] finalize_close: window {} not found (already released?)",
            window_label
        );
        return;
    };

    state.release_window(&window_label);

    if let Err(e) = window.emit(EVENT_RESET, serde_json::json!({ "target": window_label })) {
        tracing::error!("[Eidou] finalize_close: failed to emit reset: {}", e);
    }

    if let Err(e) = window.hide() {
        tracing::error!("[Eidou] finalize_close: failed to hide window: {}", e);
    }

    tracing::info!(
        "[Eidou] finalize_close: window {} released and hidden",
        window_label
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_inject_instance_id_object() {
        let payload = json!({ "foo": "bar" });
        let instance_id = "test-uuid".to_string();
        let result = inject_instance_id(payload, instance_id.clone());

        assert!(result.is_object());
        assert_eq!(result["foo"], "bar");
        assert_eq!(result[KEY_WIDGET_INSTANCE_ID], instance_id);
    }

    #[test]
    fn test_inject_instance_id_null() {
        let payload = serde_json::Value::Null;
        let instance_id = "test-uuid".to_string();
        let result = inject_instance_id(payload, instance_id.clone());

        assert!(result.is_object());
        assert_eq!(result["value"], serde_json::Value::Null);
        assert_eq!(result[KEY_WIDGET_INSTANCE_ID], instance_id);
    }

    #[test]
    fn test_inject_instance_id_string() {
        let payload = json!("hello");
        let instance_id = "test-uuid".to_string();
        let result = inject_instance_id(payload, instance_id.clone());

        assert!(result.is_object());
        assert_eq!(result["value"], "hello");
        assert_eq!(result[KEY_WIDGET_INSTANCE_ID], instance_id);
    }

    #[test]
    fn test_inject_instance_id_number() {
        let payload = json!(42);
        let instance_id = "test-uuid".to_string();
        let result = inject_instance_id(payload, instance_id.clone());

        assert!(result.is_object());
        assert_eq!(result["value"], 42);
        assert_eq!(result[KEY_WIDGET_INSTANCE_ID], instance_id);
    }

    #[test]
    fn test_inject_instance_id_array() {
        let payload = json!([1, 2, 3]);
        let instance_id = "test-uuid".to_string();
        let result = inject_instance_id(payload, instance_id.clone());

        assert!(result.is_object());
        assert_eq!(result["value"], json!([1, 2, 3]));
        assert_eq!(result[KEY_WIDGET_INSTANCE_ID], instance_id);
    }
}
