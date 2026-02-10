use clap::{Parser, ValueEnum};
use directories::ProjectDirs;
use std::path::PathBuf;

const QUEUE_LIMIT_DEFAULT: usize = 256;
const QUEUE_LIMIT_MIN: usize = 16;
const QUEUE_LIMIT_MAX: usize = 16384;

/// Mapping from JSON5 config key (snake_case) to environment variable name.
/// Only "stable" config keys are included; debug/experimental flags are excluded.
const CONFIG_KEY_MAP: &[(&str, &str)] = &[
    ("mcp_transport", "EIDOU_MCP_TRANSPORT"),
    ("mcp_port", "EIDOU_MCP_PORT"),
    ("pool_size", "EIDOU_POOL_SIZE"),
    ("toast_pool_size", "EIDOU_TOAST_POOL_SIZE"),
    ("mcp_http_stateful", "EIDOU_MCP_HTTP_STATEFUL"),
    ("user_event_queue_limit", "EIDOU_USER_EVENT_QUEUE_LIMIT"),
    ("auth_secret", "EIDOU_AUTH_SECRET"),
    ("theme_config", "EIDOU_THEME_CONFIG"),
];

use crate::error::EidouError;

// ...

/// Load `config.json5` from the standard config directory and inject values
/// as environment variables (only for keys that are not already set).
///
/// This MUST be called BEFORE `EidouConfig::parse()` so that clap picks up
/// the injected env vars. The effective priority becomes:
///
///   CLI args > env vars (explicit) > config file (injected) > clap defaults
///
/// # Safety note
/// `std::env::set_var` is safe in Rust Edition 2021. It will require `unsafe`
/// in Edition 2024. This function is called in `run()` before any threads are
/// spawned, so the mutation is single-threaded and sound.
pub fn inject_config_file_env() -> Result<(), EidouError> {
    let Some(config_path) = resolve_config_file_path() else {
        return Ok(());
    };

    let content = std::fs::read_to_string(&config_path).map_err(|e| {
        EidouError::Internal(format!(
            "Failed to read config file {}: {}",
            config_path.display(),
            e
        ))
    })?;

    let entries = parse_config_entries(&content).map_err(|e| {
        EidouError::Internal(format!(
            "Failed to parse config file {}: {}",
            config_path.display(),
            e
        ))
    })?;

    tracing::info!("[Eidou] Loading config from: {}", config_path.display());

    for (env_key, str_val) in &entries {
        if std::env::var(env_key).is_ok() {
            continue;
        }

        std::env::set_var(env_key, str_val);

        if *env_key == "EIDOU_AUTH_SECRET" {
            tracing::info!("[Eidou] Config: {} = [REDACTED]", env_key);
        } else {
            tracing::info!("[Eidou] Config: {} = {}", env_key, str_val);
        }
    }

    Ok(())
}

fn resolve_auto_transport(stdin_is_ipc: bool) -> &'static str {
    if stdin_is_ipc {
        "stdio"
    } else {
        "sse"
    }
}

/// Detect whether stdin is connected to an IPC channel (pipe or socket).
///
/// MCP clients (bun, Node.js, Claude Desktop, etc.) spawn child processes
/// with stdin connected via `socketpair()` (AF_UNIX), not `pipe()`.  A naive
/// `S_IFIFO`-only check misses sockets entirely.
///
/// Detection matrix:
///   - `S_IFIFO`  (pipe)   -> stdio  (shell pipe, some MCP clients)
///   - `S_IFSOCK` (socket) -> stdio  (bun, Node.js, most MCP clients)
///   - `S_IFCHR`  (tty)    -> sse    (user typed `eidou` in terminal)
///   - `S_IFCHR`  (other)  -> sse    (double-click, /dev/null, launcher)
///   - anything else        -> sse    (safe fallback)
///
/// Returns `Some(true)` if stdin is a pipe or socket (use stdio),
/// `Some(false)` otherwise (use sse),
/// `None` if detection failed entirely.
fn detect_stdin_is_ipc() -> Option<bool> {
    #[cfg(unix)]
    {
        stdin_is_ipc_unix()
    }
    #[cfg(windows)]
    {
        stdin_is_ipc_windows()
    }
    #[cfg(not(any(unix, windows)))]
    {
        None
    }
}

