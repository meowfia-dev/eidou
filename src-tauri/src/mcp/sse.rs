use crate::mcp::auth::{self, AuthState};
use crate::mcp::router::EidouRouter;
use crate::mcp::state::McpState;
use crate::window::layout::ToastLayout;
use axum::{
    http::{HeaderName, Method},
    middleware, Router,
};
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use std::sync::Arc;
use tauri::AppHandle;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

// Entry-point function called from a single spawn site in lib.rs;
// bundling into a config struct adds indirection without benefit here.
#[allow(clippy::too_many_arguments)]
pub async fn start(
    app: AppHandle,
    state: Arc<McpState>,
    pool_size: usize,
    toast_pool_size: usize,
    port: u16,
    http_stateful: bool,
    toast_layout: ToastLayout,
    auth_secret: String,
) {
    let app_clone = app.clone();
    let state_clone = state.clone();

    state.set_http_stateful(http_stateful);

    // Factory closure returns the router directly (impl Service)
    let factory = move || {
        let router = EidouRouter::new(
            app_clone.clone(),
            state_clone.clone(),
            pool_size,
            toast_pool_size,
            Uuid::new_v4().to_string(),
            http_stateful,
            toast_layout,
        );
        Ok::<_, std::io::Error>(router)
    };

    // Initialize Streamable HTTP Service (MCP Standard)
    let config = StreamableHttpServerConfig {
        stateful_mode: http_stateful,
        ..Default::default()
    };

    let service =
        StreamableHttpService::new(factory, Arc::new(LocalSessionManager::default()), config);

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::predicate(
            |origin: &axum::http::HeaderValue, _request_parts: &axum::http::request::Parts| {
                let origin_bytes = origin.as_bytes();
                if origin_bytes.starts_with(b"http://localhost:") {
                    return true;
                }
                if origin_bytes.starts_with(b"http://127.0.0.1:") {
                    return true;
                }
                if origin_bytes == b"tauri://localhost" {
                    return true;
                }
                if origin_bytes == b"app://localhost" {
                    return true;
                }
                false
            },
        ))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            "content-type".parse::<HeaderName>().unwrap(),
            "accept".parse::<HeaderName>().unwrap(),
            "authorization".parse::<HeaderName>().unwrap(),
            "x-eidou-session-token".parse::<HeaderName>().unwrap(),
            "mcp-session-id".parse::<HeaderName>().unwrap(),
        ]);

    // Auth state for Bearer token validation
    let auth_state = AuthState {
        secret: Arc::new(auth_secret),
    };

    // Middleware ordering (inside-out):
    //   Request -> CORS -> Host Guard -> Auth Guard -> MCP Service
    //
    // - CORS (outermost): handles OPTIONS preflight, adds response headers
    // - Host Guard: rejects non-localhost Host headers (DNS Rebinding protection)
    // - Auth Guard: validates Bearer token (skips OPTIONS)
    let app_router = Router::new()
        .nest_service("/mcp", service)
        .layer(middleware::from_fn_with_state(auth_state, auth::auth_guard))
        .layer(middleware::from_fn(auth::host_guard))
        .layer(cors);

    let addr = format!("127.0.0.1:{}", port);

    match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => {
            tracing::info!("[Eidou] MCP HTTP Server listening on http://{}/mcp", addr);
            if let Err(e) = axum::serve(listener, app_router).await {
                tracing::error!("[Eidou] Server error: {}", e);
            }
        }
        Err(e) => {
            // Log error but do NOT panic or crash the process.
            tracing::error!(
                "[Eidou] MCP HTTP Server STARTUP FAILED. Port {} in use? Error: {}",
                port,
                e
            );
        }
    }
}
