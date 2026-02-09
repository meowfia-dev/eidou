use crate::config::EidouConfig;
use crate::constants::{DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH};
use serde_json::Value;
use tauri::{LogicalPosition, WebviewWindow};

/// Toast stacking configuration, passed from host config.
#[derive(Clone, Copy, Debug)]
pub struct ToastLayout {
    pub width: f64,
    pub height: f64,
    pub margin_outer: f64,
    pub spacing: f64,
}

impl From<&EidouConfig> for ToastLayout {
    fn from(config: &EidouConfig) -> Self {
        Self {
            width: config.debug_toast_width,
            height: config.debug_toast_height,
            margin_outer: config.debug_toast_margin_outer,
            spacing: config.debug_toast_spacing,
        }
    }
}

/// Resolve widget dimensions from EUIP `props.size`.
///
/// Supports preset strings ("sm", "md", "lg", "xl", "full") and custom `{ width, height }` objects.
/// Falls back to DEFAULT_WINDOW_WIDTH x DEFAULT_WINDOW_HEIGHT.
pub fn resolve_size(window: &WebviewWindow, size_prop: Option<&Value>) -> (f64, f64) {
    let monitor_size = window.current_monitor().ok().flatten().map(|monitor| {
        let scale = monitor.scale_factor();
        (
            monitor.size().width as f64 / scale,
            monitor.size().height as f64 / scale,
        )
    });
    resolve_size_for_monitor(size_prop, monitor_size)
}

fn resolve_size_for_monitor(
    size_prop: Option<&Value>,
    monitor_size: Option<(f64, f64)>,
) -> (f64, f64) {
    const MIN_WIDTH: f64 = 200.0;
    const MIN_HEIGHT: f64 = 80.0;
    const SCREEN_RATIO: f64 = 0.85;

    fn clamp_ratio_size(width: f64, height: f64, monitor_size: Option<(f64, f64)>) -> (f64, f64) {
        let mut clamped_width = width;
        let mut clamped_height = height;

        if let Some((monitor_width, monitor_height)) = monitor_size {
            clamped_width = clamped_width.min(monitor_width * SCREEN_RATIO);
            clamped_height = clamped_height.min(monitor_height * SCREEN_RATIO);
        }

        clamped_width = clamped_width.max(MIN_WIDTH);
        clamped_height = clamped_height.max(MIN_HEIGHT);

        (clamped_width.round(), clamped_height.round())
    }

    fn parse_ratio(value: &str) -> Option<(f64, f64)> {
        let mut parts = value.split(':');
        let width = parts.next()?.parse::<f64>().ok()?;
        let height = parts.next()?.parse::<f64>().ok()?;
        if parts.next().is_some() || width <= 0.0 || height <= 0.0 {
            return None;
        }
        Some((width, height))
    }

    let mut width = DEFAULT_WINDOW_WIDTH;
    let mut height = DEFAULT_WINDOW_HEIGHT;
    if let Some(s) = size_prop {
        if let Some(s_str) = s.as_str() {
            match s_str {
                "sm" => {
                    width = 320.0;
                    height = 480.0;
                }
                "md" => {
                    width = 480.0;
                    height = 640.0;
                }
                "lg" => {
                    width = 1024.0;
                    height = 768.0;
                }
                "xl" => {
                    width = 1024.0;
                    height = 900.0;
                }
                "full" => {
                    if let Some((monitor_width, monitor_height)) = monitor_size {
                        width = monitor_width;
                        height = monitor_height;
                    }
                }
                _ => {}
            }
        } else if let Some(s_obj) = s.as_object() {
            if let Some(ratio_str) = s_obj.get("ratio").and_then(Value::as_str) {
                if let Some((ratio_width, ratio_height)) = parse_ratio(ratio_str) {
                    let base_width = match s_obj.get("base").and_then(Value::as_str) {
                        Some("sm") => 320.0,
                        Some("lg") => 1024.0,
                        Some("xl") => 1024.0,
                        _ => 480.0,
                    };
                    let mut requested_width = s_obj
                        .get("width")
                        .and_then(Value::as_f64)
                        .unwrap_or(base_width);

                    if let Some(max_width) = s_obj.get("maxWidth").and_then(Value::as_f64) {
                        requested_width = requested_width.min(max_width);
                    }

                    let ratio_height_value = requested_width * (ratio_height / ratio_width);
                    return clamp_ratio_size(requested_width, ratio_height_value, monitor_size);
                }
            }

            if let (Some(w), Some(h)) = (s_obj.get("width"), s_obj.get("height")) {
                if let (Some(w_f), Some(h_f)) = (w.as_f64(), h.as_f64()) {
                    width = w_f;
                    height = h_f;
                }
            }
        }
    }
    (width, height)
}

