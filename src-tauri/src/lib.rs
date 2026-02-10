use clap::Parser;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Listener;
use tauri::{Emitter, Manager};

mod commands;
mod config;
pub mod constants;
mod error;
mod mcp;
mod window;

use config::{EidouConfig, TransportMode};
use constants::{EVENT_HOST_THEME, EVENT_READY, EVENT_RENDER, EVENT_RESET};

#[derive(serde::Deserialize)]
struct ReadyPayload {
    pool_id: Option<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize Tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_writer(std::io::stderr)
        .init();

    // Load config file and inject as env vars (before clap parse).
    // Priority: CLI args > env vars > config file > built-in defaults.
    // If config file exists but fails to parse, we MUST fail fast (panic).
    if let Err(e) = config::inject_config_file_env() {
        panic!("Failed to load config file: {}", e);
    }

    config::inject_autodetect_transport();

    let mut config = EidouConfig::parse();

    // Load Host Theme (Phase 2)
    config.load_host_theme();

    // Warn if debug flags are active
    let overrides = config.get_debug_overrides();
    if !overrides.is_empty() {
        tracing::warn!(
            "[Eidou] WARNING: Running with EXPERIMENTAL/DEBUG overrides: {:?}",
            overrides
        );
    }

    tracing::info!(
        "[Eidou] Daemon starting with Pool Size: {}",
        config.pool_size
    );
    tracing::info!("[Eidou] MCP Transport Mode: {:?}", config.mcp_transport);
    tracing::info!("[Eidou] MCP HTTP Stateful: {}", config.mcp_http_stateful);

    tauri::Builder::default()
        .setup(move |app| {
            // Initialize State (Lock-free!)
            let mcp_state = Arc::new(mcp::state::McpState::with_limit(
                config.user_event_queue_limit,
            ));
            app.manage(mcp_state.clone());

            // Global readiness handshake from frontend.
            {
                let handle_ready = app.handle().clone();
                let state_ready = mcp_state.clone();
                let host_theme = config.host_theme.clone();

                app.listen_any(EVENT_READY, move |event: tauri::Event| {
                    let label = serde_json::from_str::<ReadyPayload>(event.payload())
                        .ok()
                        .and_then(|rp| rp.pool_id);

                    let Some(label) = label else {
                        tracing::warn!("[Eidou] eidou:ready received without pool_id");
                        return;
                    };

                    tracing::info!("[Eidou] eidou:ready received for pool_id: {}", label);

                    // Phase 2.5: Emit Host Theme immediately upon readiness
                    if let Some(window) = handle_ready.get_webview_window(&label) {
                        if let Err(e) = window.emit(
                            EVENT_HOST_THEME,
                            serde_json::json!({
                                "target": label,
                                "theme": host_theme
                            }),
                        ) {
                            tracing::warn!("[Eidou] Failed to emit eidou:host_theme: {}", e);
                        }
                    }

                    state_ready.mark_window_ready(&label);

                    let Some(pending) = state_ready.take_pending_render(&label) else {
                        return;
                    };

                    let Some(window) = handle_ready.get_webview_window(&label) else {
                        tracing::warn!("[Eidou] Ready window not found: {}", label);
                        return;
                    };

                    let _ =
                        window.set_size(tauri::LogicalSize::new(pending.size.0, pending.size.1));
                    if let Some((x, y)) = pending.position {
                        let _ = window.set_position(tauri::LogicalPosition::new(x, y));
                    }

                    let _ = window.set_title(&pending.title);
                    if let Err(e) = window.emit(
                        EVENT_RENDER,
                        serde_json::json!({
                            "target": label,
                            "ui": pending.ui
                        }),
                    ) {
                        tracing::error!("[Eidou] Failed to emit eidou:render: {}", e);
                    }

                    let _ = window.show();
                    if let Some((x, y)) = pending.position {
                        let _ = window.set_position(tauri::LogicalPosition::new(x, y));
                    }
                    if pending.focus {
                        let _ = window.set_focus();
                    }
                });
            }

            // Initialize Window Pool
            use crate::window::pool::WindowPool;
            WindowPool::init_pool(app.handle(), &config);

            // Construct ToastLayout once (shared by all transports)
            use crate::window::layout::ToastLayout;
            let toast_layout = ToastLayout::from(&config);

            // Spawn TTL cleanup singleton (once, not per-router)
            {
                use constants::{TTL_CLEANUP_INTERVAL_SECS, TTL_DURATION_SECS};
                let state_ttl = mcp_state.clone();
                let handle_ttl = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let mut interval = tokio::time::interval(
                        std::time::Duration::from_secs(TTL_CLEANUP_INTERVAL_SECS),
                    );
                    loop {
                        interval.tick().await;
                        let expired = state_ttl.cleanup_expired_windows(
                            std::time::Duration::from_secs(TTL_DURATION_SECS),
                        );
                        for window_label in expired {
                            tracing::info!("[Eidou] TTL expired for window: {}", window_label);
                            if let Some(w) = handle_ttl.get_webview_window(&window_label) {
                                let _ = w.hide();
                                let _ = w.emit(
                                    EVENT_RESET,
                                    serde_json::json!({ "target": window_label }),
                                );
                            }
                            state_ttl.release_window(&window_label);
                        }
                    }
                });
            }