/// Check if stdin is an IPC channel; falls back to false on failure.
fn stdin_is_ipc() -> bool {
    detect_stdin_is_ipc().unwrap_or(false)
}

/// Unix: returns true if stdin is a pipe (`S_IFIFO`) or socket (`S_IFSOCK`).
#[cfg(unix)]
fn stdin_is_ipc_unix() -> Option<bool> {
    use std::mem::MaybeUninit;

    // SAFETY: fstat is called with fd 0 (stdin) and a valid stat buffer.
    unsafe {
        let mut stat = MaybeUninit::<libc::stat>::zeroed();
        if libc::fstat(0, stat.as_mut_ptr()) != 0 {
            return None;
        }
        let stat = stat.assume_init();
        let file_type = stat.st_mode & libc::S_IFMT;
        Some(file_type == libc::S_IFIFO || file_type == libc::S_IFSOCK)
    }
}

/// Windows: returns true if stdin is a pipe.
#[cfg(windows)]
fn stdin_is_ipc_windows() -> Option<bool> {
    const STD_INPUT_HANDLE: u32 = 0xFFFF_FFF6;
    const FILE_TYPE_PIPE: u32 = 0x0003;

    unsafe extern "system" {
        fn GetStdHandle(n_std_handle: u32) -> isize;
        fn GetFileType(h_file: isize) -> u32;
    }

    // SAFETY: Win32 handle/file-type queries are read-only operations.
    unsafe {
        let handle = GetStdHandle(STD_INPUT_HANDLE);
        if handle == 0 || handle == -1_isize {
            return None;
        }

        Some(GetFileType(handle) == FILE_TYPE_PIPE)
    }
}

/// Inject auto-detected transport into `EIDOU_MCP_TRANSPORT`.
///
/// This must be called after `inject_config_file_env()` and before
/// `EidouConfig::parse()`.
pub fn inject_autodetect_transport() {
    if std::env::var_os("EIDOU_MCP_TRANSPORT").is_some() {
        tracing::info!("[Eidou] Transport auto-detect skipped (EIDOU_MCP_TRANSPORT already set)");
        return;
    }

    let detection = detect_stdin_is_ipc();
    let is_ipc = stdin_is_ipc();
    let transport = resolve_auto_transport(is_ipc);

    tracing::info!(
        "[Eidou] Transport auto-detect result: transport={} stdin_is_ipc={} detected={}",
        transport,
        is_ipc,
        detection.is_some()
    );

    std::env::set_var("EIDOU_MCP_TRANSPORT", transport);
}

/// Parse config.json5 content and return a list of (env_key, value) pairs.
/// Returns Result with entries or strict failure.
fn parse_config_entries(content: &str) -> Result<Vec<(&'static str, String)>, String> {
    let root: serde_json::Value = json5::from_str(content).map_err(|e| e.to_string())?;

    let obj = root
        .as_object()
        .ok_or_else(|| "Config file root is not a JSON object".to_string())?;

    let mut entries = Vec::new();

    for (json_key, env_key) in CONFIG_KEY_MAP {
        if let Some(val) = obj.get(*json_key) {
            let str_val = match val {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                _ => {
                    tracing::warn!(
                        "[Eidou] Config key '{}' has unsupported type, skipping",
                        json_key
                    );
                    continue;
                }
            };
            entries.push((*env_key, str_val));
        }
    }

    Ok(entries)
}

