use axum::{
    body::Body,
    extract::State,
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use directories::BaseDirs;
use rand::Rng;
use std::path::PathBuf;
use std::sync::Arc;

use crate::error::EidouError;

// -- Token Generation & File --

/// Generate a 32-byte CSPRNG token, base64url encoded (43 chars).
pub fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Return the configured auth secret if set and non-empty, otherwise None.
pub fn configured_auth_secret(configured: Option<&str>) -> Option<&str> {
    configured
        .map(str::trim)
        .filter(|secret| !secret.is_empty())
}

/// Resolve the auth secret: use configured value if set, otherwise generate.
pub fn resolve_auth_secret(configured: Option<&str>) -> String {
    if let Some(secret) = configured_auth_secret(configured) {
        if secret.len() < 16 {
            tracing::warn!(
                "[Eidou] EIDOU_AUTH_SECRET is shorter than 16 characters. \
                 Consider using a longer secret."
            );
        }
        tracing::info!("[Eidou] Using configured auth secret (EIDOU_AUTH_SECRET)");
        return secret.to_string();
    }

    let token = generate_token();
    tracing::info!("[Eidou] Generated ephemeral auth token (no EIDOU_AUTH_SECRET configured)");
    token
}

/// Write the auth token to a platform-specific file with restricted permissions.
///
/// Returns the path where the token was written.
pub fn write_token_file(token: &str) -> Result<PathBuf, EidouError> {
    let dir = resolve_token_dir()?;

    std::fs::create_dir_all(&dir)
        .map_err(|e| EidouError::Internal(format!("Failed to create token directory: {}", e)))?;

    // Restrict directory permissions on Unix (0o700 = owner only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o700);
        std::fs::set_permissions(&dir, perms).map_err(|e| {
            EidouError::Internal(format!("Failed to set token directory permissions: {}", e))
        })?;
    }

    let path = resolve_token_file_path()?;
    std::fs::write(&path, token)
        .map_err(|e| EidouError::Internal(format!("Failed to write token file: {}", e)))?;

    // Restrict file permissions on Unix (0o600 = owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&path, perms).map_err(|e| {
            EidouError::Internal(format!("Failed to set token file permissions: {}", e))
        })?;
    }

    Ok(path)
}

/// Resolve the full platform-specific path to the token file.
pub fn resolve_token_file_path() -> Result<PathBuf, EidouError> {
    Ok(resolve_token_dir()?.join("auth-token"))
}

/// Resolve the platform-specific directory for the token file.
///
/// Linux:   $XDG_RUNTIME_DIR/eidou (preferred) or cache_dir fallback
/// macOS:   ~/Library/Caches/eidou
/// Windows: %LOCALAPPDATA%\eidou
fn resolve_token_dir() -> Result<PathBuf, EidouError> {
    #[cfg(target_os = "linux")]
    {
        if let Some(runtime_dir) = std::env::var_os("XDG_RUNTIME_DIR") {
            if !runtime_dir.is_empty() {
                return Ok(PathBuf::from(runtime_dir).join("eidou"));
            }
        }

        if let Some(cache_home) = std::env::var_os("XDG_CACHE_HOME") {
            if !cache_home.is_empty() {
                return Ok(PathBuf::from(cache_home).join("eidou"));
            }
        }

        let base_dirs = BaseDirs::new().ok_or_else(|| {
            EidouError::Internal("Failed to resolve home directory for token storage".to_string())
        })?;
        Ok(base_dirs.cache_dir().join("eidou"))
    }

    #[cfg(target_os = "macos")]
    {
        let base_dirs = BaseDirs::new().ok_or_else(|| {
            EidouError::Internal("Failed to resolve home directory for token storage".to_string())
        })?;
        return Ok(base_dirs
            .home_dir()
            .join("Library")
            .join("Caches")
            .join("eidou"));
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            if !local_app_data.is_empty() {
                return Ok(PathBuf::from(local_app_data).join("eidou"));
            }
        }

        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            if !user_profile.is_empty() {
                return Ok(PathBuf::from(user_profile)
                    .join("AppData")
                    .join("Local")
                    .join("eidou"));
            }
        }

        let base_dirs = BaseDirs::new().ok_or_else(|| {
            EidouError::Internal(
                "Failed to resolve LOCALAPPDATA or USERPROFILE for token storage".to_string(),
            )
        })?;
        return Ok(base_dirs.data_local_dir().join("eidou"));
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        let base_dirs = BaseDirs::new().ok_or_else(|| {
            EidouError::Internal("Failed to resolve home directory for token storage".to_string())
        })?;
        Ok(base_dirs.cache_dir().join("eidou"))
    }
}

// -- Axum Middleware --

