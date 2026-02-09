use dashmap::DashMap;
use rmcp::model::{CustomNotification, ServerNotification};
use rmcp::service::Peer;
use rmcp::RoleServer;
use serde_json::Value;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Notify;

use crate::constants::{ACTION_SYSTEM_DIAGNOSTIC, SYSTEM_SOURCE, TOPIC_USER_EVENT};
use crate::mcp::types::UserEvent;

const DIAGNOSTIC_QUEUE_LIMIT: usize = 5;

#[derive(Debug, Clone)]
pub struct PendingRender {
    pub ui: Value,
    pub title: String,
    pub size: (f64, f64),
    pub position: Option<(f64, f64)>,
    pub focus: bool,
}

#[derive(Debug, Clone)]
pub struct WindowEntry {
    pub owner: String,
    pub collecting: bool,
    pub waiting: bool,
    pub persistent: bool,
    pub instance_id: Option<String>,
    pub widget_id: Option<String>,
    pub last_active: Option<Instant>,
    pub pending_render: Option<PendingRender>,
    pub buffered_events: VecDeque<UserEvent>,
    pub ready: bool,
}

impl WindowEntry {
    fn with_owner(owner: String) -> Self {
        Self {
            owner,
            collecting: true,
            waiting: false,
            persistent: false,
            instance_id: None,
            widget_id: None,
            last_active: None,
            pending_render: None,
            buffered_events: VecDeque::new(),
            ready: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct McpState {
    // Window Label -> Consolidated per-window state
    windows: Arc<DashMap<String, WindowEntry>>,

    // Session ID -> MCP peer (stdio or HTTP stateful)
    peers: Arc<DashMap<String, Peer<RoleServer>>>,

    // Session ID -> Diagnostic Notice Queue
    diagnostics: Arc<DashMap<String, VecDeque<UserEvent>>>,

    // Session ID -> Notifier
    notifiers: Arc<DashMap<String, Arc<Notify>>>,

    // HTTP stateful mode flag (false means no push routing)
    http_stateful: Arc<AtomicBool>,

    // Window Label -> Ready flag (frontend listener registered)
    window_ready: Arc<DashMap<String, bool>>,

    // (Session ID, Widget ID) -> Window Label
    client_mapping: Arc<DashMap<(String, String), String>>,

    // Configured Queue Limit
    pub queue_limit: usize,
}

impl McpState {
    pub fn with_limit(limit: usize) -> Self {
        Self {
            windows: Arc::new(DashMap::new()),
            peers: Arc::new(DashMap::new()),

            diagnostics: Arc::new(DashMap::new()),
            notifiers: Arc::new(DashMap::new()),
            http_stateful: Arc::new(AtomicBool::new(true)),
            window_ready: Arc::new(DashMap::new()),

            client_mapping: Arc::new(DashMap::new()),

            queue_limit: limit,
        }
    }

    pub fn set_http_stateful(&self, http_stateful: bool) {
        self.http_stateful.store(http_stateful, Ordering::Relaxed);
    }

    pub fn mark_window_ready(&self, window: &str) {
        self.window_ready.insert(window.to_string(), true);
        if let Some(mut entry) = self.windows.get_mut(window) {
            entry.ready = true;
        }
    }

    pub fn is_window_ready(&self, window: &str) -> bool {
        self.window_ready
            .get(window)
            .map(|v| *v.value())
            .unwrap_or(false)
    }

    pub fn set_window_instance(&self, window: String, instance_id: String) {
        match self.windows.entry(window) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().instance_id = Some(instance_id);
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.instance_id = Some(instance_id);
                entry.insert(window_entry);
            }
        }
    }

    pub fn get_window_instance(&self, window: &str) -> Option<String> {
        self.windows
            .get(window)
            .and_then(|entry| entry.instance_id.clone())
    }

    pub fn set_pending_render(&self, window: String, pending: PendingRender) {
        match self.windows.entry(window) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().pending_render = Some(pending);
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.pending_render = Some(pending);
                entry.insert(window_entry);
            }
        }
    }

    pub fn take_pending_render(&self, window: &str) -> Option<PendingRender> {
        self.windows
            .get_mut(window)
            .and_then(|mut entry| entry.pending_render.take())
    }

    /// Returns true ONLY if the window was Vacant.
    /// If Occupied (even by self), returns false.
    pub fn claim_vacant_window(&self, window: String, session: String) -> bool {
        match self.windows.entry(window.clone()) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                if entry.get().owner.is_empty() {
                    tracing::info!("Session {} claimed new window {}", session, window);
                    entry.get_mut().owner = session;
                    true
                } else {
                    false
                }
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                tracing::info!("Session {} claimed new window {}", session, window);
                let mut window_entry = WindowEntry::with_owner(session);
                window_entry.ready = self.is_window_ready(&window);
                entry.insert(window_entry);
                true
            }
        }
    }

    pub fn check_owner(&self, window: &str, session: &str) -> bool {
        match self.windows.get(window) {
            Some(entry) => !entry.owner.is_empty() && entry.owner == session,
            None => false,
        }
    }

    pub fn get_owner(&self, window: &str) -> Option<String> {
        self.windows.get(window).and_then(|entry| {
            if entry.owner.is_empty() {
                None
            } else {
                Some(entry.owner.clone())
            }
        })
    }

    pub fn register_peer(&self, session_id: String, peer: Peer<RoleServer>) {
        self.peers.insert(session_id, peer);
    }

    pub fn emit_diagnostic_notice(
        &self,
        session_id: &str,
        now_ms: u64,
        message: String,
        context: serde_json::Value,
    ) {
        let mut queue = self.diagnostics.entry(session_id.to_string()).or_default();
        if queue.len() >= DIAGNOSTIC_QUEUE_LIMIT {
            // Drop oldest
            queue.pop_front();
        }

        let event = UserEvent {
            source: SYSTEM_SOURCE.to_string(),
            action: ACTION_SYSTEM_DIAGNOSTIC.to_string(),
            payload: serde_json::json!({
                "kind": "serialization_error",
                "message": message,
                "context": context
            }),
            timestamp: now_ms,
        };

        queue.push_back(event);

        // Also notify the session so they wake up if waiting
        if let Some(notify) = self.notifiers.get(session_id) {
            notify.notify_one();
        }
    }

    pub fn pop_diagnostic_notice(&self, session_id: &str) -> Option<UserEvent> {
        self.diagnostics
            .get_mut(session_id)
            .and_then(|mut q| q.pop_front())
    }

    pub fn send_user_event(
        &self,
        session_id: &str,
        event: UserEvent,
    ) -> Option<(Peer<RoleServer>, ServerNotification)> {
        // 1. Notify
        if let Some(notify) = self.notifiers.get(session_id) {
            notify.notify_one();
        }

        // 2. Push to Peer
        self.peers
            .get(session_id)
            .and_then(|peer| match serde_json::to_value(&event) {
                Ok(json_val) => {
                    let notification = ServerNotification::CustomNotification(
                        CustomNotification::new(TOPIC_USER_EVENT, Some(json_val)),
                    );
                    Some((peer.clone(), notification))
                }
                Err(e) => {
                    let sys_now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    self.emit_diagnostic_notice(
                        session_id,
                        sys_now,
                        format!("Failed to serialize user event: {}", e),
                        serde_json::json!({
                            "source": event.source,
                            "action": event.action,
                        }),
                    );
                    None
                }
            })
    }

    pub fn get_notifier(&self, session_id: &str) -> Arc<Notify> {
        self.notifiers
            .entry(session_id.to_string())
            .or_insert_with(|| Arc::new(Notify::new()))
            .value()
            .clone()
    }

    pub fn clear_window_instance(&self, window: &str) {
        if let Some(mut entry) = self.windows.get_mut(window) {
            entry.instance_id = None;
        }
    }

    pub fn set_collecting(&self, window: String, collecting: bool) {
        match self.windows.entry(window) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().collecting = collecting;
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.collecting = collecting;
                entry.insert(window_entry);
            }
        }
    }

    pub fn is_collecting(&self, window: &str) -> bool {
        // Default true for backward compatibility (unclaimed windows accept events).
        self.windows
            .get(window)
            .map(|entry| entry.collecting)
            .unwrap_or(true)
    }

    pub fn set_waiting(&self, window: String, waiting: bool) {
        match self.windows.entry(window) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().waiting = waiting;
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.waiting = waiting;
                entry.insert(window_entry);
            }
        }
    }

    pub fn is_waiting(&self, window: &str) -> bool {
        self.windows
            .get(window)
            .map(|entry| entry.waiting)
            .unwrap_or(false)
    }

    pub fn buffer_user_event(&self, window: String, event: UserEvent) -> bool {
        if let Some(mut entry) = self.windows.get_mut(&window) {
            let queue = &mut entry.buffered_events;
            let was_empty = queue.is_empty();
            if queue.len() >= self.queue_limit {
                queue.pop_front();
                tracing::warn!("Buffered event queue overflow for window {}", window);
            }
            queue.push_back(event);
            was_empty
        } else {
            tracing::warn!(
                "Buffered event dropped because window entry is missing: {}",
                window
            );
            false
        }
    }

    pub fn take_buffered_events(&self, window: &str) -> Vec<UserEvent> {
        if let Some(mut entry) = self.windows.get_mut(window) {
            std::mem::take(&mut entry.buffered_events).into()
        } else {
            Vec::new()
        }
    }

    pub fn release_window(&self, window: &str) {
        tracing::info!("Releasing window: {}", window);
        self.clear_window_instance(window);

        // Clean up client mapping if exists
        if let Some((_, entry)) = self.windows.remove(window) {
            if !entry.owner.is_empty() {
                if let Some(widget_id) = entry.widget_id {
                    self.client_mapping.remove(&(entry.owner, widget_id));
                }
            }
        }
    }

    // --- Upsert Logic ---

    pub fn resolve_window(&self, session_id: &str, widget_id: &str) -> Option<String> {
        self.client_mapping
            .get(&(session_id.to_string(), widget_id.to_string()))
            .map(|v| v.clone())
    }

    pub fn register_mapping(&self, session_id: String, widget_id: String, window: String) {
        self.client_mapping
            .insert((session_id, widget_id.clone()), window.clone());
        match self.windows.entry(window) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().widget_id = Some(widget_id);
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.widget_id = Some(widget_id);
                entry.insert(window_entry);
            }
        }
    }

    // --- TTL Logic ---

    pub fn refresh_ttl(&self, window: &str) {
        match self.windows.entry(window.to_string()) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().last_active = Some(Instant::now());
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.last_active = Some(Instant::now());
                entry.insert(window_entry);
            }
        }
    }

    pub fn set_persistent(&self, window: String, persistent: bool) {
        match self.windows.entry(window) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                entry.get_mut().persistent = persistent;
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                let mut window_entry = WindowEntry::with_owner(String::new());
                window_entry.persistent = persistent;
                entry.insert(window_entry);
            }
        }
    }

    pub fn cleanup_expired_windows(&self, ttl_duration: std::time::Duration) -> Vec<String> {
        let now = Instant::now();
        let mut expired = Vec::new();

        for entry in self.windows.iter() {
            let window = entry.key();
            let Some(last_active) = entry.last_active else {
                continue;
            };

            // Skip persistent windows
            if entry.persistent {
                continue;
            }

            // Skip waiting windows (active interaction)
            if entry.waiting {
                continue;
            }

            if now.duration_since(last_active) > ttl_duration {
                expired.push(window.clone());
            }
        }

        expired
    }

    pub fn cleanup_session(&self, session_id: &str) {
        tracing::info!("Cleaning up session: {}", session_id);

        // 1. Release all windows owned by this session
        let windows_to_release: Vec<String> = self
            .windows
            .iter()
            .filter(|entry| entry.owner == session_id)
            .map(|entry| entry.key().clone())
            .collect();

        for window in windows_to_release {
            self.release_window(&window);
        }

        // 2. Remove peer
        self.peers.remove(session_id);

        // 3. Remove diagnostics
        self.diagnostics.remove(session_id);

        // 4. Remove notifier
        self.notifiers.remove(session_id);

        // 5. Cleanup any remaining client mappings for this session
        // (Most should be gone via release_window, but just in case)
        let mappings_to_remove: Vec<(String, String)> = self
            .client_mapping
            .iter()
            .filter(|entry| entry.key().0 == session_id)
            .map(|entry| entry.key().clone())
            .collect();

        for key in mappings_to_remove {
            self.client_mapping.remove(&key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_diagnostic_queue_logic() {
        use crate::constants::ACTION_SYSTEM_DIAGNOSTIC;

        let state = McpState::with_limit(256);
        let session = "diag-session";
        let now = 1000;

        // 1. Emit diagnostic
        state.emit_diagnostic_notice(
            session,
            now,
            "Test error".to_string(),
            serde_json::json!({"foo": "bar"}),
        );

        // 2. Pop it
        let event = state
            .pop_diagnostic_notice(session)
            .expect("Should have diagnostic");
        assert_eq!(event.action, ACTION_SYSTEM_DIAGNOSTIC);
        assert_eq!(event.payload["kind"], "serialization_error");
        assert_eq!(event.payload["message"], "Test error");
        assert_eq!(event.payload["context"]["foo"], "bar");

        // 3. Queue limit (5)
        for i in 0..10 {
            state.emit_diagnostic_notice(
                session,
                now + i,
                format!("Error {}", i),
                serde_json::Value::Null,
            );
        }

        // Should have 5 items (5-9)
        let mut count = 0;
        while let Some(e) = state.pop_diagnostic_notice(session) {
            // Validate order (oldest first)
            // First popped should be index 5 (since 0-4 dropped)
            assert_eq!(e.payload["message"], format!("Error {}", count + 5));
            count += 1;
        }
        assert_eq!(count, 5);
    }

    #[test]
    fn test_collecting_logic() {
        let state = McpState::with_limit(10);
        let window = "pool-0".to_string();

        // Default should be true
        assert!(state.is_collecting(&window));

        // Explicit false
        state.set_collecting(window.clone(), false);
        assert!(!state.is_collecting(&window));

        // Explicit true
        state.set_collecting(window.clone(), true);
        assert!(state.is_collecting(&window));

        // Release should reset (conceptually, though map removes it, defaults to true)
        state.release_window(&window);
        assert!(state.is_collecting(&window)); // Defaults to true
    }

    #[test]
    fn test_waiting_logic() {
        let state = McpState::with_limit(10);
        let window = "pool-0".to_string();

        assert!(!state.is_waiting(&window));

        state.set_waiting(window.clone(), true);
        assert!(state.is_waiting(&window));

        state.set_waiting(window.clone(), false);
        assert!(!state.is_waiting(&window));

        state.set_waiting(window.clone(), true);
        state.release_window(&window);
        assert!(!state.is_waiting(&window));
    }

    #[test]
    fn test_buffering_logic() {
        let state = McpState::with_limit(5);
        let window = "pool-0".to_string();
        let session = "session-1".to_string();

        assert!(state.claim_vacant_window(window.clone(), session));

        let event1 = UserEvent {
            source: window.clone(),
            action: "act1".into(),
            payload: serde_json::json!({}),
            timestamp: 100,
        };
        let event2 = UserEvent {
            source: window.clone(),
            action: "act2".into(),
            payload: serde_json::json!({}),
            timestamp: 200,
        };

        // Buffer events
        assert!(state.buffer_user_event(window.clone(), event1.clone())); // Was empty
        assert!(!state.buffer_user_event(window.clone(), event2.clone())); // Was not empty

        // Take them
        let buffered = state.take_buffered_events(&window);
        assert_eq!(buffered.len(), 2);
        assert_eq!(buffered[0].action, "act1");
        assert_eq!(buffered[1].action, "act2");

        // Should be empty now
        assert!(state.take_buffered_events(&window).is_empty());

        // Overflow test
        for i in 0..10 {
            let was_empty = state.buffer_user_event(
                window.clone(),
                UserEvent {
                    source: window.clone(),
                    action: format!("act-{}", i),
                    payload: serde_json::json!({}),
                    timestamp: i as u64,
                },
            );
            if i == 0 {
                assert!(was_empty);
            } else {
                assert!(!was_empty);
            }
        }
        // Limit is 5
        let buffered_overflow = state.take_buffered_events(&window);
        assert_eq!(buffered_overflow.len(), 5);
        // Should have dropped 0..4, so starts with 5
        assert_eq!(buffered_overflow[0].action, "act-5");
    }
}