/// Resolve the path to `config.json5`.
///
/// Resolution order:
/// 1. `EIDOU_CONFIG` env var (explicit override)
/// 2. OS standard config directory (`config_dir()/config.json5`)
fn resolve_config_file_path() -> Option<PathBuf> {
    if let Ok(path_str) = std::env::var("EIDOU_CONFIG") {
        let p = PathBuf::from(&path_str);
        if p.exists() {
            return Some(p);
        }
        tracing::warn!(
            "[Eidou] EIDOU_CONFIG points to non-existent file: {}",
            path_str
        );
    }

    if let Some(proj_dirs) = ProjectDirs::from("", "", "eidou") {
        let default_path = proj_dirs.config_dir().join("config.json5");
        if default_path.exists() {
            return Some(default_path);
        }
    }

    None
}

#[derive(Debug, Clone, ValueEnum, PartialEq)]
#[value(rename_all = "lowercase")]
pub enum TransportMode {
    Stdio,
    Http,
    Sse,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default, PartialEq)]
pub struct HostTheme {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub colors: Option<HostColors>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radii: Option<HostRadii>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<HostTokens>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default, PartialEq)]
pub struct HostColors {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bg: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub surface: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default, PartialEq)]
pub struct HostRadii {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default, PartialEq)]
pub struct HostTokens {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bg: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border: Option<String>,
}

#[derive(Parser, Debug, Clone)]
#[command(version, about, long_about = None)]
pub struct EidouConfig {
    /// MCP Transport mode: stdio or http (or sse)
    #[arg(long, env = "EIDOU_MCP_TRANSPORT", default_value = "sse")]
    pub mcp_transport: TransportMode,

    /// MCP HTTP Port
    #[arg(long, env = "EIDOU_MCP_PORT", default_value = "3100")]
    pub mcp_port: u16,

    /// Window Pool Size
    #[arg(long, env = "EIDOU_POOL_SIZE", default_value = "5")]
    pub pool_size: usize,

    /// Toast Pool Size
    #[arg(long, env = "EIDOU_TOAST_POOL_SIZE", default_value = "3")]
    pub toast_pool_size: usize,

