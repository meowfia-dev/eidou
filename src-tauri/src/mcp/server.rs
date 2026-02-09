use crate::mcp::router::EidouRouter;
use crate::mcp::state::McpState;
use crate::window::layout::ToastLayout;
use rmcp::transport::stdio;
use rmcp::ServiceExt;
use std::sync::Arc;
use tauri::AppHandle;

pub struct McpServer;

impl McpServer {
    pub async fn start(
        app: AppHandle,
        state: Arc<McpState>,
        pool_size: usize,
        toast_pool_size: usize,
        toast_layout: ToastLayout,
    ) {
        tracing::info!(
            "[MCP] Starting Stdio Server (Pool Size: {}, Toast Pool: {})...",
            pool_size,
            toast_pool_size
        );

        state.set_http_stateful(true);
        let handler = EidouRouter::new(
            app,
            state.clone(),
            pool_size,
            toast_pool_size,
            "stdio".to_string(),
            true,
            toast_layout,
        );

        // Use serve() and wait for completion
        match handler.serve(stdio()).await {
            Ok(service) => {
                let peer = service.peer().clone();
                state.register_peer("stdio".to_string(), peer);
                if let Err(e) = service.waiting().await {
                    tracing::error!("[MCP] Stdio Service Waiting Error: {}", e);
                }
                state.cleanup_session("stdio");
            }
            Err(e) => {
                tracing::error!("[MCP] Stdio Server Start Error: {}", e);
            }
        }
        tracing::info!("[MCP] Server loop finished.");
    }
}
