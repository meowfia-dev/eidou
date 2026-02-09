use crate::constants::{ERR_ACCESS_DENIED, ERR_INTERNAL_ERROR, ERR_INVALID_PARAMS};
use rmcp::model::{ErrorCode, ErrorData as McpError};

/// Unified error type for all Eidou backend operations.
///
/// Converts into both `McpError` (for MCP tool responses) and `String`
/// (for Tauri command return values) so callers never need ad-hoc formatting.
#[derive(Debug, thiserror::Error)]
pub enum EidouError {
    #[error("Window not found: {0}")]
    WindowNotFound(String),

    #[error("No available windows in pool")]
    PoolExhausted,

    #[error("Access denied: {0}")]
    AccessDenied(String),

    #[error("Invalid parameters: {0}")]
    InvalidParams(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Tauri error: {0}")]
    Tauri(String),
}

impl From<tauri::Error> for EidouError {
    fn from(e: tauri::Error) -> Self {
        EidouError::Tauri(e.to_string())
    }
}

impl From<EidouError> for McpError {
    fn from(e: EidouError) -> Self {
        let code = match &e {
            EidouError::AccessDenied(_) => ErrorCode(ERR_ACCESS_DENIED),
            EidouError::InvalidParams(_) | EidouError::Serialization(_) => {
                ErrorCode(ERR_INVALID_PARAMS)
            }
            _ => ErrorCode(ERR_INTERNAL_ERROR),
        };
        McpError {
            code,
            message: e.to_string().into(),
            data: None,
        }
    }
}

impl From<EidouError> for String {
    fn from(e: EidouError) -> Self {
        e.to_string()
    }
}
