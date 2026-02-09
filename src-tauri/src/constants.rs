pub const EVENT_RENDER: &str = "eidou:render";
pub const EVENT_RESET: &str = "eidou:reset";
pub const EVENT_READY: &str = "eidou:ready";
pub const EVENT_HOST_THEME: &str = "eidou:host_theme";
pub const EVENT_REQUEST_CLOSE: &str = "eidou:request_close";

pub const ACTION_SYS_CLOSE: &str = "_eidou_sys_close";
pub const ACTION_CLOSE: &str = "close";
pub const ACTION_SYSTEM_DIAGNOSTIC: &str = "eidou/system/diagnostic";

pub const KEY_WIDGET_INSTANCE_ID: &str = "_eidou_widget_instance_id";

pub const SYSTEM_SOURCE: &str = "_eidou_system";
pub const TOPIC_USER_EVENT: &str = "eidou/user_event";

// JSON-RPC / MCP Error Codes (rmcp uses i32 for ErrorCode)
pub const ERR_INVALID_PARAMS: i32 = -32602;
pub const ERR_INTERNAL_ERROR: i32 = -32603;

// Custom Server Errors
pub const ERR_ACCESS_DENIED: i32 = -32003; // Custom within reserved range

// Headers
pub const HEADER_MCP_SESSION_ID: &str = "mcp-session-id";
pub const HEADER_X_EIDOU_SESSION_TOKEN: &str = "x-eidou-session-token";

pub const DEFAULT_WAIT_TIMEOUT_MS: u64 = 60000;

// Window defaults
pub const DEFAULT_WINDOW_WIDTH: f64 = 800.0;
pub const DEFAULT_WINDOW_HEIGHT: f64 = 600.0;

// TTL cleanup
pub const TTL_CLEANUP_INTERVAL_SECS: u64 = 60;
pub const TTL_DURATION_SECS: u64 = 300;
