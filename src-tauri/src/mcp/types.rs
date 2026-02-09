use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserEvent {
    pub source: String,
    pub action: String,
    pub payload: serde_json::Value,
    pub timestamp: u64,
}