#[cfg(test)]
mod tests {
    use super::resolve_size_for_monitor;
    use serde_json::json;

    #[test]
    fn resolve_size_supports_xl_preset() {
        let size = json!("xl");
        let (width, height) = resolve_size_for_monitor(Some(&size), None);
        assert_eq!((width, height), (1024.0, 900.0));
    }

    #[test]
    fn resolve_size_supports_full_preset_with_monitor() {
        let size = json!("full");
        let (width, height) = resolve_size_for_monitor(Some(&size), Some((1728.0, 1117.0)));
        assert_eq!((width, height), (1728.0, 1117.0));
    }

    #[test]
    fn resolve_size_supports_ratio_object() {
        let size = json!({
            "ratio": "16:9",
            "width": 1200,
            "maxWidth": 1000,
            "base": "lg"
        });
        let (width, height) = resolve_size_for_monitor(Some(&size), Some((1728.0, 1117.0)));
        assert_eq!((width, height), (1000.0, 563.0));
    }
}

/// Resolve widget position from EUIP `props.position` JSON.
///
/// Returns `None` if no monitor is available. Supports anchors:
/// "center" (default), "top-left", "top-right", "bottom-left", "bottom-right", "custom".
/// Applies boundary clamping to keep window fully on-screen.
pub fn resolve_position(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    pos_prop: Option<&Value>,
) -> Option<LogicalPosition<f64>> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let screen_w = monitor.size().width as f64 / scale;
    let screen_h = monitor.size().height as f64 / scale;
    let mut x = (screen_w - width) / 2.0;
    let mut y = (screen_h - height) / 2.0;

    if let Some(pos) = pos_prop {
        let anchor = pos
            .get("anchor")
            .and_then(|a| a.as_str())
            .unwrap_or("center");
        let offset = pos.get("offset");
        let off_x = offset
            .and_then(|o| o.get("x"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let off_y = offset
            .and_then(|o| o.get("y"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        match anchor {
            "top-left" => {
                x = 0.0;
                y = 0.0;
            }
            "top-right" => {
                x = screen_w - width;
                y = 0.0;
            }
            "bottom-left" => {
                x = 0.0;
                y = screen_h - height;
            }
            "bottom-right" => {
                x = screen_w - width;
                y = screen_h - height;
            }
            "custom" => {
                x = 0.0;
                y = 0.0;
            }
            _ => {}
        }
        x += off_x;
        y += off_y;
    }
    x = x.clamp(0.0, (screen_w - width).max(0.0));
    y = y.clamp(0.0, (screen_h - height).max(0.0));
    Some(LogicalPosition::new(x, y))
}

/// Resolve position for an anchor-based reposition (used by Tauri commands).
///
/// This is the shared anchor calculation used by `adjust_projection_size`.
/// Returns `None` if no monitor is available.
pub fn resolve_anchor_position(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    anchor: &str,
    offset_x: f64,
    offset_y: f64,
) -> Option<LogicalPosition<f64>> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let screen_w = monitor.size().width as f64 / scale;
    let screen_h = monitor.size().height as f64 / scale;
    let (mut x, mut y) = match anchor {
        "top-left" => (0.0, 0.0),
        "top-right" => (screen_w - width, 0.0),
        "bottom-left" => (0.0, screen_h - height),
        "bottom-right" => (screen_w - width, screen_h - height),
        _ => ((screen_w - width) / 2.0, (screen_h - height) / 2.0),
    };
    x += offset_x;
    y += offset_y;
    x = x.clamp(0.0, (screen_w - width).max(0.0));
    y = y.clamp(0.0, (screen_h - height).max(0.0));
    Some(LogicalPosition::new(x, y))
}

/// Resolve toast position in the top-right stack.
///
/// Returns `None` if no monitor is available.
pub fn resolve_toast_position(
    window: &WebviewWindow,
    layout: &ToastLayout,
    slot_index: usize,
) -> Option<LogicalPosition<f64>> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let screen_w = monitor.size().width as f64 / scale;
    let x = screen_w - layout.width - layout.margin_outer;
    let y = layout.margin_outer + (slot_index as f64 * layout.spacing);
    Some(LogicalPosition::new(x, y))
}