            let pool_size = config.pool_size;
            let toast_pool_size = config.toast_pool_size;

            // Transport Selection (R010)
            match config.mcp_transport {
                TransportMode::Http | TransportMode::Sse => {
                    let port = config.mcp_port;
                    let http_stateful = config.mcp_http_stateful;

                    // Resolve auth secret (config or ephemeral CSPRNG)
                    let has_configured_auth_secret =
                        mcp::auth::configured_auth_secret(config.auth_secret.as_deref()).is_some();
                    let auth_secret = mcp::auth::resolve_auth_secret(config.auth_secret.as_deref());

                    if has_configured_auth_secret {
                        tracing::info!(
                            "[Eidou] Skipping auth-token file write because EIDOU_AUTH_SECRET is configured"
                        );

                        if let Ok(path) = mcp::auth::resolve_token_file_path() {
                            if path.exists() {
                                tracing::warn!(
                                    "[Eidou] Existing auth-token file may be stale while EIDOU_AUTH_SECRET is configured: {}",
                                    path.display()
                                );
                            }
                        }
                    } else {
                        // Write token file for client discovery
                        match mcp::auth::write_token_file(&auth_secret) {
                            Ok(path) => {
                                tracing::info!("[Eidou] Auth token written to: {}", path.display());
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "[Eidou] Failed to write auth token file: {}. \
                                     Clients must use EIDOU_AUTH_SECRET env var instead.",
                                    e
                                );
                            }
                        }
                    }

                    let handle_sse = app.handle().clone();
                    let state_for_sse = mcp_state.clone();

                    tauri::async_runtime::spawn(async move {
                        mcp::sse::start(
                            handle_sse,
                            state_for_sse,
                            pool_size,
                            toast_pool_size,
                            port,
                            http_stateful,
                            toast_layout,
                            auth_secret,
                        )
                        .await;
                    });
                }
                TransportMode::Stdio => {
                    let handle = app.handle().clone();
                    let state_for_stdio = mcp_state.clone();

                    tauri::async_runtime::spawn(async move {
                        mcp::server::McpServer::start(
                            handle,
                            state_for_stdio,
                            pool_size,
                            toast_pool_size,
                            toast_layout,
                        )
                        .await;
                    });
                }
            }

            // Tray Menu
            setup_tray(app)?;

            tracing::info!("[Eidou] Daemon ready.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::submit_action,
            commands::adjust_projection_size,
            commands::finalize_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let eidou_i = MenuItem::with_id(app, "status", "Eidou Host (v0.1)", false, None::<&str>)?;

    let menu = Menu::with_items(app, &[&eidou_i, &separator, &quit_i])?;

    // Load platform-appropriate tray icon:
    // - macOS: monochrome Template icon (system adapts to light/dark)
    // - Windows/Linux: default app icon (colored)
    let tray_icon = load_macos_tray_icon(app)
        .unwrap_or_else(|| app.default_window_icon().expect("No default icon").clone());

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(tray_icon)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "quit" {
                tracing::info!("[Eidou] Quit requested via Tray");
                app.exit(0);
            }
        })
        .build(app)?;

    Ok(())
}

/// Attempt to load macOS-specific monochrome tray template icon.
/// Returns None on non-macOS platforms or if the template file is missing.
#[cfg(target_os = "macos")]
fn load_macos_tray_icon(app: &tauri::App) -> Option<tauri::image::Image<'static>> {
    let candidates = [
        "icons/tray-icon-Template@2x.png",
        "icons/tray-icon-Template.png",
    ];

    for name in &candidates {
        if let Ok(path) = app
            .path()
            .resolve(name, tauri::path::BaseDirectory::Resource)
        {
            if path.exists() {
                tracing::info!("[Eidou] Loading macOS tray template icon: {:?}", path);
                return tauri::image::Image::from_path(&path).ok();
            }
        }
    }

    tracing::warn!("[Eidou] macOS tray template icon not found, falling back to default");
    None
}

#[cfg(not(target_os = "macos"))]
fn load_macos_tray_icon(_app: &tauri::App) -> Option<tauri::image::Image<'static>> {
    None
}
