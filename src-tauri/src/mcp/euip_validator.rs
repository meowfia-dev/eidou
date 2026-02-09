use crate::constants::ERR_INVALID_PARAMS;
use rmcp::model::{ErrorCode, ErrorData as McpError};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct EuipViolation {
    pub rule: String,
    pub message: String,
    pub path: String,
}

#[derive(Debug)]
pub struct EuipValidationError {
    pub violations: Vec<EuipViolation>,
}

impl From<EuipValidationError> for McpError {
    fn from(err: EuipValidationError) -> Self {
        McpError {
            code: ErrorCode(ERR_INVALID_PARAMS),
            message: "EUIP Validation Failed".into(),
            data: Some(serde_json::json!({
                "code": "EUIP_VALIDATION_ERROR",
                "violations": err.violations,
                "hint": "EUIP hierarchy: projection -> field (exactly 1) -> shard (optional) -> layouts/atoms"
            })),
        }
    }
}

pub fn validate_euip(ui: &Value) -> Result<(), EuipValidationError> {
    let mut violations = Vec::new();

    // 1. Root must be projection
    let type_val = ui.get("type").and_then(|t| t.as_str());
    if type_val != Some("projection") {
        violations.push(EuipViolation {
            rule: "ROOT_PROJECTION".to_string(),
            message: "Root element must be of type 'projection'".to_string(),
            path: "$".to_string(),
        });
        return Err(EuipValidationError { violations });
    }

    // 2. SINGLE_FIELD: projection.children must have exactly 1 field
    let children = ui.get("children").and_then(|c| c.as_array());

    match children {
        Some(arr) => {
            if arr.len() != 1 {
                violations.push(EuipViolation {
                    rule: "SINGLE_FIELD".to_string(),
                    message: format!("Projection must have exactly 1 child, found {}", arr.len()),
                    path: "$.children".to_string(),
                });
            } else {
                let child = &arr[0];
                let child_type = child.get("type").and_then(|t| t.as_str());
                if child_type != Some("field") {
                    violations.push(EuipViolation {
                        rule: "SINGLE_FIELD".to_string(),
                        message: "Projection child must be of type 'field'".to_string(),
                        path: "$.children[0]".to_string(),
                    });
                } else {
                    // Start recursive validation from the field
                    // allowed to have shard = true
                    validate_children(child, "$.children[0]", true, &mut violations);
                }
            }
        }
        None => {
            // If children is missing or not an array, strictly it's an error for projection if we expect a field
            violations.push(EuipViolation {
                rule: "SINGLE_FIELD".to_string(),
                message: "Projection must have children array".to_string(),
                path: "$.children".to_string(),
            });
        }
    }

    if violations.is_empty() {
        Ok(())
    } else {
        Err(EuipValidationError { violations })
    }
}

fn validate_children(
    parent: &Value,
    parent_path: &str,
    allow_shard: bool,
    violations: &mut Vec<EuipViolation>,
) {
    let children = match parent.get("children") {
        Some(Value::Array(arr)) => arr,
        _ => return, // No children to validate
    };

    for (i, child) in children.iter().enumerate() {
        let current_path = format!("{}.children[{}]", parent_path, i);
        let child_type = child
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("unknown");

        match child_type {
            "field" => {
                // NO_NESTED_FIELD: field cannot appear inside field, shard, or any layout.
                // Since we start recursion *after* the root field, any field encountered here is nested.
                violations.push(EuipViolation {
                    rule: "NO_NESTED_FIELD".to_string(),
                    message: "Field cannot appear inside another component".to_string(),
                    path: current_path.clone(),
                });
                // Recurse anyway to find more errors? Or stop?
                // Let's recurse but field inside field is definitely wrong.
                // If we recurse, treating it as a container where shards are NOT allowed (it's nested deep)
                validate_children(child, &current_path, false, violations);
            }
            "shard" => {
                if !allow_shard {
                    // NO_NESTED_SHARD / SHARD_ONLY_IN_FIELD
                    violations.push(EuipViolation {
                        rule: "SHARD_ONLY_IN_FIELD".to_string(),
                        message: "Shard can only appear as a direct child of a field".to_string(),
                        path: current_path.clone(),
                    });
                }

                // Recurse: Shard cannot contain shards
                validate_children(child, &current_path, false, violations);
            }
            _ => {
                // Layouts/Atoms
                // Recurse: Layouts cannot contain shards
                validate_children(child, &current_path, false, violations);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_valid_basic_hierarchy() {
        let ui = json!({
            "type": "projection",
            "children": [{
                "type": "field",
                "children": [{
                    "type": "shard",
                    "children": []
                }]
            }]
        });
        assert!(validate_euip(&ui).is_ok());
    }

    #[test]
    fn test_valid_field_layout() {
        let ui = json!({
            "type": "projection",
            "children": [{
                "type": "field",
                "children": [{
                    "type": "layout",
                    "children": []
                }]
            }]
        });
        assert!(validate_euip(&ui).is_ok());
    }

    #[test]
    fn test_invalid_root() {
        let ui = json!({
            "type": "field",
            "children": []
        });
        let err = validate_euip(&ui).unwrap_err();
        assert_eq!(err.violations[0].rule, "ROOT_PROJECTION");
    }

    #[test]
    fn test_invalid_single_field_len() {
        let ui = json!({
            "type": "projection",
            "children": []
        });
        let err = validate_euip(&ui).unwrap_err();
        assert_eq!(err.violations[0].rule, "SINGLE_FIELD");
    }

    #[test]
    fn test_invalid_single_field_type() {
        let ui = json!({
            "type": "projection",
            "children": [{
                "type": "shard"
            }]
        });
        let err = validate_euip(&ui).unwrap_err();
        assert_eq!(err.violations[0].rule, "SINGLE_FIELD");
    }

    #[test]
    fn test_invalid_nested_field() {
        let ui = json!({
            "type": "projection",
            "children": [{
                "type": "field",
                "children": [{
                    "type": "field"
                }]
            }]
        });
        let err = validate_euip(&ui).unwrap_err();
        assert_eq!(err.violations[0].rule, "NO_NESTED_FIELD");
    }

    #[test]
    fn test_invalid_shard_inside_shard() {
        let ui = json!({
            "type": "projection",
            "children": [{
                "type": "field",
                "children": [{
                    "type": "shard",
                    "children": [{
                        "type": "shard"
                    }]
                }]
            }]
        });
        let err = validate_euip(&ui).unwrap_err();
        assert_eq!(err.violations[0].rule, "SHARD_ONLY_IN_FIELD");
    }

    #[test]
    fn test_invalid_shard_inside_layout() {
        let ui = json!({
            "type": "projection",
            "children": [{
                "type": "field",
                "children": [{
                    "type": "layout",
                    "children": [{
                        "type": "shard"
                    }]
                }]
            }]
        });
        let err = validate_euip(&ui).unwrap_err();
        assert_eq!(err.violations[0].rule, "SHARD_ONLY_IN_FIELD");
    }
}
