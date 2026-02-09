use crate::config::{EidouConfig, TransportMode};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

pub struct WindowPool;

impl WindowPool {
    pub fn init_pool(app: &AppHandle, config: &EidouConfig) {
        let transport = match config.mcp_transport {
            TransportMode::Stdio => "stdio",
            TransportMode::Http => "http",
            TransportMode::Sse => "sse",
        };

        // Widget Pool
        for i in 0..config.pool_size {
            let label = format!("pool-{}", i);
            let url = WebviewUrl::App("index.html".into());
            let init_script = format!(
                "window.__EIDOU_CONFIG__ = {{ transport: \"{}\" }};",
                transport
            );

            let win = WebviewWindowBuilder::new(app, &label, url)
                .initialization_script(&init_script)
                .visible(false)
                .decorations(config.debug_window_decorations)
                .transparent(config.debug_window_transparent)
                .resizable(config.debug_window_resizable)
                .shadow(config.debug_window_shadow)
                .build();

            match win {
                Ok(_) => tracing::info!("[Eidou] Created widget window: {}", label),
                Err(e) => tracing::error!("[Eidou] Failed to create window {}: {}", label, e),
            }
        }

        // Toast Pool
        for i in 0..config.toast_pool_size {
            let label = format!("toast-{}", i);
            let url = WebviewUrl::App("index.html".into());
            let init_script = format!(
                "window.__EIDOU_CONFIG__ = {{ transport: \"{}\" }};",
                transport
            );

            let win = WebviewWindowBuilder::new(app, &label, url)
                .initialization_script(&init_script)
                .visible(false)
                .decorations(config.debug_window_decorations)
                .transparent(config.debug_window_transparent)
                .resizable(config.debug_window_resizable)
                .skip_taskbar(config.debug_toast_skip_taskbar)
                .always_on_top(config.debug_toast_always_on_top)
                .shadow(config.debug_window_shadow)
                .build();

            match win {
                Ok(_) => tracing::info!("[Eidou] Created toast window: {}", label),
                Err(e) => tracing::error!("[Eidou] Failed to create toast window {}: {}", label, e),
            }
        }
    }
}