    /// HTTP Stateful Mode (0=false, 1=true)
    #[arg(
        long,
        env = "EIDOU_MCP_HTTP_STATEFUL",
        default_value = "1",
        value_parser = parse_strict_bool
    )]
    pub mcp_http_stateful: bool,

    /// User Event Queue Limit (default 256, range 16-16384)
    #[arg(
        long,
        env = "EIDOU_USER_EVENT_QUEUE_LIMIT",
        default_value_t = QUEUE_LIMIT_DEFAULT,
        value_parser = parse_queue_limit_arg
    )]
    pub user_event_queue_limit: usize,

    /// Auth secret for HTTP/SSE transport.
    /// If set, clients must provide this as a Bearer token.
    /// If unset, a random token is generated on startup.
    #[arg(long, env = "EIDOU_AUTH_SECRET")]
    pub auth_secret: Option<String>,

    /// Theme Config Path
    #[arg(long, env = "EIDOU_THEME_CONFIG")]
    pub theme_config: Option<PathBuf>,

    /// Host Theme (Loaded from file)
    #[clap(skip)]
    pub host_theme: Option<HostTheme>,

    /// Window Decorations (default false)
    ///
    /// WARNING: Debug/Experimental flag. Platform behavior varies.
    /// Not supported as a stable API. May cause visual artifacts or broken UX.
    #[arg(
        long,
        env = "EIDOU_DEBUG_WINDOW_DECORATIONS",
        default_value = "false",
        value_parser = parse_strict_bool
    )]
    pub debug_window_decorations: bool,

    /// Window Transparent (default true)
    ///
    /// WARNING: Debug/Experimental flag. Platform behavior varies.
    /// Not supported as a stable API. Disabling transparency may look broken.
    #[arg(
        long,
        env = "EIDOU_DEBUG_WINDOW_TRANSPARENT",
        default_value = "true",
        value_parser = parse_strict_bool
    )]
    pub debug_window_transparent: bool,

    /// Window Resizable (default false)
    ///
    /// WARNING: Debug/Experimental flag. Platform behavior varies.
    /// Not supported as a stable API. Resizing relies on EUIP events, not OS chrome.
    #[arg(
        long,
        env = "EIDOU_DEBUG_WINDOW_RESIZABLE",
        default_value = "false",
        value_parser = parse_strict_bool
    )]
    pub debug_window_resizable: bool,

    /// Window Shadow (default false)
    ///
    /// WARNING: Debug/Experimental flag. Platform behavior varies.
    /// Not supported as a stable API.
    #[arg(
        long,
        env = "EIDOU_DEBUG_WINDOW_SHADOW",
        default_value = "false",
        value_parser = parse_strict_bool
    )]
    pub debug_window_shadow: bool,

    /// Toast Skip Taskbar (default true)
    ///
    /// WARNING: Debug/Experimental flag. Platform behavior varies.
    /// Not supported as a stable API.
    #[arg(
        long,
        env = "EIDOU_DEBUG_TOAST_SKIP_TASKBAR",
        default_value = "true",
        value_parser = parse_strict_bool
    )]
    pub debug_toast_skip_taskbar: bool,

    /// Toast Always On Top (default true)
    ///
    /// WARNING: Debug/Experimental flag. Platform behavior varies.
    /// Not supported as a stable API.
    #[arg(
        long,
        env = "EIDOU_DEBUG_TOAST_ALWAYS_ON_TOP",
        default_value = "true",
        value_parser = parse_strict_bool
    )]
    pub debug_toast_always_on_top: bool,

    /// Toast Width (default 320.0)
    ///
    /// WARNING: Debug/Experimental flag.
    #[arg(
        long,
        env = "EIDOU_DEBUG_TOAST_WIDTH",
        default_value = "320.0",
        value_parser = parse_strict_f64
    )]
    pub debug_toast_width: f64,

    /// Toast Height (default 72.0)
    ///
    /// WARNING: Debug/Experimental flag.
    #[arg(
        long,
        env = "EIDOU_DEBUG_TOAST_HEIGHT",
        default_value = "72.0",
        value_parser = parse_strict_f64
    )]
    pub debug_toast_height: f64,

    /// Toast Margin Outer (default 24.0)
    ///
    /// WARNING: Debug/Experimental flag.
    #[arg(
        long,
        env = "EIDOU_DEBUG_TOAST_MARGIN_OUTER",
        default_value = "24.0",
        value_parser = parse_strict_f64
    )]
    pub debug_toast_margin_outer: f64,

    /// Toast Spacing (default 92.0)
    ///
    /// WARNING: Debug/Experimental flag.
    #[arg(
        long,
        env = "EIDOU_DEBUG_TOAST_SPACING",
        default_value = "92.0",
        value_parser = parse_strict_f64
    )]
    pub debug_toast_spacing: f64,
}

fn parse_strict_bool(s: &str) -> Result<bool, String> {
    match s.to_lowercase().as_str() {
        "1" | "true" => Ok(true),
        "0" | "false" => Ok(false),
        _ => Err(format!(
            "Invalid boolean value: '{}'. Expected 1/0 or true/false.",
            s
        )),
    }
}

fn parse_strict_f64(s: &str) -> Result<f64, String> {
    s.parse::<f64>()
        .map_err(|_| format!("Invalid float value: '{}'", s))
}

fn parse_queue_limit_arg(s: &str) -> Result<usize, String> {
    // Preserves legacy behavior: invalid -> default (256), clamp 16..16384
    let val = s.parse::<usize>().unwrap_or(QUEUE_LIMIT_DEFAULT);
    Ok(val.clamp(QUEUE_LIMIT_MIN, QUEUE_LIMIT_MAX))
}

impl EidouConfig {
    pub fn get_debug_overrides(&self) -> Vec<&'static str> {
        let mut overrides = Vec::new();