/// Axum middleware: validate Host header against localhost values.
///
/// Blocks DNS Rebinding attacks by rejecting requests where the Host header
/// does not match a known localhost value.
pub async fn host_guard(req: Request<Body>, next: Next) -> Response {
    let host = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Strip port to compare the hostname part only
    let hostname = host.split(':').next().unwrap_or("");

    let is_valid = matches!(
        hostname.to_lowercase().as_str(),
        "localhost" | "127.0.0.1" | "[::1]"
    );

    if !is_valid {
        tracing::warn!(
            "[Eidou] Rejected request with invalid Host header: {}",
            host
        );
        return (StatusCode::FORBIDDEN, "Forbidden: invalid Host header").into_response();
    }

    next.run(req).await
}

/// Shared state for the auth_guard middleware.
#[derive(Clone)]
pub struct AuthState {
    pub secret: Arc<String>,
}

/// Axum middleware: validate Bearer token or query parameter.
///
/// Skips validation for OPTIONS requests (CORS preflight).
pub async fn auth_guard(State(auth): State<AuthState>, req: Request<Body>, next: Next) -> Response {
    // CORS preflight must pass through without auth
    if req.method() == Method::OPTIONS {
        return next.run(req).await;
    }

    match extract_token(&req) {
        Some(ref token) if token == auth.secret.as_str() => next.run(req).await,
        _ => {
            tracing::warn!("[Eidou] Rejected request: invalid or missing auth token");
            (
                StatusCode::UNAUTHORIZED,
                "Unauthorized: provide a valid token via \
                 'Authorization: Bearer <token>' header \
                 or '?token=<token>' query parameter. \
                 Token is in the auth-token file or EIDOU_AUTH_SECRET env var.",
            )
                .into_response()
        }
    }
}

/// Extract auth token from request (header first, then query param fallback).
fn extract_token(req: &Request<Body>) -> Option<String> {
    // Priority 1: Authorization: Bearer <token>
    if let Some(value) = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
    {
        if let Some(token) = value.strip_prefix("Bearer ") {
            return Some(token.to_string());
        }
    }

    // Priority 2: ?token=<token> query parameter
    if let Some(query) = req.uri().query() {
        for pair in query.split('&') {
            if let Some(token) = pair.strip_prefix("token=") {
                return Some(token.to_string());
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_token_length() {
        let token = generate_token();
        // 32 bytes -> base64url no-pad = 43 chars
        assert_eq!(token.len(), 43);
    }

    #[test]
    fn test_generate_token_uniqueness() {
        let t1 = generate_token();
        let t2 = generate_token();
        assert_ne!(t1, t2);
    }

    #[test]
    fn test_generate_token_is_valid_base64url() {
        let token = generate_token();
        let decoded = URL_SAFE_NO_PAD.decode(&token);
        assert!(decoded.is_ok());
        assert_eq!(decoded.unwrap().len(), 32);
    }

    #[test]
    fn test_resolve_auth_secret_with_configured() {
        let secret = resolve_auth_secret(Some("my-static-secret-key"));
        assert_eq!(secret, "my-static-secret-key");
    }

    #[test]
    fn test_resolve_auth_secret_trims_configured() {
        let secret = resolve_auth_secret(Some("  my-static-secret-key  "));
        assert_eq!(secret, "my-static-secret-key");
    }

    #[test]
    fn test_resolve_auth_secret_empty_configured_is_ignored() {
        let secret = resolve_auth_secret(Some("    "));
        assert_eq!(secret.len(), 43);
    }

    #[test]
    fn test_resolve_auth_secret_without_configured() {
        let secret = resolve_auth_secret(None);
        // Should be a generated 43-char base64url token
        assert_eq!(secret.len(), 43);
    }

    #[test]
    fn test_extract_token_from_bearer_header() {
        let req = Request::builder()
            .uri("/mcp")
            .header("authorization", "Bearer test-secret-123")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), Some("test-secret-123".to_string()));
    }

    #[test]
    fn test_extract_token_from_query_param() {
        let req = Request::builder()
            .uri("/mcp?token=query-secret-456")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), Some("query-secret-456".to_string()));
    }

    #[test]
    fn test_extract_token_bearer_takes_priority() {
        let req = Request::builder()
            .uri("/mcp?token=query-value")
            .header("authorization", "Bearer header-value")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), Some("header-value".to_string()));
    }

    #[test]
    fn test_extract_token_missing() {
        let req = Request::builder().uri("/mcp").body(Body::empty()).unwrap();
        assert_eq!(extract_token(&req), None);
    }

    #[test]
    fn test_extract_token_invalid_auth_scheme() {
        let req = Request::builder()
            .uri("/mcp")
            .header("authorization", "Basic dXNlcjpwYXNz")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), None);
    }

    #[test]
    fn test_extract_token_query_with_other_params() {
        let req = Request::builder()
            .uri("/mcp?foo=bar&token=my-token&baz=qux")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_token(&req), Some("my-token".to_string()));
    }
}