        if self.debug_window_decorations {
            overrides.push("window_decorations");
        }
        if !self.debug_window_transparent {
            overrides.push("window_transparent");
        }
        if self.debug_window_resizable {
            overrides.push("window_resizable");
        }
        if self.debug_window_shadow {
            overrides.push("window_shadow");
        }
        if !self.debug_toast_skip_taskbar {
            overrides.push("toast_skip_taskbar");
        }
        if !self.debug_toast_always_on_top {
            overrides.push("toast_always_on_top");
        }
        if (self.debug_toast_width - 320.0).abs() > f64::EPSILON {
            overrides.push("toast_width");
        }
        if (self.debug_toast_height - 72.0).abs() > f64::EPSILON {
            overrides.push("toast_height");
        }
        if (self.debug_toast_margin_outer - 24.0).abs() > f64::EPSILON {
            overrides.push("toast_margin_outer");
        }
        if (self.debug_toast_spacing - 92.0).abs() > f64::EPSILON {
            overrides.push("toast_spacing");
        }

        overrides
    }

    pub fn resolve_theme_path(&self) -> Option<PathBuf> {
        if let Some(path) = &self.theme_config {
            return Some(path.clone());
        }

        if let Some(proj_dirs) = ProjectDirs::from("", "", "eidou") {
            let config_dir = proj_dirs.config_dir();
            let default_path = config_dir.join("theme.json5");
            if default_path.exists() {
                return Some(default_path);
            }
        }

        None
    }

    pub fn load_host_theme(&mut self) {
        let Some(path) = self.resolve_theme_path() else {
            return;
        };

        tracing::info!("[Eidou] Loading host theme from: {:?}", path);

        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("[Eidou] Failed to read theme config: {}", e);
                return;
            }
        };

        self.host_theme = Self::parse_host_theme(&content);
    }

    pub fn parse_host_theme(content: &str) -> Option<HostTheme> {
        let root_val: serde_json::Value = match json5::from_str(content) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("[Eidou] Failed to parse theme.json5: {}", e);
                return None;
            }
        };

        let mut theme = HostTheme::default();

        if let Some(obj) = root_val.as_object() {
            if let Some(v) = obj.get("mode") {
                if let Some(s) = v.as_str() {
                    theme.mode = Some(s.to_string());
                } else {
                    tracing::warn!("[Eidou] Theme 'mode' is not a string, ignoring.");
                }
            }

            if let Some(c) = obj.get("colors") {
                if let Some(colors_obj) = c.as_object() {
                    let mut hc = HostColors::default();
                    let extract_str = |key: &str, target: &mut Option<String>| {
                        if let Some(val) = colors_obj.get(key) {
                            if let Some(s) = val.as_str() {
                                *target = Some(s.to_string());
                            } else {
                                tracing::warn!("[Eidou] Theme colors.{} is not a string", key);
                            }
                        }
                    };
                    extract_str("bg", &mut hc.bg);
                    extract_str("surface", &mut hc.surface);
                    extract_str("text", &mut hc.text);
                    extract_str("primary", &mut hc.primary);
                    extract_str("border", &mut hc.border);
                    theme.colors = Some(hc);
                } else {
                    tracing::warn!("[Eidou] Theme 'colors' is not an object.");
                }
            }

            if let Some(r) = obj.get("radii") {
                if let Some(radii_obj) = r.as_object() {
                    let mut hr = HostRadii::default();
                    if let Some(val) = radii_obj.get("base") {
                        if let Some(s) = val.as_str() {
                            hr.base = Some(s.to_string());
                        } else if let Some(n) = val.as_f64() {
                            hr.base = Some(n.to_string());
                        } else if let Some(n) = val.as_u64() {
                            hr.base = Some(n.to_string());
                        } else {
                            tracing::warn!("[Eidou] Theme radii.base is not a string/number");
                        }
                    }
                    theme.radii = Some(hr);
                } else {
                    tracing::warn!("[Eidou] Theme 'radii' is not an object.");
                }
            }

            if let Some(t) = obj.get("tokens") {
                if let Some(tokens_obj) = t.as_object() {
                    let mut ht = HostTokens::default();
                    let extract_str = |key: &str, target: &mut Option<String>| {
                        if let Some(val) = tokens_obj.get(key) {
                            if let Some(s) = val.as_str() {
                                *target = Some(s.to_string());
                            } else {
                                tracing::warn!("[Eidou] Theme tokens.{} is not a string", key);
                            }
                        }
                    };
                    extract_str("primary", &mut ht.primary);
                    extract_str("bg", &mut ht.bg);
                    extract_str("text", &mut ht.text);
                    extract_str("radius", &mut ht.radius);
                    extract_str("border", &mut ht.border);
                    theme.tokens = Some(ht);
                } else {
                    tracing::warn!("[Eidou] Theme 'tokens' is not an object.");
                }
            }
        } else {
            tracing::warn!("[Eidou] Theme root is not an object.");
        }

        Some(theme)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_auto_transport() {
        assert_eq!(resolve_auto_transport(true), "stdio");
        assert_eq!(resolve_auto_transport(false), "sse");
    }

    #[test]
    fn test_parse_queue_limit_arg() {
        // invalid -> default
        assert_eq!(parse_queue_limit_arg("nope").unwrap(), QUEUE_LIMIT_DEFAULT);
        assert_eq!(parse_queue_limit_arg("").unwrap(), QUEUE_LIMIT_DEFAULT);
        assert_eq!(parse_queue_limit_arg("abc").unwrap(), QUEUE_LIMIT_DEFAULT);

        // low value -> min
        assert_eq!(parse_queue_limit_arg("0").unwrap(), QUEUE_LIMIT_MIN);
        assert_eq!(parse_queue_limit_arg("1").unwrap(), QUEUE_LIMIT_MIN);
        assert_eq!(parse_queue_limit_arg("15").unwrap(), QUEUE_LIMIT_MIN);

        // high value -> max
        assert_eq!(parse_queue_limit_arg("16385").unwrap(), QUEUE_LIMIT_MAX);
        assert_eq!(parse_queue_limit_arg("999999").unwrap(), QUEUE_LIMIT_MAX);

        // boundaries -> unchanged
        assert_eq!(parse_queue_limit_arg("16").unwrap(), QUEUE_LIMIT_MIN);
        assert_eq!(parse_queue_limit_arg("16384").unwrap(), QUEUE_LIMIT_MAX);

        // normal values -> unchanged
        assert_eq!(parse_queue_limit_arg("256").unwrap(), 256);
        assert_eq!(parse_queue_limit_arg("1000").unwrap(), 1000);
    }

    #[test]
    fn test_parse_strict_f64() {
        assert_eq!(parse_strict_f64("320.0").unwrap(), 320.0);
        assert_eq!(parse_strict_f64("123").unwrap(), 123.0);
        assert_eq!(parse_strict_f64("-10.5").unwrap(), -10.5);
        assert!(parse_strict_f64("abc").is_err());
        assert!(parse_strict_f64("").is_err());
    }

    #[test]
    fn test_parse_host_theme_full() {
        let json5_input = r##"
        {
            mode: "dark",
            colors: {
                bg: "#000000",
                primary: "#ff0000",
                // extra field ignored
                extra: "ignored"
            },
            radii: {
                base: 4
            },
            tokens: {
                primary: "var(--color-primary)"
            }
        }
        "##;
        let theme = EidouConfig::parse_host_theme(json5_input).unwrap();
        assert_eq!(theme.mode, Some("dark".to_string()));
        assert_eq!(
            theme.colors.as_ref().unwrap().bg,
            Some("#000000".to_string())
        );
        assert_eq!(
            theme.colors.as_ref().unwrap().primary,
            Some("#ff0000".to_string())
        );
        assert_eq!(theme.radii.as_ref().unwrap().base, Some("4".to_string()));
        assert_eq!(
            theme.tokens.as_ref().unwrap().primary,
            Some("var(--color-primary)".to_string())
        );
    }

    #[test]
    fn test_parse_host_theme_lenient() {
        let json5_input = r##"
        {
            mode: 123, // invalid type, should be ignored
            colors: {
                bg: 0, // invalid type
                surface: "valid"
            },
            radii: {
                base: "8px"
            }
        }
        "##;
        let theme = EidouConfig::parse_host_theme(json5_input).unwrap();
        assert_eq!(theme.mode, None);
        assert_eq!(theme.colors.as_ref().unwrap().bg, None);
        assert_eq!(
            theme.colors.as_ref().unwrap().surface,
            Some("valid".to_string())
        );
        assert_eq!(theme.radii.as_ref().unwrap().base, Some("8px".to_string()));
    }

    #[test]
    fn test_parse_host_theme_invalid_json() {
        let json5_input = r##" { mode: "dark" "##; // broken
        assert_eq!(EidouConfig::parse_host_theme(json5_input), None);
    }

    // --- Config file injection tests ---

    #[test]
    fn test_parse_config_entries_full() {
        let input = r##"{
            mcp_transport: "sse",
            mcp_port: 4200,
            pool_size: 10,
            toast_pool_size: 5,
            mcp_http_stateful: true,
            user_event_queue_limit: 512,
            auth_secret: "super-secret",
            theme_config: "/tmp/theme.json5"
        }"##;
        let entries = parse_config_entries(input).unwrap();
        assert_eq!(entries.len(), 8);

        let find = |key: &str| -> String {
            entries
                .iter()
                .find(|(k, _)| *k == key)
                .map(|(_, v)| v.clone())
                .unwrap_or_default()
        };

        assert_eq!(find("EIDOU_MCP_TRANSPORT"), "sse");
        assert_eq!(find("EIDOU_MCP_PORT"), "4200");
        assert_eq!(find("EIDOU_POOL_SIZE"), "10");
        assert_eq!(find("EIDOU_TOAST_POOL_SIZE"), "5");
        assert_eq!(find("EIDOU_MCP_HTTP_STATEFUL"), "true");
        assert_eq!(find("EIDOU_USER_EVENT_QUEUE_LIMIT"), "512");
        assert_eq!(find("EIDOU_AUTH_SECRET"), "super-secret");
        assert_eq!(find("EIDOU_THEME_CONFIG"), "/tmp/theme.json5");
    }

    #[test]
    fn test_parse_config_entries_partial() {
        let input = r##"{ mcp_transport: "http" }"##;
        let entries = parse_config_entries(input).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "EIDOU_MCP_TRANSPORT");
        assert_eq!(entries[0].1, "http");
    }

    #[test]
    fn test_parse_config_entries_empty_object() {
        let input = "{}";
        let entries = parse_config_entries(input).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_config_entries_bool_serialization() {
        let input = r##"{ mcp_http_stateful: false }"##;
        let entries = parse_config_entries(input).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "EIDOU_MCP_HTTP_STATEFUL");
        assert_eq!(entries[0].1, "false");
    }

    #[test]
    fn test_parse_config_entries_invalid_json5() {
        let input = r##"{ mcp_transport: "sse" "##; // broken
        assert!(parse_config_entries(input).is_err());
    }

    #[test]
    fn test_parse_config_entries_not_object() {
        let input = r##""just a string""##;
        assert!(parse_config_entries(input).is_err());
    }

    #[test]
    fn test_parse_config_entries_unknown_keys_ignored() {
        let input = r##"{
            mcp_transport: "sse",
            unknown_key: "ignored",
            another_unknown: 42
        }"##;
        let entries = parse_config_entries(input).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "EIDOU_MCP_TRANSPORT");
    }

    #[test]
    fn test_parse_config_entries_unsupported_types_skipped() {
        let input = r##"{
            mcp_transport: ["array", "not", "supported"],
            mcp_port: { nested: "object" },
            pool_size: null,
            toast_pool_size: 3
        }"##;
        let entries = parse_config_entries(input).unwrap();
        // Only toast_pool_size should survive (array/object/null are skipped)
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "EIDOU_TOAST_POOL_SIZE");
        assert_eq!(entries[0].1, "3");
    }

    #[test]
    fn test_parse_config_entries_with_json5_comments() {
        let input = r##"{
            // This is a comment
            mcp_transport: "sse", // inline comment
            /* block comment */
            mcp_port: 5000,
        }"##;
        let entries = parse_config_entries(input).unwrap();
        assert_eq!(entries.len(), 2);
    }
}
